"""Check what arrival_date the API actually returns"""
import httpx
from datetime import date, timedelta

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Fetch 3 different dates and check what arrival_date comes back
for i in [0, 1, 2]:
    d = date.today() - timedelta(days=i)
    r = httpx.get(URL, params={
        "api-key": API_KEY,
        "format": "json",
        "limit": 3,
        "filters[arrival_date]": d.strftime("%d/%m/%Y"),
    }, timeout=60)
    records = r.json().get("records", [])
    tn = [rec for rec in records if "Tamil" in str(rec.get("state",""))]
    print(f"Queried: {d} → arrival_date in response: {[r.get('arrival_date') for r in tn[:3]]}")
