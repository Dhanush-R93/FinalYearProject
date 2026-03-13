"""
services/agmarknet_fetcher.py
Real field names: state, district, market, commodity, arrival_date, min_price, max_price, modal_price
"""
import os
import logging
import asyncio
from datetime import date, timedelta
from typing import Optional
from pathlib import Path
import httpx
import pandas as pd
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)

PUBLIC_BASE = "https://api.data.gov.in/resource"
AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

_env_key = os.getenv("DATA_GOV_API_KEY", "").strip()
REAL_KEY  = "579b464db66ec23bdd0000012d47711ee53044e56bcdf3b6582e0672"
API_KEY   = _env_key if (_env_key and _env_key not in ("", "YOUR_DATA_GOV_IN_API_KEY")) else REAL_KEY

try:
    from config import TRACKED_COMMODITIES
except Exception:
    TRACKED_COMMODITIES = [
        "Tomato","Onion","Potato","Brinjal","Cabbage",
        "Cauliflower","Carrot","Beans","Capsicum","Lady Finger",
        "Bitter Gourd","Bottle Gourd","Drumstick","Pumpkin","Spinach",
    ]

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
    limit: int = 500,
) -> pd.DataFrame:
    if from_date is None:
        from_date = date.today() - timedelta(days=30)
    if to_date is None:
        to_date = date.today()

    # Real field names confirmed from API test
    params = {
        "api-key":            API_KEY,
        "format":             "json",
        "limit":              limit,
        "filters[commodity]": commodity,
        "filters[arrival_date][gte]": from_date.strftime("%d/%m/%Y"),
        "filters[arrival_date][lte]": to_date.strftime("%d/%m/%Y"),
    }
    if state:
        params["filters[state]"] = state

    logger.info(f"Fetching {commodity} | key: {API_KEY[:20]}...")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"{PUBLIC_BASE}/{AGMARKNET_RESOURCE_ID}", params=params)
            resp.raise_for_status()
            records = resp.json().get("records", [])

        if not records:
            logger.warning(f"No records for {commodity}, using sample data")
            return _generate_sample_data(commodity, from_date, to_date)

        df = pd.DataFrame(records)

        # Real column names: state, district, market, commodity, arrival_date, min_price, max_price, modal_price
        df = df.rename(columns={
            "arrival_date": "date",
            "market":       "mandi",
            "commodity":    "commodity",
            "state":        "state",
            "district":     "district",
        })

        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
            df = df.dropna(subset=["date"]).sort_values("date")

        for col in ["min_price", "max_price", "modal_price"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna(subset=["modal_price"]).reset_index(drop=True)
        logger.info(f"✅ {len(df)} REAL records fetched for {commodity}")
        return df

    except Exception as e:
        logger.warning(f"API error for {commodity}: {e}, using sample data")
        return _generate_sample_data(commodity, from_date, to_date)


def _generate_sample_data(commodity: str, from_date: date, to_date: date) -> pd.DataFrame:
    import numpy as np
    base = SAMPLE_BASE_PRICES.get(commodity, 3000)
    dates = pd.date_range(from_date, to_date, freq="D")
    np.random.seed(hash(commodity) % 2**31)
    rows, price = [], float(base)
    for d in dates:
        m = d.month
        factor = 1.20 if m in [4,5,6] else (0.85 if m in [11,12,1] else 1.0)
        price = max(price*(1+float(np.random.uniform(-0.04,0.04)))*factor, base*0.6)
        price = min(price, base*1.8)
        rows.append({
            "date": d, "commodity": commodity,
            "state": "Tamil Nadu", "district": "Chennai", "mandi": "Koyambedu",
            "min_price": round(price*0.87, 2),
            "max_price": round(price*1.13, 2),
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
            await asyncio.sleep(0.5)
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
