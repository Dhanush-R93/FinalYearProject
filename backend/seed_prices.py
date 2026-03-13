"""
seed_prices.py — Fetch REAL data from data.gov.in and seed Supabase
"""
import asyncio
import numpy as np
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES
from services.agmarknet_fetcher import _fetch_date_records, COMMODITY_ALIASES, API_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_PRICES_KG = {
    "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
    "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
    "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
    "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
}

MANDIS = [
    {"name":"Koyambedu",         "district":"Chennai",        "factor":1.10},
    {"name":"Madurai Market",    "district":"Madurai",         "factor":0.95},
    {"name":"Coimbatore Market", "district":"Coimbatore",      "factor":1.05},
    {"name":"Salem Market",      "district":"Salem",           "factor":0.90},
    {"name":"Trichy Market",     "district":"Tiruchirappalli", "factor":0.92},
]

async def seed():
    print(f"🔑 API Key: {API_KEY[:25]}...")
    print("🌾 Seeding Supabase with REAL + simulated data\n")

    # Clear old data
    supabase.table("price_data").delete().neq(
        "id","00000000-0000-0000-0000-000000000000"
    ).execute()
    print("✅ Cleared old data\n")

    today = date.today()
    total_real = 0
    total_sim  = 0

    # Fetch last 7 days of real data at once (efficient)
    print("🌐 Fetching last 7 days from data.gov.in...\n")
    all_real_records = {}  # date → records
    for i in range(7):
        d = today - timedelta(days=i)
        records = await _fetch_date_records(d)
        tn_records = [r for r in records if "Tamil" in str(r.get("state",""))]
        all_real_records[d] = tn_records
        print(f"  {d}: {len(tn_records)} Tamil Nadu records")
        await asyncio.sleep(1)

    print()

    for commodity in TRACKED_COMMODITIES:
        res = supabase.table("commodities").select("id").eq("name", commodity).execute()
        if not res.data:
            continue
        commodity_id = res.data[0]["id"]
        aliases = COMMODITY_ALIASES.get(commodity, [commodity])
        rows = []

        # Save real data
        for d, records in all_real_records.items():
            matches = [
                r for r in records
                if any(a.lower() in str(r.get("commodity","")).lower() for a in aliases)
            ]
            for rec in matches:
                modal = float(rec.get("modal_price", 0))
                if modal <= 0:
                    continue
                price_kg = round(modal / 100, 2)
                if not (1 < price_kg < 500):
                    continue
                rows.append({
                    "commodity_id":   commodity_id,
                    "price":          price_kg,
                    "min_price":      round(float(rec.get("min_price", modal*0.9)) / 100, 2),
                    "max_price":      round(float(rec.get("max_price", modal*1.1)) / 100, 2),
                    "mandi_name":     str(rec.get("mandi", rec.get("market","Koyambedu"))),
                    "mandi_location": str(rec.get("district","Chennai")),
                    "state":          "Tamil Nadu",
                    "recorded_at":    d.isoformat(),
                    "source":         "agmarknet_gov_in",
                })

        real_count = len(rows)
        total_real += real_count

        # Fill 90 days of simulated history
        base = BASE_PRICES_KG.get(commodity, 30)
        np.random.seed(hash(commodity) % 2**31)
        for mandi in MANDIS:
            price = base * mandi["factor"]
            for day_offset in range(90):
                record_date = today - timedelta(days=90 - day_offset)
                if record_date >= today - timedelta(days=7):
                    continue  # skip — real data covers this
                month = record_date.month
                seasonal = 1.20 if month in [4,5,6] else (0.85 if month in [11,12,1] else 1.0)
                price = max(price*(1+float(np.random.uniform(-0.04,0.04)))*seasonal, base*0.6)
                price = min(price, base*1.8)
                rows.append({
                    "commodity_id":   commodity_id,
                    "price":          round(price, 2),
                    "min_price":      round(price*0.87, 2),
                    "max_price":      round(price*1.13, 2),
                    "mandi_name":     mandi["name"],
                    "mandi_location": mandi["district"],
                    "state":          "Tamil Nadu",
                    "recorded_at":    record_date.isoformat(),
                    "source":         "simulated",
                })

        sim_count = len(rows) - real_count
        total_sim += sim_count

        # Upsert in batches
        for i in range(0, len(rows), 200):
            supabase.table("price_data").upsert(
                rows[i:i+200],
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()

        status = "🌐 LIVE" if real_count > 0 else "📊 sim"
        print(f"  {status} {commodity}: {real_count} real + {sim_count} simulated")

    print(f"\n{'='*50}")
    print(f"🌐 Real records:      {total_real}")
    print(f"📊 Simulated records: {total_sim}")
    if total_real > 0:
        print(f"🎉 Real government data successfully saved!")
    print(f"🔄 Refresh http://localhost:8080 now!")

if __name__ == "__main__":
    asyncio.run(seed())
