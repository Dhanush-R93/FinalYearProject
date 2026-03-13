import httpx
import time

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Test: Get today's data without any filters - fastest query
print("Testing without filters (fastest)...")
start = time.time()
r = httpx.get(url, params={
    "api-key": key,
    "format": "json",
    "limit": 10,
    "filters[arrival_date]": "13/03/2026"
}, timeout=120)
elapsed = time.time() - start
print(f"Time: {elapsed:.1f}s | Status: {r.status_code}")

data = r.json()
print(f"Total records today: {data.get('total', 0)}")
for rec in data.get("records", [])[:5]:
    price_kg = round(float(rec.get("modal_price", 0)) / 100, 2)
    print(f"  {rec.get('state')} | {rec.get('market')} | {rec.get('commodity')} | ₹{price_kg}/kg")
