"""
api/main.py — AgriPrice Prediction API
────────────────────────────────────────
Endpoints:
  GET  /health                   → service health + model status
  GET  /prices/live              → fetch today's live Agmarknet prices
  GET  /prices/historical        → historical prices from Supabase
  POST /train                    → train/retrain LSTM for a commodity
  POST /predict                  → next-day price prediction
  GET  /predict/multistep        → 7/14/30-day forecast
  GET  /metrics/{commodity}      → model evaluation metrics
  GET  /commodities              → list of tracked commodities
  GET  /weather/{state}          → weather forecast for a state
  POST /pipeline/run             → manually trigger full pipeline
"""

import json
import logging
import os
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

from config import (
    API_HOST, API_PORT, CORS_ORIGINS, METRICS_PATH,
    SEQUENCE_LENGTH, FEATURE_COLUMNS, TRACKED_COMMODITIES,
    SUPABASE_URL, SUPABASE_KEY,
)
from services.agmarknet_fetcher import fetch_agmarknet_prices, fetch_today_prices
from services.weather_fetcher import fetch_forecast_weather
from ml.data_preprocessing import (
    prepare_dataset, load_scaler, inverse_transform_price,
    aggregate_daily, add_temporal_features, clean_data,
)
from ml.lstm_model import (
    build_model, train_model, load_trained_model,
    predict, predict_multistep,
)
from ml.evaluation import compute_metrics
from scheduler.daily_pipeline import create_scheduler, ingest_daily_prices

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ──────────────────────────────────────────────────────────────
# Lifespan: start scheduler on startup
# ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("✅ APScheduler started — daily pipeline active")
    yield
    scheduler.shutdown()
    logger.info("APScheduler shut down")


