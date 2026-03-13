import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
params = {
    "api-key": key,
    "format": "json",
    "limit": 5,
    "filters[Commodity]": "Tomato",
    "filters[State]": "Tamil Nadu"
}

r = httpx.get(url, params=params)
print(f"Status: {r.status_code}")

if r.status_code == 200:
    data = r.json()
    print("API KEY WORKS!")
    print(f"Total records: {data.get('total', 0)}")
    records = data.get("records", [])
    if records:
        print(f"Sample: {records[0]}")
    else:
        print("No records found")
elif r.status_code == 403:
    print("FAILED - 403 API key blocked or rate limited")
elif r.status_code == 401:
    print("FAILED - 401 Invalid API key")
else:
    print(f"Error: {r.text[:300]}")
