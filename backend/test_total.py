import httpx

API_KEY = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Check total records for today and how many pages
r = httpx.get(URL, params={
    "api-key": API_KEY, "format": "json",
    "limit": 1, "offset": 0,
    "filters[arrival_date]": "07/04/2026",
}, timeout=60)
data = r.json()
total = int(data.get("total", 0))
print(f"Total ALL India records today: {total}")
print(f"Pages needed (1000/page): {(total // 1000) + 1}")

# Fetch page 1
r2 = httpx.get(URL, params={
    "api-key": API_KEY, "format": "json",
    "limit": 1000, "offset": 0,
    "filters[arrival_date]": "07/04/2026",
}, timeout=120)
recs1 = r2.json().get("records", [])
tn1 = [r for r in recs1 if "Tamil" in str(r.get("state",""))]
print(f"\nPage 1: {len(recs1)} total | {len(tn1)} TN")

# Fetch page 2
r3 = httpx.get(URL, params={
    "api-key": API_KEY, "format": "json",
    "limit": 1000, "offset": 1000,
    "filters[arrival_date]": "07/04/2026",
}, timeout=120)
recs2 = r3.json().get("records", [])
tn2 = [r for r in recs2 if "Tamil" in str(r.get("state",""))]
print(f"Page 2: {len(recs2)} total | {len(tn2)} TN")

# All TN commodities across both pages
all_tn = tn1 + tn2
our_commodities = set()
COMMODITY_MAP = {
    "Tomato":["Tomato"],"Onion":["Onion"],"Potato":["Potato"],
    "Brinjal":["Brinjal"],"Cabbage":["Cabbage"],"Cauliflower":["Cauliflower"],
    "Carrot":["Carrot"],"Beans":["Beans","Cluster beans"],
    "Capsicum":["Capsicum"],"Lady Finger":["Bhindi(Ladies Finger)"],
    "Bitter Gourd":["Bitter gourd"],"Bottle Gourd":["Bottle gourd"],
    "Drumstick":["Drumstick"],"Pumpkin":["Pumpkin"],"Spinach":["Amaranthus"],
}
for rec in all_tn:
    c = str(rec.get("commodity",""))
    for name, aliases in COMMODITY_MAP.items():
        if any(a.lower()==c.lower() for a in aliases):
            our_commodities.add(name)

print(f"\nTotal TN records: {len(all_tn)}")
print(f"Our commodities found: {our_commodities}")
print(f"Missing commodities: {set(COMMODITY_MAP.keys()) - our_commodities}")
