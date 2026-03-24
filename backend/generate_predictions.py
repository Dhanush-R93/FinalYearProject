"""
generate_predictions.py
Generates 10-day predictions using real price data from DB
Run: py -3.11 generate_predictions.py
"""
import asyncio
import numpy as np
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def holt_winters(prices: list, steps: int = 10) -> list:
    """Holt-Winters Triple Exponential Smoothing"""
    if len(prices) < 7:
        avg = np.mean(prices) if prices else 30
        return [round(float(avg), 2)] * steps

    alpha, beta, gamma = 0.35, 0.10, 0.25
    season_len = 7

    level = np.mean(prices[:season_len])
    trend = (np.mean(prices[season_len:min(2*season_len, len(prices))]) - level) / season_len
    seasonal = []
    for i in range(season_len):
        s = prices[i] / level if level > 0 else 1.0
        seasonal.append(s)

    for i in range(season_len, len(prices)):
        prev_level = level
        prev_trend = trend
        s_idx = i % season_len
        obs = prices[i]
        denom = seasonal[s_idx] if seasonal[s_idx] != 0 else 1
        level = alpha * (obs / denom) + (1-alpha) * (prev_level + prev_trend)
        trend = beta * (level - prev_level) + (1-beta) * prev_trend
        seasonal[s_idx] = gamma * (obs / level) + (1-gamma) * seasonal[s_idx]

    forecasts = []
    for h in range(1, steps+1):
        s_idx = (len(prices) + h - 1) % season_len
        fc = (level + trend * h) * seasonal[s_idx]
        forecasts.append(max(round(float(fc), 2), 1.0))
    return forecasts

async def generate():
    print("🔮 Generating 10-day predictions from REAL price data...\n")
    today = date.today()

    # Clear old predictions
    supabase.table("predictions").delete().lt(
        "prediction_date", today.isoformat()
    ).execute()

    # Get all commodities
    comm_res = supabase.table("commodities").select("id,name").execute()
    total = 0

    for comm in comm_res.data:
        commodity_id = comm["id"]
        commodity_name = comm["name"]

        # Get last 30 days of REAL prices from DB
        price_res = supabase.table("price_data")\
            .select("price, recorded_at, mandi_name")\
            .eq("commodity_id", commodity_id)\
            .in_("source", ["agmarknet_gov_in", "interpolated"])\
            .order("recorded_at", desc=False)\
            .execute()

        if price_res.data and len(price_res.data) >= 3:
            # Use real prices — average per day across all mandis
            from collections import defaultdict
            daily = defaultdict(list)
            for row in price_res.data:
                daily[row["recorded_at"]].append(float(row["price"]))
            # Fix: extract values list correctly
            prices = [float(np.mean(list(v))) for k, v in sorted(daily.items(), key=lambda x: x[0])]
            current_price = prices[-1]
            data_source = "real"
        else:
            # Fallback to base price
            BASE = {
                "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
                "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
                "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
                "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
            }
            base = BASE.get(commodity_name, 30)
            np.random.seed(hash(commodity_name) % 2**31)
            prices = [base * (1 + float(np.random.uniform(-0.03, 0.03))) for _ in range(14)]
            current_price = base
            data_source = "simulated"

        # Generate 10-day forecast
        forecasts = holt_winters(prices, steps=10)

        rows = []
        for i, pred_price in enumerate(forecasts):
            pred_date = today + timedelta(days=i+1)
            confidence = round(0.92 - (i * 0.015), 3)
            uncertainty = 0.03 + (i * 0.005)
            rows.append({
                "commodity_id":    commodity_id,
                "prediction_date": pred_date.isoformat(),
                "predicted_price": pred_price,
                "confidence_lower": round(pred_price * (1-uncertainty), 2),
                "confidence_upper": round(pred_price * (1+uncertainty), 2),
                "confidence_score": confidence,
                "model_version":   "holt_winters_v2",
                "horizon_days":    i+1,
            })

        # Upsert predictions
        supabase.table("predictions").upsert(
            rows, on_conflict="commodity_id,prediction_date"
        ).execute()

        total += len(rows)
        direction = "📈" if forecasts[0] > current_price else "📉"
        print(f"  ✅ {commodity_name:15} | Current: ₹{current_price:.1f} → Day1: ₹{forecasts[0]:.1f} | Day10: ₹{forecasts[9]:.1f} {direction} [{data_source}]")

    print(f"\n✅ {total} predictions saved!")
    print("🔄 Refresh http://localhost:8080 → Predictions page")

if __name__ == "__main__":
    asyncio.run(generate())
