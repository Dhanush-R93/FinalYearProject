"""
scheduler/daily_pipeline.py
────────────────────────────
APScheduler job that runs every day at 08:00 IST:
  1. Fetch fresh prices from data.gov.in (Agmarknet)
  2. Fetch weather from Open-Meteo
  3. Store in Supabase price_data table
  4. Retrain LSTM for any commodity with >30 new rows
  5. Run inference and store predictions in Supabase

Run standalone:
    python scheduler/daily_pipeline.py

Or the FastAPI app starts it automatically in the background.
"""

import asyncio
import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_KEY, TRACKED_COMMODITIES, SEQUENCE_LENGTH
from services.agmarknet_fetcher import fetch_agmarknet_prices, fetch_today_prices
from services.weather_fetcher import fetch_historical_weather, fetch_forecast_weather
from ml.data_preprocessing import prepare_dataset, load_scaler, inverse_transform_price
from ml.lstm_model import build_model, train_model, load_trained_model, predict_multistep
from ml.evaluation import compute_metrics

logger = logging.getLogger(__name__)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ──────────────────────────────────────────────────────────────
# Step 1: Ingest fresh Agmarknet data → Supabase
# ──────────────────────────────────────────────────────────────

async def ingest_daily_prices():
    """Fetch today's prices for all commodities and upsert into Supabase."""
    logger.info("🌾 Starting daily Agmarknet ingestion...")
    today = date.today()
    yesterday = today - timedelta(days=1)

    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                from_date=yesterday,
                to_date=today,
                limit=500,
            )
            if df.empty:
                logger.warning(f"No data for {commodity}")
                continue

            # Lookup commodity_id from Supabase
            res = supabase.table("commodities").select("id").eq("name", commodity).execute()
            if not res.data:
                logger.warning(f"Commodity '{commodity}' not in DB — skipping")
                continue

            commodity_id = res.data[0]["id"]
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "commodity_id":   commodity_id,
                    "price":          float(row.get("modal_price", 0)),
                    "min_price":      float(row.get("min_price", 0)),
                    "max_price":      float(row.get("max_price", 0)),
                    "mandi_name":     str(row.get("mandi", "Unknown")),
                    "mandi_location": str(row.get("district", "")),
                    "state":          str(row.get("state", "")),
                    "recorded_at":    row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                    "source":         "agmarknet_gov_in",
                })

            # Upsert (ignore duplicates)
            supabase.table("price_data").upsert(rows, on_conflict="commodity_id,mandi_name,recorded_at").execute()
            logger.info(f"✅ Inserted {len(rows)} rows for {commodity}")
            await asyncio.sleep(0.5)

        except Exception as e:
            logger.error(f"Ingestion failed for {commodity}: {e}", exc_info=True)


# ──────────────────────────────────────────────────────────────
# Step 2: Retrain LSTM models for each commodity
# ──────────────────────────────────────────────────────────────

async def retrain_models():
    """
    Pull last 365 days of data from Supabase,
    enrich with weather, retrain LSTM, store metrics.
    """
    logger.info("🤖 Starting daily model retraining...")
    from_date = date.today() - timedelta(days=365)

    for commodity in TRACKED_COMMODITIES:
        try:
            # Pull price history from Supabase
            res = (
                supabase.table("price_data")
                .select("price, min_price, max_price, recorded_at, state")
                .eq("commodity_id", _get_commodity_id(commodity))
                .gte("recorded_at", from_date.isoformat())
                .order("recorded_at")
                .execute()
            )
            if not res.data or len(res.data) < SEQUENCE_LENGTH + 10:
                logger.warning(f"Not enough data to train for {commodity} ({len(res.data or [])} rows)")
                continue

            import pandas as pd
            price_df = pd.DataFrame(res.data)
            price_df["date"]         = pd.to_datetime(price_df["recorded_at"])
            price_df["modal_price"]  = price_df["price"].astype(float)

            # Fetch weather for dominant state
            dominant_state = price_df["state"].mode()[0] if "state" in price_df.columns else "India"
            weather_df = await fetch_historical_weather(
                state=dominant_state,
                from_date=from_date,
                to_date=date.today(),
            )

            X_train, X_test, y_train, y_test, scaler = prepare_dataset(
                price_df, weather_df, commodity
            )
            input_shape = (X_train.shape[1], X_train.shape[2])
            model = build_model(input_shape)
            train_model(model, X_train, y_train, commodity=commodity)

            # Evaluate
            from ml.data_preprocessing import inverse_transform_price as itp
            y_pred_scaled = predict_multistep(model, X_test[0], steps=len(y_test))
            y_test_real   = [itp(v, scaler) for v in y_test]
            y_pred_real   = [itp(v, scaler) for v in y_pred_scaled]
            import numpy as np
            metrics = compute_metrics(np.array(y_test_real), np.array(y_pred_real), commodity)
            logger.info(f"📊 {commodity} metrics: {metrics}")

        except Exception as e:
            logger.error(f"Retraining failed for {commodity}: {e}", exc_info=True)


