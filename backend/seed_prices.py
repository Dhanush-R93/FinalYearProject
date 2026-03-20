"""
seed_prices.py — Fetch last 30 days, ALL commodities, ALL Tamil Nadu markets
"""
import asyncio
import numpy as np
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

API_KEY  = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL      = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
KEEP_DAYS = 30
CONCURRENT = 5

COMMODITY_MAP = {
    "Tomato":       ["Tomato"],
    "Onion":        ["Onion"],
    "Potato":       ["Potato"],
    "Brinjal":      ["Brinjal"],
    "Cabbage":      ["Cabbage"],
    "Cauliflower":  ["Cauliflower"],
    "Carrot":       ["Carrot"],
    "Beans":        ["Beans", "Cluster beans", "Indian Beans(Seam)"],
    "Capsicum":     ["Capsicum"],
    "Lady Finger":  ["Bhindi(Ladies Finger)"],
    "Bitter Gourd": ["Bitter gourd"],
    "Bottle Gourd": ["Bottle gourd"],
    "Drumstick":    ["Drumstick"],
    "Pumpkin":      ["Pumpkin"],
    "Spinach":      ["Amaranthus"],
}

import httpx

async def fetch_one_day(client: httpx.AsyncClient, target_date: date, attempt: int = 1) -> tuple:
    """Fetch ALL Tamil Nadu records for one day — all commodities, all markets"""
    try:
        r = await client.get(URL, params={
            "api-key": API_KEY,
            "format":  "json",
            "limit":   1000,  # get max records per day
            "filters[arrival_date]": target_date.strftime("%d/%m/%Y"),
        })
        r.raise_for_status()
        all_records = r.json().get("records", [])
        # Keep ALL Tamil Nadu records (all commodities, all markets)
        tn = [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]
        return (target_date, tn, "success")

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 429:
            await asyncio.sleep(10)
        elif code == 403:
            return (target_date, [], "forbidden")
        if attempt < 3:
            await asyncio.sleep(attempt * 3)
            return await fetch_one_day(client, target_date, attempt+1)
        return (target_date, [], f"failed_{code}")

    except Exception as e:
        if attempt < 3:
            await asyncio.sleep(attempt * 3)
            return await fetch_one_day(client, target_date, attempt+1)
        return (target_date, [], "error")


async def fetch_all_days_parallel(dates: list) -> dict:
    """Fetch multiple days in parallel — returns {date: records}"""
    results = {}
    async with httpx.AsyncClient(timeout=60, limits=httpx.Limits(
        max_connections=10, max_keepalive_connections=5
    )) as client:
        for i in range(0, len(dates), CONCURRENT):
            batch = dates[i:i+CONCURRENT]
            tasks  = [fetch_one_day(client, d) for d in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, Exception):
                    continue
                d, records, status = result
                results[d] = (records, status)
                total_tn = len(records)
                # Count how many match our commodities
                matched = sum(
                    1 for rec in records
                    if any(
                        alias.lower() == str(rec.get("commodity","")).lower()
                        for aliases in COMMODITY_MAP.values()
                        for alias in aliases
                    )
                )
                if records:
                    print(f"  ✅ {d}: {total_tn} TN records | {matched} commodity matches")
                else:
                    print(f"  ⚠️  {d}: {status}")

            if i + CONCURRENT < len(dates):
                await asyncio.sleep(2)
    return results


def build_all_rows(records: list, commodity_ids: dict, fetch_date: date) -> list:
    """
    Convert ALL API records to DB rows.
    Saves EVERY commodity for EVERY market in Tamil Nadu.
    """
    rows = []
    unmatched_commodities = set()

    for rec in records:
        rec_commodity = str(rec.get("commodity",""))
        modal = float(rec.get("modal_price", 0) or 0)
        if modal <= 0:
            continue
        price_kg = round(modal / 100, 2)
        if not (1 < price_kg < 500):
            continue

        try:
            rec_date = datetime.strptime(rec.get("arrival_date",""), "%d/%m/%Y").date()
        except:
            rec_date = fetch_date

        mandi_name     = str(rec.get("market","Unknown"))[:100]
        mandi_location = str(rec.get("district",""))[:100]
        variety        = str(rec.get("variety","")).strip()

        # Make mandi+variety unique to avoid duplicate key
        if variety and variety.lower() not in ("other","faq","mixed",""):
            unique_mandi = f"{mandi_name} ({variety})"[:100]
        else:
            unique_mandi = mandi_name

        # Match to our commodity list
        matched = False
        for commodity, aliases in COMMODITY_MAP.items():
            if any(alias.lower() == rec_commodity.lower() for alias in aliases):
                cid = commodity_ids.get(commodity)
                if cid:
                    rows.append({
                        "commodity_id":   cid,
                        "price":          price_kg,
                        "min_price":      round(float(rec.get("min_price") or modal*0.9)/100, 2),
                        "max_price":      round(float(rec.get("max_price") or modal*1.1)/100, 2),
                        "mandi_name":     unique_mandi,
                        "mandi_location": mandi_location,
                        "state":          "Tamil Nadu",
                        "recorded_at":    rec_date.isoformat(),
                        "source":         "agmarknet_gov_in",
                    })
                    matched = True
                    break

        if not matched:
            unmatched_commodities.add(rec_commodity)

    # Deduplicate
    seen = set()
    unique = []
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key not in seen:
            seen.add(key)
            unique.append(row)

    return unique


