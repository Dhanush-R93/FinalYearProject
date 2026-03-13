"""
seed_prices.py — Fetch ALL real Tamil Nadu data and save to Supabase
"""
import asyncio
import numpy as np
import httpx
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL     = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Match API commodity names to our DB names
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
    """Fetch all Tamil Nadu records for a date"""
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

async def seed():
    print(f"🔑 API Key: {API_KEY[:25]}...")
    print("🌾 Fetching ALL Tamil Nadu real data\n")

    # Clear old data
    supabase.table("price_data").delete().neq(
        "id","00000000-0000-0000-0000-000000000000"
    ).execute()
    print("✅ Cleared old data\n")

    today = date.today()

    # ── Step 1: Fetch last 30 days of real TN data ──────────
    print("📡 Fetching last 30 days from data.gov.in...\n")
    all_tn_records = []  # flat list of all records

    for i in range(30):
        d = today - timedelta(days=i)
        records = await fetch_tn_records(d)
        all_tn_records.extend(records)
        if records:
            print(f"  ✅ {d}: {len(records)} TN records")
        else:
            print(f"  ⚠️  {d}: no data")
        await asyncio.sleep(1.5)  # respect rate limit

    print(f"\n📊 Total real records fetched: {len(all_tn_records)}\n")

    # ── Step 2: Save real data per commodity ────────────────
    total_real = 0
    total_sim  = 0

    for commodity in TRACKED_COMMODITIES:
        res = supabase.table("commodities").select("id").eq("name", commodity).execute()
        if not res.data:
            continue
        commodity_id = res.data[0]["id"]
        aliases = COMMODITY_MAP.get(commodity, [commodity])
        rows = []

        # Match real records for this commodity
        matched = [
            rec for rec in all_tn_records
            if any(
                alias.lower() == str(rec.get("commodity","")).lower()
                for alias in aliases
            )
        ]

        for rec in matched:
            modal = float(rec.get("modal_price", 0))
            if modal <= 0:
                continue
            price_kg = round(modal / 100, 2)
            if not (1 < price_kg < 500):
                continue

            # Parse date
            try:
                from datetime import datetime
                rec_date = datetime.strptime(rec["arrival_date"], "%d/%m/%Y").date()
            except:
                rec_date = today

            rows.append({
                "commodity_id":   commodity_id,
                "price":          price_kg,
                "min_price":      round(float(rec.get("min_price", modal*0.9)) / 100, 2),
                "max_price":      round(float(rec.get("max_price", modal*1.1)) / 100, 2),
                "mandi_name":     str(rec.get("market", "Unknown")),
                "mandi_location": str(rec.get("district", "")),
                "state":          "Tamil Nadu",
                "recorded_at":    rec_date.isoformat(),
                "source":         "agmarknet_gov_in",
            })

        real_count = len(rows)
        total_real += real_count

        # Fill 90 days simulated history for chart continuity
        base = BASE_PRICES_KG.get(commodity, 30)
        np.random.seed(hash(commodity) % 2**31)
        sim_rows = []
        for day_offset in range(90):
            record_date = today - timedelta(days=90 - day_offset)
            if record_date >= today - timedelta(days=30):
                continue  # real data covers recent days
            price = base * (1 + float(np.random.uniform(-0.04, 0.04)))
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

        all_rows = rows + sim_rows
        total_sim += len(sim_rows)

        # Upsert
        for i in range(0, len(all_rows), 200):
            supabase.table("price_data").upsert(
                all_rows[i:i+200],
                on_conflict="commodity_id,mandi_name,recorded_at"
            ).execute()

        status = "🌐 LIVE" if real_count > 0 else "📊 sim "
        print(f"  {status} | {commodity:15} | {real_count:3} real records | {len(sim_rows)} simulated")

    print(f"\n{'='*55}")
    print(f"🌐 Real govt records : {total_real}")
    print(f"📊 Simulated records : {total_sim}")
    if total_real > 0:
        print(f"🎉 Real data from Agmarknet saved successfully!")
    print(f"\n🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
