"""
seed_prices.py — FIRST TIME ONLY: Fetch last 90 days and store in DB
Run once: py -3.11 seed_prices.py
After that, backend auto-fetches only missing days on startup
"""
import asyncio
import numpy as np
import httpx
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL     = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

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

BASE_PRICES_KG = {
    "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
    "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
    "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
    "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
}

async def fetch_tn_records(target_date: date, max_retry: int = 3) -> list:
    """Fetch with automatic retry on failure"""
    for attempt in range(1, max_retry + 1):
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
                return tn

        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            if code == 502:
                print(f"  🔴 {target_date}: 502 Bad Gateway (attempt {attempt}/{max_retry})")
            elif code == 429:
                print(f"  🚦 {target_date}: Rate limited — waiting 15s...")
                await asyncio.sleep(15)
            elif code == 403:
                print(f"  🔑 {target_date}: 403 Forbidden — API key issue")
                return []  # no point retrying
            else:
                print(f"  ❌ {target_date}: HTTP {code}")

        except httpx.TimeoutException:
            print(f"  ⏱️  {target_date}: Timeout (attempt {attempt}/{max_retry})")

        except Exception as e:
            print(f"  ❌ {target_date}: {str(e)[:80]}")

        # Wait before retry (longer each time)
        if attempt < max_retry:
            wait = attempt * 5  # 5s, 10s, 15s
            print(f"     ⏳ Waiting {wait}s before retry...")
            await asyncio.sleep(wait)

    print(f"  💀 {target_date}: All {max_retry} attempts failed — skipping")
    return []

def get_dates_in_db() -> set:
    """Get all dates already stored in DB"""
    res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    return set(row["recorded_at"] for row in (res.data or []))

def delete_old_records(keep_days: int = 90):
    """Delete records older than keep_days"""
    cutoff = (date.today() - timedelta(days=keep_days)).isoformat()
    res = supabase.table("price_data")\
        .delete()\
        .lt("recorded_at", cutoff)\
        .execute()
    deleted = len(res.data) if res.data else 0
    if deleted > 0:
        print(f"🗑️  Deleted {deleted} old records (older than {keep_days} days)")
    return deleted

def deduplicate(rows: list) -> list:
    seen = set()
    unique = []
    for row in rows:
        key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique

def save_rows(rows: list) -> int:
    if not rows:
        return 0
    rows = deduplicate(rows)
    saved = 0
    for row in rows:
        try:
            supabase.table("price_data").insert(row).execute()
            saved += 1
        except Exception as e:
            err = str(e)
            if "duplicate" in err.lower() or "unique" in err.lower() or "21000" in err:
                pass
            else:
                print(f"  ❌ Save error: {err[:80]}")
    return saved

def build_rows(records: list, commodity_ids: dict, fetch_date: date) -> dict:
    """Build DB rows from API records, grouped by commodity"""
    result = {c: [] for c in TRACKED_COMMODITIES}

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
            rec_date = fetch_date

        variety = str(rec.get("variety","")).strip()
        mandi_name = str(rec.get("market","Unknown"))[:100]
        if variety and variety.lower() not in ("other","faq","mixed",""):
            mandi_name = f"{mandi_name} ({variety})"

        for commodity, aliases in COMMODITY_MAP.items():
            if any(alias.lower() == rec_commodity.lower() for alias in aliases):
                commodity_id = commodity_ids.get(commodity)
                if commodity_id:
                    result[commodity].append({
                        "commodity_id":   commodity_id,
                        "price":          price_kg,
                        "min_price":      round(float(rec.get("min_price") or modal*0.9)/100, 2),
                        "max_price":      round(float(rec.get("max_price") or modal*1.1)/100, 2),
                        "mandi_name":     mandi_name,
                        "mandi_location": str(rec.get("district",""))[:100],
                        "state":          "Tamil Nadu",
                        "recorded_at":    rec_date.isoformat(),
                        "source":         "agmarknet_gov_in",
                    })
    return result

async def seed():
    print("="*55)
    print("🌾 AgriPrice — First Time Data Setup (90 days)")
    print("="*55)
    print(f"🔑 API Key: {API_KEY[:25]}...\n")

    today = date.today()

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}
    print(f"✅ {len(commodity_ids)} commodities found in DB\n")

    # Check which dates already exist
    existing_dates = get_dates_in_db()
    print(f"📅 Dates already in DB: {len(existing_dates)}")

    # Find missing dates in last 90 days
    missing_dates = []
    for i in range(90):
        d = today - timedelta(days=i)
        if d.isoformat() not in existing_dates:
            missing_dates.append(d)

    print(f"📥 Missing dates to fetch: {len(missing_dates)}\n")

    if not missing_dates:
        print("✅ All 90 days already in DB! Nothing to fetch.")
        delete_old_records(90)
        return

    # Fetch only missing dates
    print(f"📡 Fetching {len(missing_dates)} missing days...\n")
    total_real = 0

    for d in missing_dates:
        records = await fetch_tn_records(d)
        if records:
            rows_by_commodity = build_rows(records, commodity_ids, d)
            day_saved = 0
            for commodity, rows in rows_by_commodity.items():
                day_saved += save_rows(rows)
            total_real += day_saved
            print(f"  ✅ {d}: {len(records)} TN fetched → {day_saved} saved")
        else:
            print(f"  ⚠️  {d}: no data from API")
        await asyncio.sleep(1.5)

    # Delete records older than 90 days
    print()
    delete_old_records(90)

    print(f"\n{'='*55}")
    print(f"🌐 Real records saved: {total_real}")
    print(f"✅ DB now has last 90 days of Tamil Nadu prices")
    print(f"🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
