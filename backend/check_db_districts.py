from dotenv import load_dotenv
load_dotenv()
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get all distinct districts
res = supabase.table("price_data")\
    .select("mandi_location, mandi_name")\
    .eq("source", "agmarknet_gov_in")\
    .limit(500)\
    .execute()

districts = {}
for row in res.data:
    dist = row["mandi_location"]
    mandi = row["mandi_name"]
    if dist not in districts:
        districts[dist] = set()
    districts[dist].add(mandi)

print(f"Total districts: {len(districts)}")
for dist, mandis in sorted(districts.items()):
    print(f"  {dist}: {len(mandis)} mandis — {list(mandis)[:3]}")
