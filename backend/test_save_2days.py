"""
Test: Fetch and save only last 2 days - fixed date format
"""
import asyncio
import httpx
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    "Beans":        ["Beans", "Cluster beans"],
    "Capsicum":     ["Capsicum"],
    "Lady Finger":  ["Bhindi(Ladies Finger)"],
    "Bitter Gourd": ["Bitter gourd"],
    "Bottle Gourd": ["Bottle gourd"],
    "Drumstick":    ["Drumstick"],
    "Pumpkin":      ["Pumpkin"],
    "Spinach":      ["Amaranthus"],
}

async def run():
    today = date.today()
    print(f"🧪 Testing save for last 2 days\n")

    # Clear old test data first
    supabase.table("price_data").delete().eq("source","agmarknet_gov_in").execute()
    print("✅ Cleared old real data\n")

    # Get commodity IDs
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodity_ids = {c["name"]: c["id"] for c in comm_res.data}

    total_saved = 0

    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(2):
            d = today - timedelta(days=i)
            print(f"📡 Fetching {d}...")

            try:
                r = await client.get(URL, params={
                    "api-key": API_KEY,
                    "format":  "json",
                    "limit":   1000,
                    "filters[arrival_date]": d.strftime("%d/%m/%Y"),
                })
                r.raise_for_status()
                all_records = r.json().get("records", [])
                tn = [rec for rec in all_records if "Tamil" in str(rec.get("state",""))]
                print(f"   Fetched: {len(tn)} TN records")
            except Exception as e:
                print(f"   ❌ {e}")
                continue

            rows = []
            for rec in tn:
                rec_commodity = str(rec.get("commodity",""))
                modal = float(rec.get("modal_price", 0) or 0)
                if modal <= 0:
                    continue
                price_kg = round(modal / 100, 2)
                if not (1 < price_kg < 500):
                    continue

                # Fix: parse date correctly as plain date string YYYY-MM-DD
                try:
                    rec_date = datetime.strptime(
                        rec.get("arrival_date",""), "%d/%m/%Y"
                    ).strftime("%Y-%m-%d")  # store as plain string
                except:
                    rec_date = d.isoformat()

                mandi_name = str(rec.get("market","Unknown"))[:100]
                variety = str(rec.get("variety","")).strip()
                if variety and variety.lower() not in ("other","faq","mixed",""):
                    mandi_name = f"{mandi_name} ({variety})"

                for commodity, aliases in COMMODITY_MAP.items():
                    if any(alias.lower() == rec_commodity.lower() for alias in aliases):
                        cid = commodity_ids.get(commodity)
                        if cid:
                            rows.append({
                                "commodity_id":   cid,
                                "price":          price_kg,
                                "min_price":      round(float(rec.get("min_price") or modal*0.9)/100, 2),
                                "max_price":      round(float(rec.get("max_price") or modal*1.1)/100, 2),
                                "mandi_name":     mandi_name[:100],
                                "mandi_location": str(rec.get("district",""))[:100],
                                "state":          "Tamil Nadu",
                                "recorded_at":    rec_date,  # plain YYYY-MM-DD
                                "source":         "agmarknet_gov_in",
                            })
                        break

            # Deduplicate
            seen = set()
            unique = []
            for row in rows:
                key = (row["commodity_id"], row["mandi_name"], row["recorded_at"])
                if key not in seen:
                    seen.add(key)
                    unique.append(row)

            print(f"   Built: {len(unique)} unique rows for {d}")

            # Save
            saved = 0
            for row in unique:
                try:
                    supabase.table("price_data").insert(row).execute()
                    saved += 1
                except Exception as e:
                    err = str(e)
                    if "duplicate" not in err.lower() and "21000" not in err:
                        print(f"   ❌ {err[:80]}")
            print(f"   ✅ Saved: {saved} rows for {d}")
            total_saved += saved

    # Verify both dates in DB
    print(f"\n{'='*50}")
    print(f"💾 Total saved: {total_saved}")

    for i in range(2):
        d = (today - timedelta(days=i)).isoformat()
        check = supabase.table("price_data")\
            .select("id")\
            .eq("source","agmarknet_gov_in")\
            .eq("recorded_at", d)\
            .execute()
        print(f"  {d}: {len(check.data)} records in DB")

    # Show sample
    sample = supabase.table("price_data")\
        .select("recorded_at, price, mandi_name, commodities(name)")\
        .eq("source","agmarknet_gov_in")\
        .order("recorded_at", desc=True)\
        .limit(6)\
        .execute()
    print(f"\nSample:")
    for row in sample.data:
        name = row.get("commodities",{}).get("name","?")
        print(f"  {row['recorded_at']} | {name} | {row['mandi_name'][:30]} | ₹{row['price']}/kg")

asyncio.run(run())
