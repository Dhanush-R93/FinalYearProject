"""Test correct filter format for Tamil Nadu"""
import httpx
import asyncio

API_KEY = "579b464db66ec23bdd000001cac9e21c88cc4f8253367423518fcba0"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test():
    async with httpx.AsyncClient(timeout=30) as client:

        # Test 1: No filter — check total
        print("Test 1: No filter")
        r = await client.get(URL, params={"api-key": API_KEY, "format": "json", "limit": 3})
        d = r.json()
        print(f"  Total: {d.get('total')} | States seen: {set(r.get('state','') for r in d.get('records',[]))}")
        await asyncio.sleep(1)

        # Test 2: state.keyword filter
        print("\nTest 2: filters[state.keyword]=Tamil Nadu")
        r2 = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 5,
            "filters[state.keyword]": "Tamil Nadu",
        })
        d2 = r2.json()
        print(f"  Total: {d2.get('total')} | Records: {len(d2.get('records',[]))}")
        await asyncio.sleep(1)

        # Test 3: date only, no state filter
        print("\nTest 3: Date filter only (no state)")
        r3 = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 10,
            "filters[arrival_date]": "16/04/2026",
        })
        d3 = r3.json()
        records = d3.get('records', [])
        tn = [x for x in records if "Tamil" in str(x.get("state",""))]
        print(f"  Total: {d3.get('total')} | TN in first 10: {len(tn)}")
        if records:
            print(f"  States: {set(x.get('state','') for x in records)}")
        await asyncio.sleep(1)

        # Test 4: Try with api-key as query string directly
        print("\nTest 4: All records, check actual total")
        r4 = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 1, "offset": 0,
        })
        d4 = r4.json()
        print(f"  Grand total in DB: {d4.get('total')}")

asyncio.run(test())
