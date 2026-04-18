"""Check if API key is rate limited and test without date filter"""
import httpx
import asyncio

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test():
    async with httpx.AsyncClient(timeout=30) as client:

        # Test 1: No date filter — how many total records?
        print("Test 1: No filter (total available)")
        r = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 5,
        })
        d = r.json()
        print(f"  Total: {d.get('total')} | Records: {len(d.get('records',[]))}")
        if d.get('records'):
            print(f"  States: {set(r.get('state','') for r in d['records'])}")

        await asyncio.sleep(1)

        # Test 2: Filter by TN state directly
        print("\nTest 2: Filter by Tamil Nadu state")
        r2 = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 10,
            "filters[state]": "Tamil Nadu",
        })
        d2 = r2.json()
        print(f"  Total: {d2.get('total')} | Records: {len(d2.get('records',[]))}")
        if d2.get('records'):
            print(f"  Sample: {d2['records'][0]}")

        await asyncio.sleep(1)

        # Test 3: Filter TN + date
        print("\nTest 3: Filter TN + specific date")
        r3 = await client.get(URL, params={
            "api-key": API_KEY, "format": "json", "limit": 10,
            "filters[state]": "Tamil Nadu",
            "filters[arrival_date]": "16/04/2026",
        })
        d3 = r3.json()
        print(f"  Total: {d3.get('total')} | Records: {len(d3.get('records',[]))}")
        if d3.get('records'):
            print(f"  Sample: {d3['records'][0]}")
        
        # Test 4: Check API message/error
        print(f"\nAPI message field: {d.get('message','none')}")
        print(f"API status field: {d.get('status','none')}")

asyncio.run(test())
