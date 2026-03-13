"""
seed_prices.py — Populate Supabase with real price data
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

# Government API returns prices per QUINTAL (100kg)
# We divide by 100 to get per KG for display
QUINTAL_TO_KG = 100.0

async def seed():
    print("🌾 Seeding real prices from data.gov.in...")
    today = date.today()
    from_date = today - timedelta(days=60)
    total = 0

    for commodity in TRACKED_COMMODITIES:
        try:
            print(f"  Fetching {commodity}...")
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                from_date=from_date,
                to_date=today,
                limit=200,
            )
            if df.empty:
                print(f"  ⚠️  No data for {commodity}")
                continue

            # Check if data is real or simulated
            is_real = "agmarknet" in str(df.get("source", ["simulated"])[0] if "source" in df.columns else "simulated")
            source_label = "agmarknet_gov_in" if is_real else "simulated"

            res = supabase.table("commodities").select("id").eq("name", commodity).execute()
            if not res.data:
                print(f"  ⚠️  {commodity} not in DB")
                continue

            commodity_id = res.data[0]["id"]
            rows = []
            for _, row in df.iterrows():
                modal = float(row.get("modal_price", 0))
                min_p = float(row.get("min_price", 0))
                max_p = float(row.get("max_price", 0))

                # Convert quintal → kg (divide by 100)
                rows.append({
                    "commodity_id": commodity_id,
                    "price":        round(modal / QUINTAL_TO_KG, 2),
                    "min_price":    round(min_p / QUINTAL_TO_KG, 2),
                    "max_price":    round(max_p / QUINTAL_TO_KG, 2),
                    "mandi_name":   str(row.get("mandi", "Koyambedu")),
                    "state":        str(row.get("state", "Tamil Nadu")),
                    "recorded_at":  row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                    "source":       source_label,
                })

            supabase.table("price_data").upsert(
                rows, on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
            total += len(rows)
            print(f"  ✅ {commodity}: {len(rows)} records ({source_label})")

        except Exception as e:
            print(f"  ❌ {commodity}: {e}")

    print(f"\n✅ Done! {total} total records inserted.")
    print("🔄 Refresh http://localhost:8081 — prices now in ₹/kg!")

if __name__ == "__main__":
    asyncio.run(seed())
