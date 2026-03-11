"""
config.py — Central configuration for AgriPrice Prediction System
All secrets loaded from environment variables (.env file).
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────
# Government API — data.gov.in  (Agmarknet / Horticultural)
# Register at: https://data.gov.in/user/register
# Get API key:  https://data.gov.in/catalog/daily-market-prices-vegetables
# ─────────────────────────────────────────────────────────
DATA_GOV_API_KEY   = os.getenv("DATA_GOV_API_KEY", "YOUR_DATA_GOV_IN_API_KEY")
DATA_GOV_BASE_URL  = "https://api.data.gov.in/resource"

# Resource IDs on data.gov.in (Agmarknet daily mandi prices)
AGMARKNET_RESOURCE_ID  = "9ef84268-d588-465a-a308-a864a43d0070"   # vegetable daily prices
HORT_RESOURCE_ID       = "35985678-0d79-46b4-9ed6-6f13308a1d24"   # horticulture crop prices

# ─────────────────────────────────────────────────────────
# Open-Meteo API — free, no key required
# Docs: https://open-meteo.com/en/docs
# ─────────────────────────────────────────────────────────
WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL    = "https://geocoding-api.open-meteo.com/v1/search"

# ─────────────────────────────────────────────────────────
# Supabase
# ─────────────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY     = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# ─────────────────────────────────────────────────────────
# LSTM Hyperparameters
# ─────────────────────────────────────────────────────────
SEQUENCE_LENGTH   = 30     # days of history fed to model
LSTM_UNITS_1      = 64
LSTM_UNITS_2      = 128
DROPOUT_RATE      = 0.2
EPOCHS            = 100
BATCH_SIZE        = 32
VALIDATION_SPLIT  = 0.1
TEST_SPLIT        = 0.2
LEARNING_RATE     = 0.001

# Feature columns from Agmarknet + weather enrichment
FEATURE_COLUMNS = [
    "modal_price",      # target: daily modal price (INR/quintal)
    "min_price",
    "max_price",
    "arrivals_tonnes",  # market arrivals volume
    "rainfall_mm",      # weather feature
    "temperature_max",  # weather feature
    "humidity",         # weather feature
    "day_of_week",      # temporal feature (0-6)
    "month",            # temporal feature (1-12)
    "season",           # 1=Kharif,2=Rabi,3=Zaid
]
TARGET_COLUMN = "modal_price"

# ─────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(BASE_DIR, "models")
DATA_DIR    = os.path.join(BASE_DIR, "data")
LOG_DIR     = os.path.join(BASE_DIR, "logs")

for d in [MODEL_DIR, DATA_DIR, LOG_DIR]:
    os.makedirs(d, exist_ok=True)

MODEL_PATH   = os.path.join(MODEL_DIR, "lstm_{commodity}.keras")
SCALER_PATH  = os.path.join(MODEL_DIR, "scaler_{commodity}.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics_{commodity}.json")

# ─────────────────────────────────────────────────────────
# API Server
# ─────────────────────────────────────────────────────────
API_HOST    = "0.0.0.0"
API_PORT    = 8000
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "https://your-production-domain.com"),
]

# ─────────────────────────────────────────────────────────
# Commodities tracked (Agmarknet commodity names exactly)
# ─────────────────────────────────────────────────────────
TRACKED_COMMODITIES = [
    "Tomato", "Onion", "Potato", "Brinjal", "Cabbage",
    "Cauliflower", "Carrot", "Beans", "Capsicum", "Bitter Gourd",
    "Bottle Gourd", "Drumstick", "Lady Finger", "Pumpkin", "Spinach",
]

# States to fetch data for
TARGET_STATES = [
    "Tamil Nadu", "Maharashtra", "Karnataka", "Andhra Pradesh",
    "Telangana", "Uttar Pradesh", "Punjab", "Haryana", "Gujarat",
]
