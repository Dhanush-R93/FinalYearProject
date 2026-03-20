"""
gap_filler.py
When API fails for a particular day, fill the gap using:
1. Linear interpolation between previous and next day prices
2. If only one side available, use that day's price ±small variation
3. Mark filled data as "interpolated" source
"""
import logging
import numpy as np
from datetime import date, timedelta
from supabase import Client

logger = logging.getLogger(__name__)

COMMODITY_MAP = {
    "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
    "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
    "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
    "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
}

def fill_gaps(supabase: Client, keep_days: int = 90):
    """
    Find days with no real data and fill with interpolated values.
    Called after incremental fetch completes.
    """
    today = date.today()
    logger.info("🔧 Checking for gaps in price data...")

    # Get all commodities
    comm_res = supabase.table("commodities").select("id,name").execute()
    commodities = {c["id"]: c["name"] for c in (comm_res.data or [])}

    total_filled = 0

    for commodity_id, commodity_name in commodities.items():
        base_price = COMMODITY_MAP.get(commodity_name, 30)

        # Get all real data for this commodity (last 90 days)
        from_date = (today - timedelta(days=keep_days)).isoformat()
        res = supabase.table("price_data")\
            .select("price, recorded_at")\
            .eq("commodity_id", commodity_id)\
            .eq("mandi_name", "Koyambedu")\
            .in_("source", ["agmarknet_gov_in", "interpolated"])\
            .gte("recorded_at", from_date)\
            .order("recorded_at")\
            .execute()

        existing = {row["recorded_at"]: float(row["price"]) for row in (res.data or [])}

        # Find missing dates
        missing = []
        for i in range(keep_days):
            d = (today - timedelta(days=keep_days - i)).isoformat()
            if d not in existing:
                missing.append(d)

        if not missing:
            continue

        # Fill each missing date using interpolation
        filled = 0
        for missing_date in missing:
            # Find nearest previous price
            prev_price = None
            for i in range(1, 8):
                prev_d = (date.fromisoformat(missing_date) - timedelta(days=i)).isoformat()
                if prev_d in existing:
                    prev_price = existing[prev_d]
                    break

            # Find nearest next price
            next_price = None
            for i in range(1, 8):
                next_d = (date.fromisoformat(missing_date) + timedelta(days=i)).isoformat()
                if next_d in existing:
                    next_price = existing[next_d]
                    break

            # Calculate interpolated price
            if prev_price and next_price:
                # Linear interpolation between prev and next
                interp_price = round((prev_price + next_price) / 2, 2)
            elif prev_price:
                # Only previous day available — small random variation
                np.random.seed(hash(missing_date + commodity_name) % 2**31)
                interp_price = round(prev_price * (1 + float(np.random.uniform(-0.02, 0.02))), 2)
            elif next_price:
                # Only next day available
                np.random.seed(hash(missing_date + commodity_name) % 2**31)
                interp_price = round(next_price * (1 + float(np.random.uniform(-0.02, 0.02))), 2)
            else:
                # No nearby data — use base price
                interp_price = float(base_price)

            # Save interpolated row
            row = {
                "commodity_id":   commodity_id,
                "price":          interp_price,
                "min_price":      round(interp_price * 0.92, 2),
                "max_price":      round(interp_price * 1.08, 2),
                "mandi_name":     "Koyambedu",
                "mandi_location": "Chennai",
                "state":          "Tamil Nadu",
                "recorded_at":    missing_date,
                "source":         "interpolated",  # clearly marked
            }
            try:
                supabase.table("price_data").insert(row).execute()
                existing[missing_date] = interp_price  # update local cache
                filled += 1
            except Exception as e:
                err = str(e)
                if "duplicate" not in err.lower() and "21000" not in err:
                    logger.warning(f"Gap fill error: {err[:60]}")

        if filled > 0:
            total_filled += filled
            logger.info(f"  🔧 {commodity_name}: filled {filled} missing days")

    if total_filled > 0:
        logger.info(f"✅ Gap filling complete: {total_filled} days interpolated")
    else:
        logger.info("✅ No gaps found — data is complete!")

    return total_filled
