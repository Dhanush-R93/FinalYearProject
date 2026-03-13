import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Test 1: No filters - just get any data
print("=== Test 1: Any data available? ===")
r = httpx.get(url, params={"api-key": key, "format": "json", "limit": 3})
data = r.json()
print(f"Status: {r.status_code}")
print(f"Total records in DB: {data.get('total', 0)}")
if data.get("records"):
    rec = data["records"][0]
    print(f"Sample State: {rec.get('State','?')}")
    print(f"Sample Commodity: {rec.get('Commodity','?')}")
    print(f"Sample Market: {rec.get('Market','?')}")
    print(f"Sample Date: {rec.get('Arrival_Date','?')}")
    print(f"Sample Price: {rec.get('Modal_x0020_Price','?')}")

# Test 2: Tomato without state
print("\n=== Test 2: Tomato - all states ===")
r2 = httpx.get(url, params={
    "api-key": key, "format": "json", "limit": 3,
    "filters[Commodity]": "Tomato"
})
data2 = r2.json()
print(f"Total Tomato records: {data2.get('total', 0)}")
if data2.get("records"):
    for rec in data2["records"][:3]:
        print(f"  {rec.get('State')} | {rec.get('Market')} | ₹{rec.get('Modal_x0020_Price')} | {rec.get('Arrival_Date')}")

# Test 3: Check available states
print("\n=== Test 3: What states have data? ===")
r3 = httpx.get(url, params={
    "api-key": key, "format": "json", "limit": 10,
    "filters[State]": "Tamil Nadu"
})
data3 = r3.json()
print(f"Tamil Nadu total records: {data3.get('total', 0)}")
if data3.get("records"):
    for rec in data3["records"][:3]:
        print(f"  {rec.get('Commodity')} | {rec.get('Market')} | {rec.get('Arrival_Date')}")
