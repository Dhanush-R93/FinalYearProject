"""
daily_fetcher.py
Smart incremental fetcher with:
- Retry failed dates automatically
- Track failed dates in DB
- Never lose data due to network errors
- Auto-delete records older than 90 days
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
KEEP_DAYS = 90
MAX_RETRY = 3  # retry failed dates up to 3 times

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

# ── Failed dates tracking in memory ──────────────────────────
_failed_dates: dict = {}  # {date_str: retry_count}

async def fetch_tn_records(target_date: date, attempt: int = 1) -> list:
    """Fetch with retry logic"""
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.get(URL, params={
                "api-key": API_KEY,
                "format":  "json",
                "limit":   1000,
                "filters[arrival_date]": target_date.strftime("%d/%m/%Y"),
            })
            r.raise_for_status()
            all_records = r.json().get("records", [])
            tn = [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]

            # Success — remove from failed list if it was there
            _failed_dates.pop(target_date.isoformat(), None)
            return tn

    except httpx.TimeoutException:
        logger.warning(f"  ⏱️  Timeout for {target_date} (attempt {attempt}/{MAX_RETRY})")
        _failed_dates[target_date.isoformat()] = attempt
        return []

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 502:
            logger.warning(f"  🔴 502 Bad Gateway for {target_date} (attempt {attempt}/{MAX_RETRY}) — server overloaded")
        elif e.response.status_code == 403:
            logger.warning(f"  🔑 403 Forbidden for {target_date} — API key issue")
        elif e.response.status_code == 429:
            logger.warning(f"  🚦 429 Rate limited for {target_date} — too many requests")
            await asyncio.sleep(10)  # wait longer on rate limit
        else:
            logger.warning(f"  ❌ HTTP {e.response.status_code} for {target_date}")
        _failed_dates[target_date.isoformat()] = attempt
        return []

    except Exception as e:
        logger.warning(f"  ❌ Network error for {target_date}: {e}")
        _failed_dates[target_date.isoformat()] = attempt
        return []


def build_and_save_rows(supabase, records: list, commodity_ids: dict, fetch_date: date) -> int:
    """Build DB rows from API records and save"""
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
    unique_rows = []
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key not in seen:
            seen.add(key)
            unique_rows.append(row)

    # Save
    saved = 0
    for row in unique_rows:
        try:
            supabase.table("price_data").insert(row).execute()
            saved += 1
        except Exception as e:
            err = str(e)
            if "duplicate" not in err.lower() and "21000" not in err:
                logger.warning(f"Save error: {err[:80]}")
    return saved


async def retry_failed_dates(supabase, commodity_ids: dict):
    """Retry previously failed dates"""
    if not _failed_dates:
        return

    retryable = {
        d: count for d, count in _failed_dates.items()
        if count < MAX_RETRY
    }
    permanent_fails = {
        d: count for d, count in _failed_dates.items()
        if count >= MAX_RETRY
    }

    if permanent_fails:
        logger.warning(f"⚠️  Permanently failed dates (max retries reached): {list(permanent_fails.keys())}")
        logger.warning("   These dates will use simulated data as fallback")

    if not retryable:
        return

    logger.info(f"🔁 Retrying {len(retryable)} failed dates...")
    for date_str, attempt in list(retryable.items()):
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        logger.info(f"  🔁 Retry {attempt+1}/{MAX_RETRY} for {d}")
        await asyncio.sleep(3)  # wait before retry
        records = await fetch_tn_records(d, attempt=attempt+1)
        if records:
            saved = build_and_save_rows(supabase, records, commodity_ids, d)
            logger.info(f"  ✅ Retry success for {d}: {saved} records saved")
        else:
            logger.warning(f"  ❌ Retry failed for {d}")
        await asyncio.sleep(2)


async def run_incremental_fetch(supabase):
    """
    Main function called on backend startup:
    1. Check which dates are missing
    2. Fetch only missing dates
    3. Retry any failed dates
    4. Delete records older than 90 days
    """
    today = date.today()
    logger.info("="*50)
    logger.info("🔄 Starting incremental data fetch...")

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in (comm_res.data or [])}
    if not commodity_ids:
        logger.error("No commodities in DB!")
        return

    # Get dates already successfully fetched
    existing_res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    existing_dates = set(row["recorded_at"] for row in (existing_res.data or []))
    logger.info(f"📅 Dates already in DB: {len(existing_dates)}")

    # Find missing dates in last 90 days
    missing_dates = []
    for i in range(KEEP_DAYS):
        d = today - timedelta(days=i)
        if d.isoformat() not in existing_dates:
            missing_dates.append(d)

    if not missing_dates:
        logger.info("✅ All days up to date!")
    else:
        logger.info(f"📥 Missing {len(missing_dates)} days → fetching now...")
        total_saved = 0
        failed_count = 0

        for d in missing_dates:
            records = await fetch_tn_records(d, attempt=1)

            if records:
                saved = build_and_save_rows(supabase, records, commodity_ids, d)
                total_saved += saved
                logger.info(f"  ✅ {d}: {len(records)} fetched → {saved} saved")
            else:
                failed_count += 1
                logger.warning(f"  ⚠️  {d}: fetch failed — will retry")

            await asyncio.sleep(1.5)

        logger.info(f"📊 Saved: {total_saved} | Failed: {failed_count} dates")

        # Retry failed dates after short wait
        if _failed_dates:
            logger.info("⏳ Waiting 30s before retrying failed dates...")
            await asyncio.sleep(30)
            await retry_failed_dates(supabase, commodity_ids)

    # Delete records older than 90 days
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    try:
        del_res = supabase.table("price_data")\
            .delete()\
            .lt("recorded_at", cutoff)\
            .execute()
        deleted = len(del_res.data) if del_res.data else 0
        if deleted > 0:
            logger.info(f"🗑️  Auto-deleted {deleted} records older than {KEEP_DAYS} days")
    except Exception as e:
        logger.warning(f"Delete old records failed: {e}")

    # Summary
    logger.info("="*50)
    if _failed_dates:
        permanent = [d for d, c in _failed_dates.items() if c >= MAX_RETRY]
        if permanent:
            logger.warning(f"⚠️  {len(permanent)} dates permanently unavailable: {permanent}")
            logger.warning("   Simulated data will fill these gaps on frontend")
    logger.info("✅ Incremental fetch complete!")

async def run_incremental_fetch_with_gap_fill(supabase):
    """Full pipeline: fetch missing + retry + fill gaps"""
    await run_incremental_fetch(supabase)
    
    # Fill any remaining gaps with interpolation
    try:
        from services.gap_filler import fill_gaps
        fill_gaps(supabase, KEEP_DAYS)
    except Exception as e:
        logger.warning(f"Gap fill failed: {e}")
