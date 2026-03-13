"""
services/agmarknet_fetcher.py
Uses YOUR real data.gov.in API key from .env file
"""
import os
import logging
import asyncio
from datetime import date, timedelta
from typing import Optional
import httpx
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

PUBLIC_BASE = "https://api.data.gov.in/resource"
AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

# Read your real API key from .env
_raw_key = os.getenv("DATA_GOV_API_KEY", "")
DEMO_KEY  = "579b464db66ec23d318a903939b7"
API_KEY   = _raw_key if _raw_key and _raw_key != "YOUR_DATA_GOV_IN_API_KEY" else DEMO_KEY

try:
    from config import TRACKED_COMMODITIES
except Exception:
    TRACKED_COMMODITIES = [
        "Tomato","Onion","Potato","Brinjal","Cabbage",
        "Cauliflower","Carrot","Beans","Capsicum","Lady Finger",
        "Bitter Gourd","Bottle Gourd","Drumstick","Pumpkin","Spinach",
    ]

# Real wholesale base prices ₹/quintal (govt API unit)
SAMPLE_BASE_PRICES = {
    "Tomato":4000,"Onion":2800,"Potato":2200,"Brinjal":3500,
    "Cabbage":2000,"Cauliflower":4200,"Carrot":3800,"Beans":6500,
    "Capsicum":6000,"Lady Finger":4500,"Bitter Gourd":5000,
    "Bottle Gourd":1800,"Drumstick":5500,"Pumpkin":2500,"Spinach":3000,
}

async def fetch_agmarknet_prices(
    commodity: str,
    state: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = 100,
) -> pd.DataFrame:
    if from_date is None:
        from_date = date.today() - timedelta(days=30)
    if to_date is None:
        to_date = date.today()

    params = {
        "api-key": API_KEY,
        "format": "json",
        "limit": limit,
        "filters[Commodity]": commodity,
        "filters[Arrival_Date][gte]": from_date.strftime("%d/%m/%Y"),
        "filters[Arrival_Date][lte]": to_date.strftime("%d/%m/%Y"),
    }
    if state:
        params["filters[State]"] = state

    logger.info(f"Fetching {commodity} with key: {API_KEY[:20]}...")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{PUBLIC_BASE}/{AGMARKNET_RESOURCE_ID}", params=params)
            resp.raise_for_status()
            records = resp.json().get("records", [])

        if not records:
            logger.warning(f"No records for {commodity}, using sample data")
            return _generate_sample_data(commodity, from_date, to_date)

        df = pd.DataFrame(records)
        col_map = {
            "Arrival_Date":"date","Commodity":"commodity","State":"state",
            "District":"district","Market":"mandi",
            "Min_x0020_Price":"min_price","Max_x0020_Price":"max_price",
            "Modal_x0020_Price":"modal_price",
        }
        df = df.rename(columns={k:v for k,v in col_map.items() if k in df.columns})
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
            df = df.dropna(subset=["date"]).sort_values("date")
        for col in ["min_price","max_price","modal_price"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        logger.info(f"✅ Fetched {len(df)} REAL records for {commodity}")
        return df.dropna(subset=["modal_price"]).reset_index(drop=True)

    except Exception as e:
        logger.warning(f"API unavailable ({e}), using sample data for {commodity}")
        return _generate_sample_data(commodity, from_date, to_date)


def _generate_sample_data(commodity: str, from_date: date, to_date: date) -> pd.DataFrame:
    import numpy as np
    # Base price per quintal (real wholesale rates)
    base = SAMPLE_BASE_PRICES.get(commodity, 3000)
    dates = pd.date_range(from_date, to_date, freq="D")
    np.random.seed(hash(commodity) % 2**31)
    rows, price = [], float(base)
    for d in dates:
        m = d.month
        factor = 1.20 if m in [4,5,6] else (0.85 if m in [11,12,1] else 1.0)
        price = max(price * (1 + float(np.random.uniform(-0.04, 0.04))) * factor, base * 0.6)
        price = min(price, base * 1.8)
        rows.append({
            "date": d, "commodity": commodity,
            "state": "Tamil Nadu", "district": "Chennai", "mandi": "Koyambedu",
            "min_price": round(price * 0.87, 2),
            "max_price": round(price * 1.13, 2),
            "modal_price": round(price, 2),
        })
    return pd.DataFrame(rows)


async def fetch_today_prices(state: Optional[str] = None) -> pd.DataFrame:
    today, week_ago = date.today(), date.today() - timedelta(days=7)
    frames = []
    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(commodity=commodity, state=state, from_date=week_ago, to_date=today)
            if not df.empty:
                frames.append(df.sort_values("date").groupby("mandi").last().reset_index())
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"Skipping {commodity}: {e}")
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


async def fetch_all_commodities(days: int = 365, state: Optional[str] = None) -> dict:
    from_date = date.today() - timedelta(days=days)
    results = {}
    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(commodity=commodity, state=state, from_date=from_date, to_date=date.today())
            if not df.empty:
                results[commodity] = df
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Skipping {commodity}: {e}")
    return results
