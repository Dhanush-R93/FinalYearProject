"""
seed_prices.py — Fast parallel fetch of 90 days real data
Run once: py -3.11 seed_prices.py
"""
import asyncio
import numpy as np
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES
from services.daily_fetcher import (
    fetch_days_parallel, build_rows, save_batch_to_db,
    KEEP_DAYS, _failed_dates
)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_PRICES_KG = {
    "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
    "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
    "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
    "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
}

async def seed():
    print("="*55)
    print("🚀 AgriPrice Fast Seed — Parallel 90-day fetch")
    print("="*55)

    today = date.today()

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}
    print(f"✅ {len(commodity_ids)} commodities found\n")

    # Check existing dates
    existing_res = supabase.table("price_data")\
        .select("recorded_at")\
        .eq("source", "agmarknet_gov_in")\
        .execute()
    existing_dates = set(row["recorded_at"] for row in (existing_res.data or []))
    print(f"📅 Already in DB: {len(existing_dates)} dates")

    # Find missing dates
    missing_dates = [
        today - timedelta(days=i)
        for i in range(KEEP_DAYS)
        if (today - timedelta(days=i)).isoformat() not in existing_dates
    ]
    print(f"📥 Missing dates: {len(missing_dates)}\n")

    if not missing_dates:
        print("✅ All 90 days already in DB!")
        return

    # Calculate estimated time
    batches = (len(missing_dates) + 4) // 5
    est_seconds = batches * 3
    print(f"⏱️  Estimated time: ~{est_seconds}s ({est_seconds//60}min {est_seconds%60}s)")
    print(f"📡 Fetching {len(missing_dates)} days (5 at a time)...\n")

    start = datetime.now()

    # Fetch all in parallel
    all_results = await fetch_days_parallel(missing_dates)

    # Build and save all rows
    all_rows = []
    success_count = 0
    fail_count = 0

    for d, records in all_results.items():
        if records:
            rows = build_rows(records, commodity_ids, d)
            all_rows.extend(rows)
            success_count += 1
        else:
            fail_count += 1

    print(f"\n💾 Saving {len(all_rows)} rows to Supabase...")
    total_saved = save_batch_to_db(supabase, all_rows)

    elapsed = (datetime.now() - start).seconds

    # Fill remaining gaps with simulated data
    if fail_count > 0:
        print(f"\n🔧 Filling {fail_count} failed days with interpolated data...")
        from services.gap_filler import fill_gaps
        filled = fill_gaps(supabase, KEEP_DAYS)
        print(f"  ✅ {filled} days gap-filled")

    # Delete old records
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    supabase.table("price_data").delete().lt("recorded_at", cutoff).execute()

    print(f"\n{'='*55}")
    print(f"⏱️  Total time    : {elapsed}s ({elapsed//60}min {elapsed%60}s)")
    print(f"✅ Days fetched  : {success_count}")
    print(f"⚠️  Days failed   : {fail_count} (gap-filled)")
    print(f"💾 Records saved : {total_saved}")
    print(f"\n🔄 Refresh http://localhost:8080!")

if __name__ == "__main__":
    asyncio.run(seed())
