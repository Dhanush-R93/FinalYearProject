"""
seed_prices.py — Fetch REAL data from data.gov.in and save to Supabase
"""
import asyncio
import numpy as np
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load .env explicitly
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES
from services.agmarknet_fetcher import fetch_agmarknet_prices, API_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"🔑 Using API Key: {API_KEY[:30]}...")
print(f"📅 Fetching data from: data.gov.in Agmarknet\n")

async def seed():
    print("🌾 Fetching REAL government data + seeding Supabase...\n")

    # Clear old data
    supabase.table("price_data").delete().neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    print("✅ Cleared old price data\n")

    today = date.today()
    from_date = today - timedelta(days=90)
    total_real = 0
    total_simulated = 0

    for commodity in TRACKED_COMMODITIES:
        # Get commodity ID
        res = supabase.table("commodities").select("id").eq("name", commodity).execute()
        if not res.data:
            print(f"  ⚠️  {commodity} not found in DB, skipping")
            continue
        commodity_id = res.data[0]["id"]

        # ── Try REAL API fetch ──────────────────────────────
        print(f"  🌐 Fetching {commodity} from data.gov.in...")
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                state="Tamil Nadu",
                from_date=from_date,
                to_date=today,
                limit=500,
            )

            is_real = (
                not df.empty
                and "source" not in df.columns  # simulated adds source col
                and df["modal_price"].mean() > 100  # real data is in ₹/quintal > 100
            )

            if is_real and len(df) > 5:
                # ── REAL DATA ──────────────────────────────
                rows = []
                for _, row in df.iterrows():
                    modal = float(row.get("modal_price", 0))
                    if modal <= 0:
                        continue
                    price_per_kg = round(modal / 100, 2)  # quintal → kg
                    if not (1 < price_per_kg < 500):
                        continue
                    rows.append({
                        "commodity_id":   commodity_id,
                        "price":          price_per_kg,
                        "min_price":      round(float(row.get("min_price", modal * 0.9)) / 100, 2),
                        "max_price":      round(float(row.get("max_price", modal * 1.1)) / 100, 2),
                        "mandi_name":     str(row.get("mandi", "Koyambedu")),
                        "mandi_location": str(row.get("district", "Chennai")),
                        "state":          str(row.get("state", "Tamil Nadu")),
                        "recorded_at":    row["date"].date().isoformat()
                                          if hasattr(row["date"], "date")
                                          else str(row["date"])[:10],
                        "source":         "agmarknet_gov_in",
                    })

                if rows:
                    for i in range(0, len(rows), 200):
                        supabase.table("price_data").upsert(
                            rows[i:i+200],
                            on_conflict="commodity_id,mandi_name,recorded_at"
                        ).execute()
                    total_real += len(rows)
                    avg_price = round(sum(r["price"] for r in rows) / len(rows), 2)
                    print(f"  ✅ {commodity}: {len(rows)} REAL records | Avg ₹{avg_price}/kg ← LIVE DATA")
                    continue  # skip simulated for this commodity

        except Exception as e:
            print(f"  ⚠️  API error for {commodity}: {e}")

        # ── FALLBACK: Simulated data ───────────────────────
        BASE_PRICES = {
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
        base = BASE_PRICES.get(commodity, 30)
        np.random.seed(hash(commodity) % 2**31)
        rows = []
        for mandi in MANDIS:
            price = base * mandi["factor"]
            for day_offset in range(90):
                record_date = today - timedelta(days=90 - day_offset)
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

        for i in range(0, len(rows), 200):
            supabase.table("price_data").upsert(
                rows[i:i+200],
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
        total_simulated += len(rows)
        print(f"  📊 {commodity}: {len(rows)} simulated records | Base ₹{base}/kg (API unavailable)")

        await asyncio.sleep(1)  # avoid rate limiting

    print(f"\n{'='*50}")
    print(f"✅ Done!")
    print(f"🌐 REAL records:      {total_real}")
    print(f"📊 Simulated records: {total_simulated}")
    if total_real > 0:
        print(f"🎉 Real government data successfully fetched!")
    else:
        print(f"⚠️  All simulated — check API key or try again later")
    print(f"🔄 Refresh http://localhost:8080 now!")

if __name__ == "__main__":
    asyncio.run(seed())
