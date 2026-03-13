import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Get all today's data and filter Tamil Nadu locally
print("Fetching all today records and filtering TN locally...")
r = httpx.get(url, params={
    "api-key": key,
    "format": "json",
    "limit": 500,
    "filters[arrival_date]": "13/03/2026"
}, timeout=120)

data = r.json()
records = data.get("records", [])
print(f"Total fetched: {len(records)}")

# Filter Tamil Nadu locally
tn_records = [r for r in records if "Tamil" in str(r.get("state",""))]
print(f"Tamil Nadu records: {len(tn_records)}")
for rec in tn_records[:10]:
    price_kg = round(float(rec.get("modal_price", 0)) / 100, 2)
    print(f"  {rec.get('commodity')} | {rec.get('market')} | ₹{price_kg}/kg")

# Also check what states are available
states = list(set(r.get("state","") for r in records))
print(f"\nAvailable states: {sorted(states)}")
