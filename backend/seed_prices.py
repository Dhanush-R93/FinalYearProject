"""
seed_prices.py — Run this ONCE to populate Supabase with real price data
Usage: py -3.11 seed_prices.py
"""
import asyncio
import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES
from services.agmarknet_fetcher import fetch_agmarknet_prices

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

async def seed():
    print("🌾 Starting price seeding from data.gov.in...")
    today = date.today()
    from_date = today - timedelta(days=60)
    total_inserted = 0

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

            # Get commodity ID
            res = supabase.table("commodities").select("id").eq("name", commodity).execute()
            if not res.data:
                print(f"  ⚠️  {commodity} not in DB")
                continue

            commodity_id = res.data[0]["id"]
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "commodity_id": commodity_id,
                    "price":        float(row.get("modal_price", 0)),
                    "min_price":    float(row.get("min_price", 0)),
                    "max_price":    float(row.get("max_price", 0)),
                    "mandi_name":   str(row.get("mandi", "Koyambedu")),
                    "state":        str(row.get("state", "Tamil Nadu")),
                    "recorded_at":  row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                    "source":       "agmarknet_gov_in",
                })

            supabase.table("price_data").upsert(
                rows, on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()
            total_inserted += len(rows)
            print(f"  ✅ {commodity}: {len(rows)} records inserted")

        except Exception as e:
            print(f"  ❌ {commodity} failed: {e}")

    print(f"\n✅ Done! Total records: {total_inserted}")
    print("🔄 Refresh your frontend at http://localhost:8081")

if __name__ == "__main__":
    asyncio.run(seed())