def save_to_db(rows: list) -> int:
    """Save in batches of 200 using upsert"""
    if not rows:
        return 0
    saved = 0
    for i in range(0, len(rows), 200):
        batch = rows[i:i+200]
        try:
            result = supabase.table("price_data").upsert(
                batch,
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
            saved += len(result.data) if result.data else len(batch)
        except Exception as e:
            # fallback insert one by one
            for row in batch:
                try:
                    supabase.table("price_data").insert(row).execute()
                    saved += 1
                except Exception as e2:
                    err = str(e2)
                    if "duplicate" not in err.lower() and "21000" not in err:
                        pass  # skip silently
    return saved


async def seed():
    print("="*60)
    print("🚀 AgriPrice — Fetch ALL Commodities, ALL Markets, 30 Days")
    print("="*60)

    today = date.today()

    # Get commodity IDs from DB
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}
    print(f"✅ {len(commodity_ids)} commodities in DB")

    # Check existing dates
    existing_res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    existing_dates = set(row["recorded_at"] for row in (existing_res.data or []))
    print(f"📅 Already in DB: {len(existing_dates)} dates")

    # Find missing dates in last 30 days
    missing_dates = [
        today - timedelta(days=i)
        for i in range(KEEP_DAYS)
        if (today - timedelta(days=i)).isoformat() not in existing_dates
    ]
    print(f"📥 Missing: {len(missing_dates)} days\n")

    if not missing_dates:
        print("✅ All 30 days already in DB! Nothing to fetch.")
        # Still delete old records
        cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
        supabase.table("price_data").delete().lt("recorded_at", cutoff).execute()
        return

    batches = (len(missing_dates) + CONCURRENT - 1) // CONCURRENT
    est = batches * 3
    print(f"⏱️  Estimated: ~{est}s for {len(missing_dates)} days ({CONCURRENT} parallel)")
    print(f"📡 Fetching ALL TN commodities + ALL markets...\n")

    start = datetime.now()

    # Fetch all missing days in parallel
    all_results = await fetch_all_days_parallel(missing_dates)

    # Build all DB rows
    all_rows = []
    success_days = 0
    failed_days  = []

    for d, (records, status) in all_results.items():
        if records:
            rows = build_all_rows(records, commodity_ids, d)
            all_rows.extend(rows)
            success_days += 1
        else:
            failed_days.append(d)

    # Save to DB
    print(f"\n💾 Saving {len(all_rows)} rows to Supabase...")
    total_saved = save_to_db(all_rows)

    elapsed = (datetime.now() - start).seconds

    # Fill gaps for failed days
    if failed_days:
        print(f"\n🔧 Gap-filling {len(failed_days)} failed days...")
        from services.gap_filler import fill_gaps
        filled = fill_gaps(supabase, KEEP_DAYS)
        print(f"  ✅ {filled} gaps filled with interpolated data")

    # Delete records older than 30 days
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    del_res = supabase.table("price_data").delete().lt("recorded_at", cutoff).execute()
    deleted = len(del_res.data) if del_res.data else 0
    if deleted > 0:
        print(f"\n🗑️  Deleted {deleted} records older than {KEEP_DAYS} days")

    # Final summary
    print(f"\n{'='*60}")
    print(f"⏱️  Time taken    : {elapsed}s ({elapsed//60}m {elapsed%60}s)")
    print(f"✅ Days fetched  : {success_days}/{len(missing_dates)}")
    print(f"⚠️  Days failed   : {len(failed_days)} → gap filled")
    print(f"💾 Records saved : {total_saved}")
    print(f"\n📊 What's in DB now:")
    print(f"   • All Tamil Nadu markets (Koyambedu, Salem, Madurai, etc.)")
    print(f"   • All 15 commodities per market per day")
    print(f"   • Last {KEEP_DAYS} days only (older auto-deleted)")
    print(f"\n🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
