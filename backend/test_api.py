import httpx

key = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Check total TN records for one day and how many pages
print("Checking total records and pagination for Tamil Nadu...")
r = httpx.get(url, params={
    "api-key": key,
    "format":  "json",
    "limit":   1,
    "offset":  0,
    "filters[arrival_date]": "13/03/2026",
}, timeout=60)
data = r.json()
total = int(data.get("total", 0))
print(f"Total ALL India records: {total}")
print(f"Pages needed (1000/page): {(total // 1000) + 1}")

# Check TN specifically
r2 = httpx.get(url, params={
    "api-key": key,
    "format":  "json",
    "limit":   1000,
    "offset":  0,
    "filters[arrival_date]": "13/03/2026",
}, timeout=60)
data2 = r2.json()
all_records = data2.get("records", [])
tn = [r for r in all_records if "Tamil" in str(r.get("state",""))]
print(f"\nPage 1 (offset 0): {len(all_records)} total | {len(tn)} Tamil Nadu")

# Check if there are more pages
r3 = httpx.get(url, params={
    "api-key": key,
    "format":  "json",
    "limit":   1000,
    "offset":  1000,
    "filters[arrival_date]": "13/03/2026",
}, timeout=60)
data3 = r3.json()
records3 = data3.get("records", [])
tn3 = [r for r in records3 if "Tamil" in str(r.get("state",""))]
print(f"Page 2 (offset 1000): {len(records3)} total | {len(tn3)} Tamil Nadu")

# All unique TN markets
all_tn = tn + tn3
markets = sorted(set(r.get("market","") for r in all_tn))
print(f"\nTotal unique TN markets: {len(markets)}")
for m in markets:
    print(f"  {m}")
