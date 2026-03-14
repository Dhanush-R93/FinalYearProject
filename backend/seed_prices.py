"""
seed_prices.py — Fetch REAL data from data.gov.in and save to Supabase
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
            tn = [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]
            return tn
    except Exception as e:
        print(f"  ⚠️  Fetch failed for {target_date}: {e}")
        return []

def save_batch(rows: list) -> int:
    """Save rows one batch at a time, return count saved"""
    saved = 0
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        try:
            # Use insert with ignore duplicates
            result = supabase.table("price_data").insert(
                batch, returning="minimal"
            ).execute()
            saved += len(batch)
        except Exception as e:
            err_str = str(e)
            if "duplicate" in err_str.lower() or "unique" in err_str.lower():
                # Try one by one
                for row in batch:
                    try:
                        supabase.table("price_data").insert(row, returning="minimal").execute()
                        saved += 1
                    except:
                        pass
            else:
                print(f"    ❌ Save error: {err_str[:100]}")
    return saved

async def seed():
    print(f"🔑 API Key: {API_KEY[:25]}...")
    print("🌾 Fetching REAL Tamil Nadu data from Agmarknet\n")

    # Clear ALL old data first
    try:
        supabase.table("price_data").delete().neq(
            "id","00000000-0000-0000-0000-000000000000"
        ).execute()
        print("✅ Cleared old data\n")
    except Exception as e:
        print(f"❌ Clear failed: {e}")
        return

    today = date.today()

    # ── Fetch last 30 days ──────────────────────────────────
    print("📡 Fetching last 30 days from data.gov.in...\n")
    all_tn_records = []
    for i in range(30):
        d = today - timedelta(days=i)
        records = await fetch_tn_records(d)
        if records:
            # Add arrival_date to each record for later use
            for rec in records:
                rec["_fetched_date"] = d
            all_tn_records.extend(records)
            print(f"  ✅ {d}: {len(records)} TN records")
        else:
            print(f"  ⚠️  {d}: no data")
        await asyncio.sleep(1.5)

    print(f"\n📊 Total real TN records: {len(all_tn_records)}\n")
    print("💾 Saving to Supabase...\n")

    # ── Get all commodity IDs at once ──────────────────────
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}

    total_real = 0
    total_sim  = 0

    for commodity in TRACKED_COMMODITIES:
        commodity_id = commodity_ids.get(commodity)
        if not commodity_id:
            print(f"  ⚠️  {commodity} not in DB")
            continue

        aliases = COMMODITY_MAP.get(commodity, [commodity])
        real_rows = []

        # Match real records
        for rec in all_tn_records:
            rec_commodity = str(rec.get("commodity",""))
            if not any(alias.lower() == rec_commodity.lower() for alias in aliases):
                continue

            modal = float(rec.get("modal_price", 0) or 0)
            if modal <= 0:
                continue
            price_kg = round(modal / 100, 2)
            if not (1 < price_kg < 500):
                continue

            try:
                rec_date = datetime.strptime(
                    rec.get("arrival_date", ""), "%d/%m/%Y"
                ).date()
            except:
                rec_date = rec.get("_fetched_date", today)

            real_rows.append({
                "commodity_id":   commodity_id,
                "price":          price_kg,
                "min_price":      round(float(rec.get("min_price") or modal*0.9) / 100, 2),
                "max_price":      round(float(rec.get("max_price") or modal*1.1) / 100, 2),
                "mandi_name":     str(rec.get("market", "Unknown"))[:100],
                "mandi_location": str(rec.get("district", ""))[:100],
                "state":          "Tamil Nadu",
                "recorded_at":    rec_date.isoformat(),
                "source":         "agmarknet_gov_in",
            })

        # Save real rows
        real_saved = save_batch(real_rows) if real_rows else 0
        total_real += real_saved

        # ── Simulated history (60 days before real data) ────
        base = BASE_PRICES_KG.get(commodity, 30)
        np.random.seed(hash(commodity) % 2**31)
        sim_rows = []
        price = float(base)
        for day_offset in range(90):
            record_date = today - timedelta(days=90 - day_offset)
            if record_date >= today - timedelta(days=30):
                continue
            month = record_date.month
            seasonal = 1.20 if month in [4,5,6] else (0.85 if month in [11,12,1] else 1.0)
            price = max(price*(1+float(np.random.uniform(-0.04,0.04)))*seasonal, base*0.6)
            price = min(price, base*1.8)
            sim_rows.append({
                "commodity_id":   commodity_id,
                "price":          round(price, 2),
                "min_price":      round(price*0.87, 2),
                "max_price":      round(price*1.13, 2),
                "mandi_name":     "Koyambedu",
                "mandi_location": "Chennai",
                "state":          "Tamil Nadu",
                "recorded_at":    record_date.isoformat(),
                "source":         "simulated",
            })

        sim_saved = save_batch(sim_rows)
        total_sim += sim_saved

        status = "🌐 LIVE" if real_saved > 0 else "📊 sim "
        print(f"  {status} | {commodity:15} | {real_saved:3} real | {sim_saved} simulated saved")

    print(f"\n{'='*55}")
    print(f"🌐 Real govt records saved : {total_real}")
    print(f"📊 Simulated records saved : {total_sim}")
    if total_real > 0:
        print(f"🎉 SUCCESS! Real Agmarknet data in your database!")
    else:
        print(f"⚠️  No real data saved — all simulated")
    print(f"\n🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
