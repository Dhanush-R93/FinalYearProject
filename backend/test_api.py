import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Test 1: Get 1 record and print ALL field names
print("=== Checking exact field names ===")
r = httpx.get(url, params={
    "api-key": key,
    "format": "json",
    "limit": 1
}, timeout=60)

data = r.json()
print(f"Total records: {data.get('total', 0)}")
if data.get("records"):
    rec = data["records"][0]
    print("\nAll field names in this dataset:")
    for key_name, value in rec.items():
        print(f"  {key_name}: {value}")
else:
    print("No records — trying different approach")
    print(r.text[:500])