# ──────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgriPrice LSTM API",
    description=(
        "Real-time agricultural commodity price forecasting using "
        "LSTM + Attention, powered by data.gov.in (Agmarknet) and Open-Meteo."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,        # ✅ Fixed: explicit origins, not wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    commodity:  str = Field(..., example="Tomato")
    state:      Optional[str] = Field(None, example="Tamil Nadu")
    days:       int = Field(365, ge=60, description="Days of history to train on")
    epochs:     Optional[int] = Field(None, ge=1, le=500)


class TrainResponse(BaseModel):
    message:    str
    commodity:  str
    metrics:    dict
    epochs_run: int
    data_rows:  int


class PredictRequest(BaseModel):
    commodity:  str = Field(..., example="Tomato")
    state:      Optional[str] = Field(None, example="Tamil Nadu")
    horizon:    int = Field(7, ge=1, le=30, description="Days to forecast")


class PredictResponse(BaseModel):
    commodity:      str
    state:          Optional[str]
    predictions:    List[dict]   # [{date, predicted_price_inr_quintal, confidence}]
    model_version:  str
    data_source:    str


class LivePriceResponse(BaseModel):
    commodity:  str
    prices:     List[dict]
    fetched_at: str
    source:     str


# ──────────────────────────────────────────────────────────────
# GET /health
# ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    trained = []
    for c in TRACKED_COMMODITIES:
        path = f"models/lstm_{c.replace(' ', '_')}.keras"
        if os.path.exists(path):
            trained.append(c)
    return {
        "status":             "healthy",
        "trained_commodities": trained,
        "total_tracked":      len(TRACKED_COMMODITIES),
        "version":            "2.0.0",
        "data_source":        "data.gov.in (Agmarknet)",
        "weather_source":     "Open-Meteo (free)",
    }


# ──────────────────────────────────────────────────────────────
# GET /prices/live  — real-time Agmarknet data
# ──────────────────────────────────────────────────────────────

@app.get("/prices/live")
async def get_live_prices(
    commodity: str = Query(..., example="Tomato"),
    state:     Optional[str] = Query(None, example="Tamil Nadu"),
):
    """
    Fetch today's live prices directly from data.gov.in API.
    Returns raw mandi-level price data.
    """
    try:
        df = await fetch_agmarknet_prices(
            commodity=commodity,
            state=state,
            from_date=date.today() - timedelta(days=3),
            to_date=date.today(),
        )
        if df.empty:
            raise HTTPException(404, f"No live price data for {commodity}")

        records = df.to_dict(orient="records")
        # Convert Timestamps to strings for JSON
        for r in records:
            if "date" in r and hasattr(r["date"], "isoformat"):
                r["date"] = r["date"].isoformat()

        return {
            "commodity":  commodity,
            "state":      state,
            "prices":     records,
            "count":      len(records),
            "fetched_at": date.today().isoformat(),
            "source":     "data.gov.in / Agmarknet (Official Govt API)",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/prices/live failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


# ──────────────────────────────────────────────────────────────
# GET /prices/historical  — from Supabase (cached)
# ──────────────────────────────────────────────────────────────

@app.get("/prices/historical")
async def get_historical_prices(
    commodity: str = Query(..., example="Tomato"),
    days:      int = Query(30, ge=1, le=365),
    state:     Optional[str] = Query(None),
):
    """Return historical prices from Supabase (populated by daily scheduler)."""
    from_date = (date.today() - timedelta(days=days)).isoformat()

    res = supabase_client.table("commodities").select("id").eq("name", commodity).execute()
    if not res.data:
        raise HTTPException(404, f"Commodity '{commodity}' not found")
    cid = res.data[0]["id"]

    query = (
        supabase_client.table("price_data")
        .select("price, min_price, max_price, mandi_name, state, recorded_at")
        .eq("commodity_id", cid)
        .gte("recorded_at", from_date)
        .order("recorded_at")
    )
    if state:
        query = query.eq("state", state)

    result = query.execute()
    return {"commodity": commodity, "days": days, "data": result.data}


# ──────────────────────────────────────────────────────────────
# POST /train  — train LSTM model
# ──────────────────────────────────────────────────────────────

@app.post("/train", response_model=TrainResponse)
async def train_endpoint(req: TrainRequest):
    """
    Train (or retrain) the LSTM model for a commodity.
    Fetches data from data.gov.in, enriches with weather,
    trains LSTM+Attention model.
    """
    try:
        from_date = date.today() - timedelta(days=req.days)

        logger.info(f"Fetching {req.days} days of Agmarknet data for {req.commodity}...")
        price_df = await fetch_agmarknet_prices(
            commodity=req.commodity,
            state=req.state,
            from_date=from_date,
            to_date=date.today(),
            limit=500,
        )

        if price_df.empty:
            raise HTTPException(404, f"No data found for '{req.commodity}' on data.gov.in")

        if len(price_df) < SEQUENCE_LENGTH + 20:
            raise HTTPException(
                422,
                f"Only {len(price_df)} records — need at least {SEQUENCE_LENGTH + 20}. "
                "Try increasing `days` or choosing a more common commodity."
            )

        logger.info(f"Fetching weather for {req.state or 'India'}...")
        weather_df = await fetch_forecast_weather(req.state or "India", days_ahead=7)

        X_train, X_test, y_train, y_test, scaler = prepare_dataset(
            price_df, weather_df, req.commodity
        )

        input_shape = (X_train.shape[1], X_train.shape[2])
        model = build_model(input_shape)

        from config import EPOCHS
        epochs = req.epochs or EPOCHS
        history = train_model(model, X_train, y_train, commodity=req.commodity, epochs=epochs)
        epochs_run = len(history["loss"])

        y_pred_scaled = predict(model, X_test)
        y_test_real  = np.array([inverse_transform_price(v, scaler) for v in y_test])
        y_pred_real  = np.array([inverse_transform_price(v, scaler) for v in y_pred_scaled])
        metrics = compute_metrics(y_test_real, y_pred_real, req.commodity)

        return TrainResponse(
            message=f"Model trained for '{req.commodity}'",
            commodity=req.commodity,
            metrics=metrics,
            epochs_run=epochs_run,
            data_rows=len(price_df),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/train failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


# ──────────────────────────────────────────────────────────────
# POST /predict  — multi-step price forecast
# ──────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse)
async def predict_endpoint(req: PredictRequest):
    """
    Forecast next `horizon` days of prices using trained LSTM.
    Auto-fetches recent prices + weather from APIs.
    """
    try:
        model  = load_trained_model(req.commodity)
        scaler = load_scaler(req.commodity)
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))

    try:
        # Get recent prices to build seed sequence
        from_date = date.today() - timedelta(days=60)
        price_df = await fetch_agmarknet_prices(
            commodity=req.commodity,
            state=req.state,
            from_date=from_date,
            to_date=date.today(),
            limit=500,
        )

        if price_df.empty or len(price_df) < SEQUENCE_LENGTH:
            raise HTTPException(
                422,
                f"Not enough recent price data to build seed sequence "
                f"(need {SEQUENCE_LENGTH}, got {len(price_df)})"
            )

        weather_df = await fetch_forecast_weather(req.state or "India", days_ahead=req.horizon)

        from services.weather_fetcher import enrich_prices_with_weather
        df = aggregate_daily(price_df)
        df = enrich_prices_with_weather(df, weather_df)
        df = add_temporal_features(df)
        df = clean_data(df)

        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0.0

        scaled = scaler.transform(df[FEATURE_COLUMNS].values.astype("float32"))
        seed   = scaled[-SEQUENCE_LENGTH:]

        pred_scaled = predict_multistep(model, seed, steps=req.horizon)

        today = date.today()
        predictions = []
        for i, ps in enumerate(pred_scaled):
            price_inr = round(inverse_transform_price(ps, scaler), 2)
            predictions.append({
                "date":                     (today + timedelta(days=i+1)).isoformat(),
                "predicted_price_inr_quintal": price_inr,
                "predicted_price_inr_kg":   round(price_inr / 100, 2),
                "confidence":               "Medium-High",
                "horizon_day":              i + 1,
            })

        return PredictResponse(
            commodity=req.commodity,
            state=req.state,
            predictions=predictions,
            model_version="lstm_attention_v2",
            data_source="data.gov.in (Agmarknet) + Open-Meteo",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/predict failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


# ──────────────────────────────────────────────────────────────
# GET /metrics/{commodity}
# ──────────────────────────────────────────────────────────────

@app.get("/metrics/{commodity}")
async def get_metrics(commodity: str):
    path = METRICS_PATH.format(commodity=commodity.replace(" ", "_"))
    if not os.path.exists(path):
        raise HTTPException(404, f"No metrics for '{commodity}'. Train the model first.")
    with open(path) as f:
        return json.load(f)


# ──────────────────────────────────────────────────────────────
# GET /commodities
# ──────────────────────────────────────────────────────────────

@app.get("/commodities")
async def list_commodities():
    trained = []
    for c in TRACKED_COMMODITIES:
        path = f"models/lstm_{c.replace(' ', '_')}.keras"
        trained.append({"name": c, "model_ready": os.path.exists(path)})
    return {"commodities": trained, "total": len(trained)}


# ──────────────────────────────────────────────────────────────
# GET /weather/{state}
# ──────────────────────────────────────────────────────────────

@app.get("/weather/{state}")
async def get_weather(state: str, days: int = Query(7, ge=1, le=16)):
    """Fetch weather forecast for a state (via Open-Meteo, free)."""
    df = await fetch_forecast_weather(state=state, days_ahead=days)
    if df.empty:
        raise HTTPException(404, f"Weather data not available for '{state}'")
    records = df.to_dict(orient="records")
    for r in records:
        if "date" in r and hasattr(r["date"], "isoformat"):
            r["date"] = r["date"].isoformat()
    return {"state": state, "forecast": records, "source": "open-meteo.com (free)"}


# ──────────────────────────────────────────────────────────────
# POST /pipeline/run  — manual trigger
# ──────────────────────────────────────────────────────────────

@app.post("/pipeline/run")
async def manual_pipeline(background_tasks: BackgroundTasks):
    """Manually trigger the full daily data pipeline."""
    background_tasks.add_task(ingest_daily_prices)
    return {"message": "Daily pipeline triggered in background"}


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
