"""Test data.gov.in API and show why seed_prices fails"""
import httpx
import asyncio

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test():
    print("Testing data.gov.in API with records filter...")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(URL, params={
                "api-key": API_KEY,
                "format": "json",
                "limit": 10,
                "offset": 0,
                "filters[arrival_date]": "18/04/2026",
            })
            print(f"Status: {r.status_code}")
            data = r.json()
            total = data.get("total", 0)
            records = data.get("records", [])
            print(f"Total records: {total}")
            print(f"Records returned: {len(records)}")
            if records:
                print(f"First record: {records[0]}")
                tn = [r for r in records if "Tamil" in str(r.get("state",""))]
                print(f"TN records in first 10: {len(tn)}")
            else:
                print("NO RECORDS RETURNED — checking error:")
                print(data)
    except Exception as e:
        print(f"Error type: {type(e).__name__}")
        print(f"Error detail: {e}")

asyncio.run(test())
