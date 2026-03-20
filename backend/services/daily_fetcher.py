"""
daily_fetcher.py
Fast parallel fetcher - fetches multiple days simultaneously
"""
import asyncio
import logging
from datetime import date, timedelta, datetime
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)

API_KEY   = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL       = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
KEEP_DAYS = 30
MAX_RETRY = 3
CONCURRENT = 5  # fetch 5 days at same time

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

_failed_dates: dict = {}

async def fetch_one_day(client: httpx.AsyncClient, target_date: date, attempt: int = 1) -> tuple:
    """Fetch single day — returns (date, records_list)"""
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
        _failed_dates.pop(target_date.isoformat(), None)
        return (target_date, tn)

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 429:  # rate limit — wait and retry
            await asyncio.sleep(10)
            if attempt < MAX_RETRY:
                return await fetch_one_day(client, target_date, attempt+1)
        elif code == 403:
            pass  # no point retrying
        else:
            if attempt < MAX_RETRY:
                await asyncio.sleep(attempt * 3)
                return await fetch_one_day(client, target_date, attempt+1)
        _failed_dates[target_date.isoformat()] = attempt
        return (target_date, [])

    except Exception as e:
        if attempt < MAX_RETRY:
            await asyncio.sleep(attempt * 3)
            return await fetch_one_day(client, target_date, attempt+1)
        _failed_dates[target_date.isoformat()] = attempt
        return (target_date, [])


async def fetch_days_parallel(dates: list) -> dict:
    """
    Fetch multiple days in parallel batches of CONCURRENT
    Returns {date: [records]}
    """
    results = {}
    # Use single shared client for connection reuse
    async with httpx.AsyncClient(timeout=60, limits=httpx.Limits(
        max_connections=10,
        max_keepalive_connections=5
    )) as client:
        # Process in batches of CONCURRENT
        for i in range(0, len(dates), CONCURRENT):
            batch = dates[i:i+CONCURRENT]
            tasks = [fetch_one_day(client, d) for d in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, Exception):
                    continue
                d, records = result
                results[d] = records
                if records:
                    logger.info(f"  ✅ {d}: {len(records)} TN records")
                else:
                    logger.warning(f"  ⚠️  {d}: no data")

            # Small delay between batches to avoid rate limiting
            if i + CONCURRENT < len(dates):
                await asyncio.sleep(2)

    return results


def build_rows(records: list, commodity_ids: dict, fetch_date: date) -> list:
    """Convert API records to DB rows"""
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
            rec_date = datetime.strptime(rec.get("arrival_date",""), "%d/%m/%Y").date()
        except:
            rec_date = fetch_date

        variety = str(rec.get("variety","")).strip()
        mandi_name = str(rec.get("market","Unknown"))[:100]
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
                        "mandi_name":     mandi_name,
                        "mandi_location": str(rec.get("district",""))[:100],
                        "state":          "Tamil Nadu",
                        "recorded_at":    rec_date.isoformat(),
                        "source":         "agmarknet_gov_in",
                    })
    # Deduplicate
    seen = set()
    unique = []
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def save_batch_to_db(supabase, rows: list) -> int:
    """Save rows to DB in batches of 100"""
    saved = 0
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        try:
            result = supabase.table("price_data").upsert(
                batch,
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
            saved += len(result.data) if result.data else len(batch)
        except Exception as e:
            # Fallback: insert one by one
            for row in batch:
                try:
                    supabase.table("price_data").insert(row).execute()
                    saved += 1
                except Exception as e2:
                    err = str(e2)
                    if "duplicate" not in err.lower() and "21000" not in err:
                        logger.warning(f"Save error: {err[:60]}")
    return saved


async def run_incremental_fetch(supabase):
    """Fast parallel incremental fetch"""
    today = date.today()
    logger.info("="*50)
    logger.info("🚀 Fast parallel incremental fetch starting...")

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in (comm_res.data or [])}
    if not commodity_ids:
        logger.error("No commodities in DB!")
        return

    # Find missing dates
    existing_res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    existing_dates = set(row["recorded_at"] for row in (existing_res.data or []))

    missing_dates = [
        today - timedelta(days=i)
        for i in range(KEEP_DAYS)
        if (today - timedelta(days=i)).isoformat() not in existing_dates
    ]

    logger.info(f"📅 In DB: {len(existing_dates)} | Missing: {len(missing_dates)}")

    if not missing_dates:
        logger.info("✅ All days up to date!")
    else:
        logger.info(f"📥 Fetching {len(missing_dates)} days ({CONCURRENT} at a time)...")
        start_time = datetime.now()

        # Fetch all missing days in parallel
        all_results = await fetch_days_parallel(missing_dates)

        # Save all fetched data
        total_saved = 0
        all_rows = []
        for d, records in all_results.items():
            if records:
                rows = build_rows(records, commodity_ids, d)
                all_rows.extend(rows)

        if all_rows:
            total_saved = save_batch_to_db(supabase, all_rows)

        elapsed = (datetime.now() - start_time).seconds
        logger.info(f"✅ Done in {elapsed}s — {total_saved} records saved")
        logger.info(f"   Failed dates: {list(_failed_dates.keys())}")

    # Delete records older than 90 days
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    try:
        del_res = supabase.table("price_data")\
            .delete().lt("recorded_at", cutoff).execute()
        deleted = len(del_res.data) if del_res.data else 0
        if deleted > 0:
            logger.info(f"🗑️  Deleted {deleted} old records (>{KEEP_DAYS} days)")
    except Exception as e:
        logger.warning(f"Delete failed: {e}")

    logger.info("="*50)


async def run_incremental_fetch_with_gap_fill(supabase):
    """Full pipeline: parallel fetch + gap fill"""
    await run_incremental_fetch(supabase)
    try:
        from services.gap_filler import fill_gaps
        fill_gaps(supabase, KEEP_DAYS)
    except Exception as e:
        logger.warning(f"Gap fill failed: {e}")
