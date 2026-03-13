import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

print("=== Testing REAL data fetch with correct field names ===")
params = {
    "api-key": key,
    "format": "json",
    "limit": 5,
    "filters[commodity]": "Tomato",
    "filters[state]": "Tamil Nadu",
}

r = httpx.get(url, params=params, timeout=60)
data = r.json()
print(f"Status: {r.status_code}")
print(f"Total Tomato records in Tamil Nadu: {data.get('total', 0)}")

if data.get("records"):
    print("\nReal records:")
    for rec in data["records"]:
        price_kg = round(float(rec.get("modal_price", 0)) / 100, 2)
        print(f"  {rec.get('market')} | {rec.get('arrival_date')} | ₹{rec.get('modal_price')}/quintal = ₹{price_kg}/kg")
else:
    # Try without state filter
    print("No TN data, trying all India...")
    params2 = {"api-key": key, "format": "json", "limit": 5, "filters[commodity]": "Tomato"}
    r2 = httpx.get(url, params=params2, timeout=60)
    data2 = r2.json()
    print(f"Total Tomato records all India: {data2.get('total', 0)}")
    for rec in data2.get("records", [])[:5]:
        price_kg = round(float(rec.get("modal_price", 0)) / 100, 2)
        print(f"  {rec.get('state')} | {rec.get('market')} | ₹{rec.get('modal_price')}/quintal = ₹{price_kg}/kg")
