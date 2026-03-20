"""Test if we can save to price_data table"""
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL: {SUPABASE_URL}")
print(f"Key: {SUPABASE_KEY[:20]}...")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get one commodity ID
res = supabase.table("commodities").select("id,name").eq("name","Tomato").execute()
print(f"\nCommodities result: {res.data}")

if not res.data:
    print("ERROR: No commodities found!")
else:
    commodity_id = res.data[0]["id"]
    print(f"Tomato ID: {commodity_id}")

    # Try inserting one test row
    test_row = {
        "commodity_id":   commodity_id,
        "price":          42.50,
        "min_price":      38.00,
        "max_price":      47.00,
        "mandi_name":     "Test Market",
        "mandi_location": "Chennai",
        "state":          "Tamil Nadu",
        "recorded_at":    "2026-03-20",
        "source":         "agmarknet_gov_in",
    }

    print(f"\nTrying to insert test row...")
    try:
        result = supabase.table("price_data").insert(test_row).execute()
        print(f"✅ INSERT SUCCESS: {result.data}")
    except Exception as e:
        print(f"❌ INSERT FAILED: {e}")

    # Try upsert
    print(f"\nTrying upsert...")
    try:
        result = supabase.table("price_data").upsert(
            test_row,
            on_conflict="commodity_id,mandi_name,recorded_at"
        ).execute()
        print(f"✅ UPSERT SUCCESS: {result.data}")
    except Exception as e:
        print(f"❌ UPSERT FAILED: {e}")

    # Check if row exists now
    check = supabase.table("price_data").select("*").eq("mandi_name","Test Market").execute()
    print(f"\nRows in DB: {len(check.data)}")
    if check.data:
        print(f"Row: {check.data[0]}")
