"""
seed_prices.py - Smart incremental fetcher:
1. Check DB for each date before fetching
2. Save instantly after each successful fetch
3. Fill gaps using interpolation if fetch fails
"""
import asyncio
import httpx
import numpy as np
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

API_KEY   = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL       = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
KEEP_DAYS = 30
EXPECTED_RECORDS_PER_DAY = 200  # if DB has >= this, skip that date

COMMODITY_MAP = {
    "Tomato":       ["Tomato"],
    "Onion":        ["Onion"],
    "Potato":       ["Potato"],
    "Brinjal":      ["Brinjal"],
    "Cabbage":      ["Cabbage"],
    "Cauliflower":  ["Cauliflower"],
    "Carrot":       ["Carrot"],
    "Beans":        ["Beans", "Cluster beans"],
    "Capsicum":     ["Capsicum"],
    "Lady Finger":  ["Bhindi(Ladies Finger)"],
    "Bitter Gourd": ["Bitter gourd"],
    "Bottle Gourd": ["Bottle gourd"],
    "Drumstick":    ["Drumstick"],
    "Pumpkin":      ["Pumpkin"],
    "Spinach":      ["Amaranthus"],
}

# ── Step 1: Check DB ────────────────────────────────────────
def get_db_record_count(target_date: str) -> int:
    """Check how many real records exist for this date"""
    from datetime import datetime as dt
    next_d = (dt.strptime(target_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    res = supabase.table("price_data")\
        .select("id", count="exact")\
        .eq("source", "agmarknet_gov_in")\
        .gte("recorded_at", target_date)\
        .lt("recorded_at", next_d)\
        .execute()
    return res.count or 0

# ── Step 2: Fetch from API ──────────────────────────────────
async def fetch_day(client: httpx.AsyncClient, target_date: date, attempt: int = 1) -> list:
    """Fetch all TN records for one day with retry"""
    try:
        r = await client.get(URL, params={
            "api-key": API_KEY,
            "format":  "json",
            "limit":   1000,
            "filters[arrival_date]": target_date.strftime("%d/%m/%Y"),
        })
        r.raise_for_status()
        all_records = r.json().get("records", [])
        tn = [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]
        return tn

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 429:
            print(f"    🚦 Rate limited — waiting 15s...")
            await asyncio.sleep(15)
        if attempt < 3:
            await asyncio.sleep(attempt * 3)
            return await fetch_day(client, target_date, attempt + 1)
        return []

    except Exception as e:
        if attempt < 3:
            await asyncio.sleep(attempt * 3)
            return await fetch_day(client, target_date, attempt + 1)
        return []

# ── Step 3: Build DB rows ───────────────────────────────────
def build_rows(records: list, commodity_ids: dict, fallback_date: date) -> list:
    rows = []
    for rec in records:
        rec_commodity = str(rec.get("commodity",""))
        modal = float(rec.get("modal_price", 0) or 0)
        if modal <= 0:
            continue
        price_kg = round(modal / 100, 2)
        if not (1 < price_kg < 500):
            continue

        try:
            rec_date = datetime.strptime(
                rec.get("arrival_date",""), "%d/%m/%Y"
            ).strftime("%Y-%m-%d")
        except:
            rec_date = fallback_date.isoformat()

        mandi_name = str(rec.get("market","Unknown"))[:100]
        variety    = str(rec.get("variety","")).strip()
        if variety and variety.lower() not in ("other","faq","mixed",""):
            mandi_name = f"{mandi_name} ({variety})"

        for commodity, aliases in COMMODITY_MAP.items():
            if any(alias.lower() == rec_commodity.lower() for alias in aliases):
                cid = commodity_ids.get(commodity)
                if cid:
                    rows.append({
                        "commodity_id":   cid,
                        "price":          price_kg,
                        "min_price":      round(float(rec.get("min_price") or modal*0.9)/100, 2),
                        "max_price":      round(float(rec.get("max_price") or modal*1.1)/100, 2),
                        "mandi_name":     mandi_name[:100],
                        "mandi_location": str(rec.get("district",""))[:100],
                        "state":          "Tamil Nadu",
                        "recorded_at":    rec_date,
                        "source":         "agmarknet_gov_in",
                    })
                break

    # Deduplicate
    seen = set()
    unique = []
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique

# ── Step 4: Save instantly to DB ───────────────────────────
def save_instantly(rows: list) -> int:
    """Save rows immediately using upsert in batches of 50"""
    if not rows:
        return 0
    saved = 0
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        try:
            result = supabase.table("price_data").upsert(
                batch,
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
            saved += len(result.data) if result.data else len(batch)
        except Exception as e:
            print(f"\n    ❌ Save error: {str(e)[:120]}")
            # fallback: insert one by one
            for row in batch:
                try:
                    supabase.table("price_data").upsert(
                        row,
                        on_conflict="commodity_id,mandi_name,recorded_at"
                    ).execute()
                    saved += 1
                except Exception as e2:
                    print(f"    ❌ Row error: {str(e2)[:80]}")
    return saved

# ── Step 5: Fill gaps using interpolation ──────────────────
def get_price_for_date(commodity_id: str, mandi_name: str, target_date: str) -> float | None:
    """Get price for specific commodity+mandi+date"""
    res = supabase.table("price_data")\
        .select("price")\
        .eq("commodity_id", commodity_id)\
        .eq("mandi_name", mandi_name)\
        .eq("recorded_at", target_date)\
        .in_("source", ["agmarknet_gov_in", "interpolated"])\
        .limit(1)\
        .execute()
    if res.data:
        return float(res.data[0]["price"])
    return None

def fill_gap_for_date(target_date: date, commodity_ids: dict):
    """Fill missing date using (previous day + next day) / 2"""
    date_str  = target_date.isoformat()
    prev_date = (target_date - timedelta(days=1)).isoformat()
    next_date = (target_date + timedelta(days=1)).isoformat()

    # Get all mandi+commodity combos from previous day
    prev_res = supabase.table("price_data")\
        .select("commodity_id, mandi_name, mandi_location, price, min_price, max_price")\
        .eq("recorded_at", prev_date)\
        .in_("source", ["agmarknet_gov_in", "interpolated"])\
        .execute()

    if not prev_res.data:
        print(f"    ⚠️  No previous day data for interpolation")
        return 0

    filled = 0
    rows_to_save = []

    for prev_row in prev_res.data:
        cid        = prev_row["commodity_id"]
        mandi_name = prev_row["mandi_name"]
        prev_price = float(prev_row["price"])

        # Check if already exists for target date
        existing = supabase.table("price_data")\
            .select("id")\
            .eq("commodity_id", cid)\
            .eq("mandi_name", mandi_name)\
            .eq("recorded_at", date_str)\
            .execute()
        if existing.data:
            continue  # already have data for this combo

        # Try to get next day price
        next_price = get_price_for_date(cid, mandi_name, next_date)

        if next_price:
            # (previous + next) / 2
            interp_price = round((prev_price + next_price) / 2, 2)
            method = "prev+next/2"
        else:
            # Use previous day price (same as yesterday)
            interp_price = prev_price
            method = "prev_day"

        rows_to_save.append({
            "commodity_id":   cid,
            "price":          interp_price,
            "min_price":      round(interp_price * 0.92, 2),
            "max_price":      round(interp_price * 1.08, 2),
            "mandi_name":     mandi_name,
            "mandi_location": prev_row.get("mandi_location",""),
            "state":          "Tamil Nadu",
            "recorded_at":    date_str,
            "source":         "interpolated",
        })

    # Save all interpolated rows
    for row in rows_to_save:
        try:
            supabase.table("price_data").insert(row).execute()
            filled += 1
        except Exception as e:
            if "duplicate" not in str(e).lower() and "21000" not in str(e):
                pass
    return filled

# ── Main ────────────────────────────────────────────────────
async def seed():
    print("="*60)
    print("🚀 Smart Incremental Fetch — 30 Days All TN Markets")
    print("="*60)

    today = date.today()

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}
    print(f"✅ {len(commodity_ids)} commodities in DB\n")

    # Process each day
    stats = {"skipped": 0, "fetched": 0, "failed": 0, "saved": 0}
    failed_dates = []

    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(KEEP_DAYS):
            d = today - timedelta(days=i)
            date_str = d.isoformat()

            # ── Check DB first ──────────────────────────
            existing_count = get_db_record_count(date_str)
            if existing_count >= EXPECTED_RECORDS_PER_DAY:
                print(f"  ⏭️  {date_str}: {existing_count} records already in DB — skip")
                stats["skipped"] += 1
                continue

            # ── Fetch from API ──────────────────────────
            print(f"  📡 {date_str}: fetching...", end=" ", flush=True)
            records = await fetch_day(client, d)

            if records:
                # ── Build rows ──────────────────────────
                rows = build_rows(records, commodity_ids, d)

                # ── Save instantly to DB ────────────────
                saved = save_instantly(rows)
                stats["fetched"] += 1
                stats["saved"]   += saved
                print(f"✅ {len(records)} TN records → {saved} saved to DB")
            else:
                # ── Fetch failed ────────────────────────
                stats["failed"] += 1
                failed_dates.append(d)
                print(f"❌ fetch failed — will interpolate later")

            await asyncio.sleep(1)  # small delay to avoid rate limit

    # ── Fill gaps for failed dates ──────────────────────────
    if failed_dates:
        print(f"\n🔧 Filling {len(failed_dates)} failed dates with interpolation...")
        total_filled = 0
        for d in sorted(failed_dates):
            print(f"  🔧 {d.isoformat()}: interpolating...", end=" ", flush=True)
            filled = fill_gap_for_date(d, commodity_ids)
            total_filled += filled
            print(f"✅ {filled} rows filled using (prev+next)/2")
        print(f"  ✅ Total interpolated: {total_filled} rows")

    # ── Delete records older than 30 days ───────────────────
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    del_res = supabase.table("price_data")\
        .delete().lt("recorded_at", cutoff).execute()
    deleted = len(del_res.data) if del_res.data else 0
    if deleted > 0:
        print(f"\n🗑️  Deleted {deleted} old records (older than {KEEP_DAYS} days)")

    # ── Final summary ────────────────────────────────────────
    total_res = supabase.table("price_data")\
        .select("source", count="exact").execute()

    print(f"\n{'='*60}")
    print(f"⏭️  Skipped (already in DB) : {stats['skipped']} days")
    print(f"✅ Fetched & saved          : {stats['fetched']} days")
    print(f"❌ Failed (interpolated)    : {stats['failed']} days")
    print(f"💾 Total records saved      : {stats['saved']}")
    print(f"\n🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
