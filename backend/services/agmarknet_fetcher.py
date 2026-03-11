"""
services/agmarknet_fetcher.py
─────────────────────────────
Fetches real-time daily vegetable prices from the official
Indian Government Open Data Platform (data.gov.in / Agmarknet).

Official API docs:
  https://data.gov.in/catalog/daily-market-prices-vegetables
  https://agmarknet.gov.in/

Registration:
  1. Go to https://data.gov.in/user/register
  2. Verify email
  3. Visit https://data.gov.in/user/me/api-keys → Generate API key
  4. Set DATA_GOV_API_KEY in your .env

Rate limits: 1000 requests/hour on free tier.
"""

import logging
import asyncio
from datetime import date, timedelta
from typing import Optional

import httpx
import pandas as pd

from config import (
    DATA_GOV_API_KEY,
    DATA_GOV_BASE_URL,
    AGMARKNET_RESOURCE_ID,
    HORT_RESOURCE_ID,
    TRACKED_COMMODITIES,
    TARGET_STATES,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Core fetcher
# ──────────────────────────────────────────────────────────────

async def fetch_agmarknet_prices(
    commodity: str,
    state: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = 500,
) -> pd.DataFrame:
    """
    Fetch daily mandi prices from data.gov.in Agmarknet dataset.

    Parameters
    ----------
    commodity : Agmarknet commodity name (e.g. "Tomato")
    state     : Filter by state name (e.g. "Tamil Nadu")
    from_date : Start date (default: 30 days ago)
    to_date   : End date (default: today)
    limit     : Max records per call (max 500 for free tier)

    Returns
    -------
    DataFrame with columns:
        date, commodity, state, district, mandi, min_price,
        max_price, modal_price (all prices in INR/quintal)
    """
    if from_date is None:
        from_date = date.today() - timedelta(days=30)
    if to_date is None:
        to_date = date.today()

    params = {
        "api-key":  DATA_GOV_API_KEY,
        "format":   "json",
        "limit":    limit,
        "filters[Commodity]": commodity,
        "filters[Arrival_Date][gte]": from_date.strftime("%d/%m/%Y"),
        "filters[Arrival_Date][lte]": to_date.strftime("%d/%m/%Y"),
    }
    if state:
        params["filters[State]"] = state

    url = f"{DATA_GOV_BASE_URL}/{AGMARKNET_RESOURCE_ID}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()

        records = payload.get("records", [])
        if not records:
            logger.warning(f"No data returned for {commodity} / {state}")
            return pd.DataFrame()

        df = pd.DataFrame(records)
        df = _normalize_agmarknet(df)
        logger.info(f"Fetched {len(df)} records for {commodity} from data.gov.in")
        return df

    except httpx.HTTPStatusError as e:
        logger.error(f"data.gov.in HTTP {e.response.status_code}: {e}")
        raise
    except Exception as e:
        logger.error(f"fetch_agmarknet_prices failed: {e}", exc_info=True)
        raise


def _normalize_agmarknet(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise raw Agmarknet JSON into a clean DataFrame."""
    col_map = {
        "Arrival_Date":  "date",
        "Commodity":     "commodity",
        "State":         "state",
        "District":      "district",
        "Market":        "mandi",
        "Min_x0020_Price": "min_price",
        "Max_x0020_Price": "max_price",
        "Modal_x0020_Price": "modal_price",
    }
    # Rename only columns that exist
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Parse date — Agmarknet format is "DD/MM/YYYY"
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
        df = df.dropna(subset=["date"])
        df = df.sort_values("date")

    # Coerce prices to float
    for col in ["min_price", "max_price", "modal_price"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["modal_price"])
    df = df.reset_index(drop=True)
    return df


# ──────────────────────────────────────────────────────────────
# Batch fetcher — all tracked commodities
# ──────────────────────────────────────────────────────────────

async def fetch_all_commodities(
    days: int = 365,
    state: Optional[str] = None,
) -> dict[str, pd.DataFrame]:
    """
    Fetch the past `days` of price data for every commodity
    in TRACKED_COMMODITIES.  Returns {commodity: DataFrame}.
    """
    from_date = date.today() - timedelta(days=days)
    results = {}

    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                state=state,
                from_date=from_date,
                to_date=date.today(),
                limit=500,
            )
            if not df.empty:
                results[commodity] = df
            # Respect rate limit — 1000 req/hr → ~1 req/3.6 sec
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Skipping {commodity}: {e}")

    return results


# ──────────────────────────────────────────────────────────────
# Latest price snapshot (today's prices across all mandis)
# ──────────────────────────────────────────────────────────────

async def fetch_today_prices(state: Optional[str] = None) -> pd.DataFrame:
    """
    Fetch today's (or latest available) prices for all
    tracked commodities in a single merged DataFrame.
    """
    today   = date.today()
    week_ago = today - timedelta(days=7)   # fallback if today unavailable yet

    all_frames = []
    for commodity in TRACKED_COMMODITIES:
        try:
            df = await fetch_agmarknet_prices(
                commodity=commodity,
                state=state,
                from_date=week_ago,
                to_date=today,
                limit=200,
            )
            if not df.empty:
                # Keep only the most recent date per mandi
                latest = df.sort_values("date").groupby("mandi").last().reset_index()
                all_frames.append(latest)
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"Could not fetch today prices for {commodity}: {e}")

    return pd.concat(all_frames, ignore_index=True) if all_frames else pd.DataFrame()
