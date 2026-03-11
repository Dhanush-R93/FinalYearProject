# 🌾 AgriPrice Prediction System
### LSTM Forecasting + NLP Chatbot for Fair Agricultural Markets
*ICSFT 2026 — Paper ID: 788 | G. Jijendhar, R. Dhanush*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    DATA SOURCES                          │
│  data.gov.in (Agmarknet)    Open-Meteo Weather API      │
│  ↓ Real-time daily prices   ↓ Free, no key needed       │
└─────────────┬───────────────────────────┘               │
              │                                            │
┌─────────────▼───────────────────────────────────────────┐
│              PYTHON FASTAPI BACKEND                      │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Agmarknet  │  │   Weather    │  │  APScheduler  │  │
│  │  Fetcher    │  │   Fetcher    │  │  (daily 8AM)  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────▼────────────────▼───────────────────▼───────┐  │
│  │           Data Preprocessing Pipeline             │  │
│  │  aggregate → weather enrich → temporal features   │  │
│  │  → outlier clip → MinMax scale → sequences        │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │         LSTM + Attention Model (per commodity)    │  │
│  │   Input → LSTM(64) → LSTM(128) → Attention        │  │
│  │        → Dense(64) → Dense(1) [price]             │  │
│  │   Loss: Huber  |  Optimizer: Adam                 │  │
│  │   Metrics: MAE, RMSE, MAPE, R²                    │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                     SUPABASE                             │
│  price_data  │  predictions  │  commodities              │
│  latest_prices_view (1 query replaces N+1)              │
│  Realtime subscriptions for live UI updates              │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│            REACT + TYPESCRIPT FRONTEND                   │
│                                                          │
│  PriceDashboard  PredictionChart  HistoricalChart        │
│  ModelTrainingPanel  WeatherSection  MandiComparison     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AgriBot NLP Chatbot (Supabase Edge Function)   │    │
│  │  • Streaming responses via Claude API           │    │
│  │  • Enriched with live prices + forecast         │    │
│  │  • Multilingual: EN / HI / TA / TE              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Get API Keys

| Service | URL | Cost |
|---------|-----|------|
| **data.gov.in** (Agmarknet) | https://data.gov.in/user/register | Free |
| **Open-Meteo** (Weather) | No registration needed | Free |
| **Supabase** | https://supabase.com | Free tier |
| **Anthropic** (Chatbot) | https://console.anthropic.com | Pay-per-use |

### 2. Setup Environment
```bash
cp .env.example .env
# Fill in your API keys in .env
```

### 3. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Supabase
```bash
# Apply migrations
supabase db push

# Deploy edge functions
supabase functions deploy agri-chat
supabase functions deploy daily-pipeline

# Set edge function secrets
supabase secrets set ANTHROPIC_API_KEY=your_key
supabase secrets set BACKEND_URL=https://your-backend.com
```

---

## API Reference

### Live Prices (from data.gov.in)
```
GET /prices/live?commodity=Tomato&state=Tamil+Nadu
```

### Train LSTM Model
```
POST /train
{
  "commodity": "Tomato",
  "state": "Tamil Nadu",
  "days": 365,
  "epochs": 100
}
```

### 7-Day Price Forecast
```
POST /predict
{
  "commodity": "Tomato",
  "state": "Tamil Nadu",
  "horizon": 7
}
```

### Response
```json
{
  "commodity": "Tomato",
  "predictions": [
    {
      "date": "2026-03-12",
      "predicted_price_inr_quintal": 2450.50,
      "predicted_price_inr_kg": 24.51,
      "confidence": "Medium-High",
      "horizon_day": 1
    }
  ],
  "data_source": "data.gov.in (Agmarknet) + Open-Meteo"
}
```

---

## Daily Pipeline (Automated)

Runs every morning via APScheduler (IST):

| Time | Job |
|------|-----|
| 08:00 | Fetch fresh Agmarknet prices → Supabase |
| 09:00 | Retrain LSTM models on new data |
| 10:00 | Generate 7-day forecasts → Supabase |

Manual trigger:
```
POST /pipeline/run
```

---

## Model Details

- **Architecture**: Stacked LSTM + Bahdanau Attention
- **Features**: price, min/max price, arrivals, rainfall, temperature, humidity, day_of_week, month, season
- **Loss**: Huber (robust to price outliers)
- **Sequence length**: 30 days history
- **Forecast horizon**: 1–30 days (autoregressive)
- **Per-commodity models**: One `.keras` file per crop (e.g., `lstm_Tomato.keras`)

---

## Bugs Fixed (from original codebase)

1. ✅ `epochs` override now passed to `train_model()`
2. ✅ `load_scaler()` has proper `FileNotFoundError` guard
3. ✅ CORS fixed — explicit origins, not `allow_origins=["*"]` with credentials
4. ✅ `useLatestPrices` uses DB view (1 query vs N+1)
5. ✅ `useAIChat` stale closure fixed with `messagesRef`
6. ✅ 3 Realtime channels merged into 1
