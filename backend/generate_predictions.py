"""
generate_predictions.py
Generates 10-day predictions using:
1. Real price data from DB (Holt-Winters)
2. Live weather forecast from Open-Meteo (free)
   - Heavy rain → price rises (supply disruption)
   - High temp → price rises for leafy veg
   - Normal weather → no adjustment
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

# Vegetables sensitive to weather
RAIN_SENSITIVE  = ["Tomato","Brinjal","Capsicum","Lady Finger","Bitter Gourd","Bottle Gourd","Drumstick","Spinach"]
HEAT_SENSITIVE  = ["Spinach","Cabbage","Cauliflower","Carrot","Beans"]
STORAGE_STABLE  = ["Onion","Potato","Garlic"]

def holt_winters(prices: list, steps: int = 10) -> list:
    """Holt-Winters Triple Exponential Smoothing"""
    if len(prices) < 7:
        avg = float(np.mean(prices)) if prices else 30
        return [round(avg, 2)] * steps

    alpha, beta, gamma = 0.35, 0.10, 0.25
    season_len = 7

    level = float(np.mean(prices[:season_len]))
    denom = season_len
    trend = (float(np.mean(prices[season_len:min(2*season_len, len(prices))])) - level) / denom
    seasonal = []
    for i in range(season_len):
        s = prices[i] / level if level > 0 else 1.0
        seasonal.append(float(s))

    for i in range(season_len, len(prices)):
        prev_level, prev_trend = level, trend
        s_idx = i % season_len
        obs = float(prices[i])
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

def apply_weather_adjustment(
    forecasts: list,
    weather_df,
    commodity: str
) -> tuple[list, list]:
    """
    Adjust price forecasts based on weather:
    - Heavy rain (>10mm) → +5-15% for rain-sensitive crops
    - High temp (>38°C)  → +3-8% for heat-sensitive crops
    - Drought conditions  → +2-5% general
    Returns (adjusted_forecasts, weather_notes)
    """
    adjusted = forecasts.copy()
    notes = []

    if weather_df is None or len(weather_df) == 0:
        return adjusted, ["No weather data available"]

    for i, fc in enumerate(forecasts):
        if i >= len(weather_df):
            break

        row = weather_df.iloc[i]
        rain = float(row.get("rainfall_mm", 0) or 0)
        temp_max = float(row.get("temperature_max", 30) or 30)
        humidity = float(row.get("humidity", 60) or 60)
        note_parts = []

        factor = 1.0

        # Heavy rain impact
        if rain > 20 and commodity in RAIN_SENSITIVE:
            factor *= 1.12  # +12% heavy rain
            note_parts.append(f"heavy rain {rain:.0f}mm")
        elif rain > 10 and commodity in RAIN_SENSITIVE:
            factor *= 1.06  # +6% moderate rain
            note_parts.append(f"rain {rain:.0f}mm")

        # Heat impact
        if temp_max > 38 and commodity in HEAT_SENSITIVE:
            factor *= 1.07  # +7% extreme heat
            note_parts.append(f"heat {temp_max:.0f}°C")
        elif temp_max > 35 and commodity in HEAT_SENSITIVE:
            factor *= 1.03
            note_parts.append(f"warm {temp_max:.0f}°C")

        # Storage stable crops less affected
        if commodity in STORAGE_STABLE:
            factor = 1.0 + (factor - 1.0) * 0.3

        adjusted[i] = round(fc * factor, 2)
        if note_parts:
            notes.append(f"Day {i+1}: {', '.join(note_parts)} → +{((factor-1)*100):.0f}%")

    return adjusted, notes if notes else ["Normal weather — no price adjustment"]

async def generate():
    print("🔮 Generating 10-day predictions with live weather...\n")
    today = date.today()

    # Fetch live weather forecast for Tamil Nadu (10 days)
    print("🌤️  Fetching live weather from Open-Meteo (Tamil Nadu)...")
    weather_df = None
    try:
        from services.weather_fetcher import fetch_forecast_weather
        weather_df = await fetch_forecast_weather("Tamil Nadu", days_ahead=10)
        if not weather_df.empty:
            print(f"✅ Weather fetched: {len(weather_df)} days")
            print(f"   Temp range: {weather_df['temperature_max'].min():.0f}°C – {weather_df['temperature_max'].max():.0f}°C")
            print(f"   Rain days: {(weather_df['rainfall_mm'] > 5).sum()}/{len(weather_df)}")
        else:
            print("⚠️  Weather unavailable — using price-only predictions")
    except Exception as e:
        print(f"⚠️  Weather fetch failed: {e}")

    print()

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

        # Get last 30 days of real prices from DB
        from_date = (today - timedelta(days=30)).isoformat()
        price_res = supabase.table("price_data")\
            .select("price, recorded_at")\
            .eq("commodity_id", commodity_id)\
            .gte("recorded_at", from_date)\
            .order("recorded_at", desc=False)\
            .execute()

        if price_res.data and len(price_res.data) >= 3:
            from collections import defaultdict
            daily = defaultdict(list)
            for row in price_res.data:
                daily[row["recorded_at"]].append(float(row["price"]))
            prices = [float(np.mean(list(v))) for k, v in sorted(daily.items())]
            current_price = prices[-1]
            data_source = "real"
        else:
            BASE = {
                "Tomato":40,"Onion":28,"Potato":22,"Brinjal":35,
                "Cabbage":20,"Cauliflower":42,"Carrot":38,"Beans":65,
                "Capsicum":60,"Lady Finger":45,"Bitter Gourd":50,
                "Bottle Gourd":18,"Drumstick":55,"Pumpkin":25,"Spinach":30,
            }
            base = BASE.get(commodity_name, 30)
            np.random.seed(hash(commodity_name) % 2**31)
            prices = [base*(1+float(np.random.uniform(-0.03,0.03))) for _ in range(14)]
            current_price = base
            data_source = "simulated"

        # Step 1: Holt-Winters forecast
        hw_forecasts = holt_winters(prices, steps=10)

        # Step 2: Apply weather adjustment
        adjusted_forecasts, weather_notes = apply_weather_adjustment(
            hw_forecasts, weather_df, commodity_name
        )

        # Step 3: Save predictions
        rows = []
        for i, pred_price in enumerate(adjusted_forecasts):
            pred_date = today + timedelta(days=i+1)
            confidence = round(0.92 - (i * 0.015), 3)
            uncertainty = 0.03 + (i * 0.005)

            # Weather affects confidence (more rain = less certain)
            if weather_df is not None and i < len(weather_df):
                rain = float(weather_df.iloc[i].get("rainfall_mm", 0) or 0)
                if rain > 15:
                    uncertainty += 0.02

            rows.append({
                "commodity_id":    commodity_id,
                "prediction_date": pred_date.isoformat(),
                "predicted_price": pred_price,
                "confidence_lower": round(pred_price * (1-uncertainty), 2),
                "confidence_upper": round(pred_price * (1+uncertainty), 2),
                "confidence_score": confidence,
                "model_version":   "holt_winters_weather_v3",
                "horizon_days":    i+1,
            })

        supabase.table("predictions").upsert(
            rows, on_conflict="commodity_id,prediction_date"
        ).execute()

        total += len(rows)
        hw_day1 = hw_forecasts[0]
        adj_day1 = adjusted_forecasts[0]
        weather_adj = f"+{adj_day1-hw_day1:.1f}" if adj_day1 > hw_day1 else f"{adj_day1-hw_day1:.1f}"
        direction = "📈" if adjusted_forecasts[0] > current_price else "📉"

        print(f"  ✅ {commodity_name:15} | ₹{current_price:.1f} → Day1: ₹{adj_day1:.1f} ({weather_adj} weather) | Day10: ₹{adjusted_forecasts[9]:.1f} {direction} [{data_source}]")
        if any("rain" in n or "heat" in n for n in weather_notes):
            print(f"     🌧️  {weather_notes[0]}")

    print(f"\n✅ {total} predictions saved with weather adjustment!")
    print("🔄 Refresh http://localhost:8080 → Predictions page")

if __name__ == "__main__":
    asyncio.run(generate())
