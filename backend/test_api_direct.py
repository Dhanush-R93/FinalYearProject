"""Quick test to see exact error from data.gov.in API"""
import httpx
import asyncio

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test():
    print("Testing data.gov.in API...")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(URL, params={
                "api-key": API_KEY,
                "format": "json",
                "limit": 5,
                "filters[arrival_date]": "18/04/2026",
            })
            print(f"Status: {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"Error type: {type(e).__name__}")
        print(f"Error: {e}")

asyncio.run(test())
