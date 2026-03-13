"""
services/agmarknet_fetcher.py
Strategy: Fetch all records for a date, filter Tamil Nadu locally (avoids timeout)
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

PUBLIC_BASE          = "https://api.data.gov.in/resource"
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

# Commodity name mapping (API names vs our names)
COMMODITY_ALIASES = {
    "Tomato":       ["Tomato"],
    "Onion":        ["Onion"],
    "Potato":       ["Potato"],
    "Brinjal":      ["Brinjal", "Bringal"],
    "Cabbage":      ["Cabbage"],
    "Cauliflower":  ["Cauliflower"],
    "Carrot":       ["Carrot"],
    "Beans":        ["Beans", "French Beans", "Cluster Beans"],
    "Capsicum":     ["Capsicum"],
    "Lady Finger":  ["Lady Finger", "Bhindi(Ladies Finger)"],
    "Bitter Gourd": ["Bitter Gourd"],
    "Bottle Gourd": ["Bottle Gourd"],
    "Drumstick":    ["Drumstick"],
    "Pumpkin":      ["Pumpkin"],
    "Spinach":      ["Spinach"],
}

async def _fetch_date_records(target_date: date) -> list:
    """Fetch all records for a specific date (fast, no filter timeout)"""
    params = {
        "api-key": API_KEY,
        "format":  "json",
        "limit":   1000,
        "filters[arrival_date]": target_date.strftime("%d/%m/%Y"),
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.get(f"{PUBLIC_BASE}/{AGMARKNET_RESOURCE_ID}", params=params)
            resp.raise_for_status()
            return resp.json().get("records", [])
    except Exception as e:
        logger.warning(f"Failed to fetch {target_date}: {e}")
        return []


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

    aliases = COMMODITY_ALIASES.get(commodity, [commodity])
    all_records = []

    # Fetch day by day (only recent 7 days to avoid too many requests)
    days_to_fetch = min((to_date - from_date).days + 1, 7)
    for i in range(days_to_fetch):
        target_date = to_date - timedelta(days=i)
        records = await _fetch_date_records(target_date)

        # Filter by state and commodity locally
        for rec in records:
            rec_state     = str(rec.get("state", ""))
            rec_commodity = str(rec.get("commodity", ""))

            state_match = (not state) or (state.lower() in rec_state.lower())
            commodity_match = any(alias.lower() in rec_commodity.lower() for alias in aliases)

            if state_match and commodity_match:
                all_records.append(rec)

        await asyncio.sleep(0.3)

    if not all_records:
        logger.warning(f"No real records for {commodity}, using sample data")
        return _generate_sample_data(commodity, from_date, to_date)

    df = pd.DataFrame(all_records)
    df = df.rename(columns={
        "arrival_date": "date",
        "market":       "mandi",
    })
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
        df = df.dropna(subset=["date"]).sort_values("date")
    for col in ["min_price", "max_price", "modal_price"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["modal_price"]).reset_index(drop=True)
    logger.info(f"✅ {len(df)} REAL records for {commodity} ({state or 'all India'})")
    return df


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
            "min_price": round(price*0.87,2),
            "max_price": round(price*1.13,2),
            "modal_price": round(price,2),
        })
    return pd.DataFrame(rows)


async def fetch_today_prices(state: Optional[str] = None) -> pd.DataFrame:
    frames = []
    # Fetch all today's records once
    today_records = await _fetch_date_records(date.today())
    logger.info(f"Fetched {len(today_records)} total records for today")

    for commodity in TRACKED_COMMODITIES:
        aliases = COMMODITY_ALIASES.get(commodity, [commodity])
        matches = [
            r for r in today_records
            if any(a.lower() in str(r.get("commodity","")).lower() for a in aliases)
            and (not state or state.lower() in str(r.get("state","")).lower())
        ]
        if matches:
            df = pd.DataFrame(matches)
            df = df.rename(columns={"arrival_date":"date","market":"mandi"})
            df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
            for col in ["min_price","max_price","modal_price"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            frames.append(df)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


async def fetch_all_commodities(days: int = 7, state: Optional[str] = None) -> dict:
    from_date = date.today() - timedelta(days=days)
    results = {}
    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity, state=state,
                from_date=from_date, to_date=date.today()
            )
            if not df.empty:
                results[commodity] = df
        except Exception as e:
            logger.error(f"Skipping {commodity}: {e}")
    return results
