import httpx, asyncio
from datetime import date, timedelta

API_KEY = "579b464db66ec23bdd000001cac9e21c88cc4f8253367423518fcba0"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

async def test():
    async with httpx.AsyncClient(timeout=30) as client:
        print("Checking last 7 days for TN data...\n")
        for i in range(7):
            d = date.today() - timedelta(days=i)
            r = await client.get(URL, params={
                "api-key": API_KEY, "format": "json",
                "limit": 100, "offset": 0,
                "filters[arrival_date]": d.strftime("%d/%m/%Y"),
            })
            data = r.json()
            total = int(data.get("total", 0))
            recs = data.get("records", [])
            tn = [x for x in recs if "Tamil" in str(x.get("state",""))]
            print(f"  {d}: total={total}, TN={len(tn)}")
            await asyncio.sleep(0.5)
        
        print("\nChecking total records in DB (no filter):")
        r2 = await client.get(URL, params={"api-key": API_KEY, "format": "json", "limit": 1})
        print(f"  Grand total: {r2.json().get('total')}")
        print(f"  Updated: {r2.json().get('updated_date')}")

asyncio.run(test())
