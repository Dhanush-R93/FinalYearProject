"""Test multiple dates to see which ones have TN data"""
import httpx
import asyncio
from datetime import date, timedelta

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test_date(client, d: date):
    date_str = d.strftime("%d/%m/%Y")
    try:
        r = await client.get(URL, params={
            "api-key": API_KEY,
            "format": "json",
            "limit": 100,
            "offset": 0,
            "filters[arrival_date]": date_str,
        })
        data = r.json()
        total = int(data.get("total", 0))
        records = data.get("records", [])
        tn = [r for r in records if "Tamil" in str(r.get("state",""))]
        return total, len(tn)
    except Exception as e:
        return -1, str(e)

async def test():
    today = date.today()
    print(f"{'Date':<15} {'Total':>8} {'TN in 100':>12}")
    print("-" * 40)
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(7):
            d = today - timedelta(days=i)
            total, tn = await test_date(client, d)
            print(f"{d.isoformat():<15} {total:>8} {str(tn):>12}")
            await asyncio.sleep(0.5)

asyncio.run(test())
