import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

print("Fetching ALL Tamil Nadu records today (limit=1000)...")
r = httpx.get(url, params={
    "api-key": key,
    "format": "json",
    "limit": 1000,
    "filters[arrival_date]": "13/03/2026"
}, timeout=120)

data = r.json()
records = data.get("records", [])

# Filter Tamil Nadu
tn = [r for r in records if "Tamil" in str(r.get("state",""))]
print(f"Total TN records today: {len(tn)}")

# Find Onion
onion = [r for r in tn if "onion" in str(r.get("commodity","")).lower()]
print(f"\nOnion records in TN: {len(onion)}")
for rec in onion:
    price_kg = round(float(rec.get("modal_price",0))/100, 2)
    print(f"  {rec.get('market')} | {rec.get('district')} | ₹{price_kg}/kg")

# Show all TN commodities available
commodities = sorted(set(r.get("commodity","") for r in tn))
print(f"\nAll commodities available in TN today:")
for c in commodities:
    print(f"  {c}")