# ──────────────────────────────────────────────────────────────
# Step 3: Generate predictions → Supabase
# ──────────────────────────────────────────────────────────────

async def generate_predictions():
    """
    Load trained models, run 7-day forecast,
    upsert into predictions table.
    """
    logger.info("🔮 Generating 7-day predictions...")
    today = date.today()
    from_date = today - timedelta(days=60)

    for commodity in TRACKED_COMMODITIES:
        try:
            model  = load_trained_model(commodity)
            scaler = load_scaler(commodity)

            # Get last SEQUENCE_LENGTH days of data
            res = (
                supabase.table("price_data")
                .select("price, min_price, max_price, recorded_at, state")
                .eq("commodity_id", _get_commodity_id(commodity))
                .gte("recorded_at", from_date.isoformat())
                .order("recorded_at", desc=True)
                .limit(SEQUENCE_LENGTH)
                .execute()
            )
            if not res.data or len(res.data) < SEQUENCE_LENGTH:
                continue

            import pandas as pd, numpy as np
            price_df = pd.DataFrame(res.data[::-1])
            price_df["date"]        = pd.to_datetime(price_df["recorded_at"])
            price_df["modal_price"] = price_df["price"].astype(float)

            dominant_state = price_df.get("state", pd.Series(["India"])).mode()[0]
            weather_df = await fetch_forecast_weather(dominant_state, days_ahead=7)

            from services.weather_fetcher import enrich_prices_with_weather
            from ml.data_preprocessing import (
                aggregate_daily, add_temporal_features, clean_data, normalise_data
            )
            df = aggregate_daily(price_df)
            df = enrich_prices_with_weather(df, weather_df)
            df = add_temporal_features(df)
            df = clean_data(df)

            from config import FEATURE_COLUMNS
            for col in FEATURE_COLUMNS:
                if col not in df.columns:
                    df[col] = 0.0

            scaled = scaler.transform(df[FEATURE_COLUMNS].values.astype("float32"))
            if len(scaled) < SEQUENCE_LENGTH:
                continue
            seed = scaled[-SEQUENCE_LENGTH:]

            pred_scaled = predict_multistep(model, seed, steps=7)

            commodity_id = _get_commodity_id(commodity)
            rows = []
            for i, ps in enumerate(pred_scaled):
                pred_price = float(inverse_transform_price(ps, scaler))
                rows.append({
                    "commodity_id":       commodity_id,
                    "predicted_price":    round(pred_price, 2),
                    "confidence_score":   85.0,      # Placeholder; improve with MC Dropout
                    "prediction_date":    (today + pd.Timedelta(days=i+1)).date().isoformat(),
                    "prediction_horizon": "7_days",
                    "model_version":      "lstm_attention_v2",
                })

            supabase.table("predictions").upsert(
                rows, on_conflict="commodity_id,prediction_date"
            ).execute()
            logger.info(f"✅ 7-day forecast stored for {commodity}")

        except FileNotFoundError:
            logger.warning(f"No trained model yet for {commodity}")
        except Exception as e:
            logger.error(f"Prediction failed for {commodity}: {e}", exc_info=True)


def _get_commodity_id(commodity: str) -> str:
    res = supabase.table("commodities").select("id").eq("name", commodity).execute()
    return res.data[0]["id"] if res.data else ""


# ──────────────────────────────────────────────────────────────
# Scheduler setup
# ──────────────────────────────────────────────────────────────

def create_scheduler() -> AsyncIOScheduler:
    """Create and configure the APScheduler instance."""
    scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

    # 08:00 IST — ingest fresh Agmarknet data
    scheduler.add_job(
        ingest_daily_prices,
        CronTrigger(hour=8, minute=0),
        id="ingest_prices",
        name="Daily Agmarknet Price Ingestion",
        replace_existing=True,
    )

    # 09:00 IST — retrain models on fresh data
    scheduler.add_job(
        retrain_models,
        CronTrigger(hour=9, minute=0),
        id="retrain_models",
        name="Daily LSTM Retraining",
        replace_existing=True,
    )

    # 10:00 IST — generate and store predictions
    scheduler.add_job(
        generate_predictions,
        CronTrigger(hour=10, minute=0),
        id="generate_predictions",
        name="Daily 7-Day Forecast",
        replace_existing=True,
    )

    return scheduler


# ── Standalone entry point ──
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    loop = asyncio.get_event_loop()
    loop.run_until_complete(ingest_daily_prices())
    loop.run_until_complete(retrain_models())
    loop.run_until_complete(generate_predictions())
