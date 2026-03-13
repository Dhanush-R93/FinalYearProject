"""
seed_prices.py — Populate Supabase with realistic vegetable prices
Usage: py -3.11 seed_prices.py
"""
import asyncio
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES
from services.agmarknet_fetcher import fetch_agmarknet_prices

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Realistic Indian vegetable prices in ₹/kg (retail market averages 2024)
REALISTIC_PRICES_PER_KG = {
    "Tomato": 25, "Onion": 35, "Potato": 20, "Brinjal": 30,
    "Cabbage": 18, "Cauliflower": 35, "Carrot": 40, "Beans": 60,
    "Capsicum": 55, "Lady Finger": 40, "Bitter Gourd": 45,
    "Bottle Gourd": 20, "Drumstick": 50, "Pumpkin": 22, "Spinach": 25,
}

# Multiple mandis across Tamil Nadu
TAMIL_NADU_MANDIS = [
    {"name": "Koyambedu", "state": "Tamil Nadu", "district": "Chennai"},
    {"name": "Madurai Market", "state": "Tamil Nadu", "district": "Madurai"},
    {"name": "Coimbatore Market", "state": "Tamil Nadu", "district": "Coimbatore"},
    {"name": "Salem Market", "state": "Tamil Nadu", "district": "Salem"},
    {"name": "Trichy Market", "state": "Tamil Nadu", "district": "Tiruchirappalli"},
]

import numpy as np
from datetime import datetime

async def seed():
    print("🌾 Clearing old data and re-seeding with correct ₹/kg prices...")

    # Clear old price_data
    supabase.table("price_data").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("✅ Cleared old price data")

    today = date.today()
    total = 0

    for commodity in TRACKED_COMMODITIES:
        # Get commodity ID
        res = supabase.table("commodities").select("id").eq("name", commodity).execute()
        if not res.data:
            print(f"  ⚠️  {commodity} not in DB, skipping")
            continue
        commodity_id = res.data[0]["id"]

        base_price = REALISTIC_PRICES_PER_KG.get(commodity, 30)
        rows = []
        np.random.seed(hash(commodity) % 2**31)

        # Generate 60 days of data for each mandi
        for mandi in TAMIL_NADU_MANDIS:
            price = float(base_price)
            for day_offset in range(60):
                record_date = today - timedelta(days=60 - day_offset)
                # Add realistic daily variation ±5% + mandi-specific offset
                mandi_factor = 0.95 + (hash(mandi["name"]) % 10) * 0.01
                daily_change = np.random.uniform(-0.05, 0.05)
                price = max(price * (1 + daily_change) * mandi_factor, base_price * 0.5)
                price = min(price, base_price * 2.5)

                rows.append({
                    "commodity_id": commodity_id,
                    "price":        round(price, 2),
                    "min_price":    round(price * 0.88, 2),
                    "max_price":    round(price * 1.12, 2),
                    "mandi_name":   mandi["name"],
                    "mandi_location": mandi["district"],
                    "state":        mandi["state"],
                    "recorded_at":  record_date.isoformat(),
                    "source":       "simulated",
                })

        # Try to get real data from API and override simulated if available
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                from_date=today - timedelta(days=30),
                to_date=today,
                limit=100,
            )
            if not df.empty and "mandi" in df.columns:
                real_count = 0
                for _, row in df.iterrows():
                    modal = float(row.get("modal_price", 0))
                    if modal > 0:
                        price_per_kg = round(modal / 100, 2)  # quintal → kg
                        if 1 < price_per_kg < 500:  # sanity check
                            rows.append({
                                "commodity_id": commodity_id,
                                "price":        price_per_kg,
                                "min_price":    round(float(row.get("min_price", modal * 0.9)) / 100, 2),
                                "max_price":    round(float(row.get("max_price", modal * 1.1)) / 100, 2),
                                "mandi_name":   str(row.get("mandi", "Koyambedu")),
                                "mandi_location": str(row.get("district", "")),
                                "state":        str(row.get("state", "Tamil Nadu")),
                                "recorded_at":  row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                                "source":       "agmarknet_gov_in",
                            })
                            real_count += 1
                print(f"  ✅ {commodity}: {real_count} real + {len(TAMIL_NADU_MANDIS)*60} simulated records")
            else:
                print(f"  📊 {commodity}: {len(rows)} simulated records (API unavailable)")
        except Exception as e:
            print(f"  📊 {commodity}: simulated only ({e})")

        # Upsert in batches of 100
        for i in range(0, len(rows), 100):
            batch = rows[i:i+100]
            supabase.table("price_data").upsert(
                batch, on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
        total += len(rows)

    print(f"\n✅ Done! {total} records inserted.")
    print("🔄 Refresh http://localhost:8081 — correct ₹/kg prices for all mandis!")

if __name__ == "__main__":
    asyncio.run(seed())
