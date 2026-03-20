"""
daily_fetcher.py
- Runs on backend startup
- Fetches ONLY missing days (not already in DB)
- Deletes records older than 90 days automatically
- Called from api/main.py on startup
"""
import asyncio
import logging
from datetime import date, timedelta, datetime
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL     = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
KEEP_DAYS = 90  # keep only last 90 days

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

async def fetch_tn_records(target_date: date) -> list:
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
            return [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]
    except Exception as e:
        logger.warning(f"Fetch failed for {target_date}: {e}")
        return []

def save_rows(supabase, rows: list) -> int:
    seen = set()
    saved = 0
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key in seen:
            continue
        seen.add(key)
        try:
            supabase.table("price_data").insert(row).execute()
            saved += 1
        except Exception as e:
            err = str(e)
            if "duplicate" not in err.lower() and "21000" not in err:
                logger.warning(f"Save error: {err[:80]}")
    return saved

async def run_incremental_fetch(supabase):
    """
    Called on backend startup:
    1. Check which dates are missing from DB
    2. Fetch only those missing dates
    3. Delete records older than 90 days
    """
    today = date.today()
    logger.info("🔄 Starting incremental data fetch...")

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in (comm_res.data or [])}
    if not commodity_ids:
        logger.error("No commodities found in DB!")
        return

    # Get dates already in DB (real data only)
    existing_res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    existing_dates = set(row["recorded_at"] for row in (existing_res.data or []))
    logger.info(f"📅 Dates already in DB: {len(existing_dates)}")

    # Find missing dates (last 90 days only)
    missing_dates = []
    for i in range(KEEP_DAYS):
        d = today - timedelta(days=i)
        if d.isoformat() not in existing_dates:
            missing_dates.append(d)

    if not missing_dates:
        logger.info("✅ All days up to date — nothing to fetch")
    else:
        logger.info(f"📥 Fetching {len(missing_dates)} missing days: {[str(d) for d in missing_dates[:5]]}...")

        total_saved = 0
        for d in missing_dates:
            records = await fetch_tn_records(d)
            if not records:
                await asyncio.sleep(1)
                continue

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
                    ).date()
                except:
                    rec_date = d

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

            day_saved = save_rows(supabase, rows)
            total_saved += day_saved
            logger.info(f"  ✅ {d}: {len(records)} fetched → {day_saved} saved")
            await asyncio.sleep(1.5)

        logger.info(f"✅ Incremental fetch complete: {total_saved} new records saved")

    # Delete records older than 90 days
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    try:
        del_res = supabase.table("price_data")\
            .delete()\
            .lt("recorded_at", cutoff)\
            .execute()
        deleted = len(del_res.data) if del_res.data else 0
        if deleted > 0:
            logger.info(f"🗑️  Deleted {deleted} records older than {KEEP_DAYS} days")
    except Exception as e:
        logger.warning(f"Delete old records failed: {e}")

    logger.info("✅ Daily fetch complete!")
