"""
services/weather_fetcher.py
────────────────────────────
Fetches historical and forecast weather data from Open-Meteo.
No API key required — completely free.

Docs: https://open-meteo.com/en/docs

Weather features added to price data:
  - rainfall_mm       (precipitation sum)
  - temperature_max   (°C)
  - temperature_min   (°C)
  - humidity          (relative humidity %)
  - et0_evapotranspiration (drought proxy)
"""

import logging
from datetime import date, timedelta
from typing import Optional

import httpx
import pandas as pd

from config import WEATHER_BASE_URL, GEOCODING_URL

logger = logging.getLogger(__name__)

# Lat/Lon of major Indian agricultural hubs
CITY_COORDS: dict[str, tuple[float, float]] = {
    "Tamil Nadu":       (11.1271, 78.6569),
    "Maharashtra":      (19.7515, 75.7139),
    "Karnataka":        (15.3173, 75.7139),
    "Andhra Pradesh":   (15.9129, 79.7400),
    "Telangana":        (18.1124, 79.0193),
    "Uttar Pradesh":    (26.8467, 80.9462),
    "Punjab":           (31.1471, 75.3412),
    "Haryana":          (29.0588, 76.0856),
    "Gujarat":          (22.2587, 71.1924),
    # Default (India centroid)
    "India":            (20.5937, 78.9629),
}


async def fetch_historical_weather(
    state: str,
    from_date: date,
    to_date: date,
) -> pd.DataFrame:
    """
    Fetch daily historical weather for a state using Open-Meteo Archive API.

    Returns DataFrame with columns:
        date, rainfall_mm, temperature_max, temperature_min, humidity, et0
    """
    lat, lon = CITY_COORDS.get(state, CITY_COORDS["India"])

    params = {
        "latitude":   lat,
        "longitude":  lon,
        "start_date": from_date.isoformat(),
        "end_date":   to_date.isoformat(),
        "daily": ",".join([
            "precipitation_sum",
            "temperature_2m_max",
            "temperature_2m_min",
            "relative_humidity_2m_max",
            "et0_fao_evapotranspiration",
        ]),
        "timezone": "Asia/Kolkata",
    }

    # Use historical archive endpoint for past dates
    url = "https://archive-api.open-meteo.com/v1/archive"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        df = pd.DataFrame({
            "date":            pd.to_datetime(daily.get("time", [])),
            "rainfall_mm":     daily.get("precipitation_sum", []),
            "temperature_max": daily.get("temperature_2m_max", []),
            "temperature_min": daily.get("temperature_2m_min", []),
            "humidity":        daily.get("relative_humidity_2m_max", []),
            "et0":             daily.get("et0_fao_evapotranspiration", []),
        })
        logger.info(f"Weather data fetched for {state}: {len(df)} days")
        return df

    except Exception as e:
        logger.error(f"Weather fetch failed for {state}: {e}")
        return pd.DataFrame()


async def fetch_forecast_weather(
    state: str,
    days_ahead: int = 7,
) -> pd.DataFrame:
    """
    Fetch weather forecast for the next `days_ahead` days.
    Used to enrich real-time prediction inputs.
    """
    lat, lon = CITY_COORDS.get(state, CITY_COORDS["India"])

    params = {
        "latitude":    lat,
        "longitude":   lon,
        "forecast_days": min(days_ahead, 16),  # Open-Meteo max
        "daily": ",".join([
            "precipitation_sum",
            "temperature_2m_max",
            "temperature_2m_min",
            "relative_humidity_2m_max",
        ]),
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(WEATHER_BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        df = pd.DataFrame({
            "date":            pd.to_datetime(daily.get("time", [])),
            "rainfall_mm":     daily.get("precipitation_sum", []),
            "temperature_max": daily.get("temperature_2m_max", []),
            "temperature_min": daily.get("temperature_2m_min", []),
            "humidity":        daily.get("relative_humidity_2m_max", []),
        })
        return df

    except Exception as e:
        logger.error(f"Forecast weather fetch failed: {e}")
        return pd.DataFrame()


def enrich_prices_with_weather(
    price_df: pd.DataFrame,
    weather_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Left-join weather features onto price DataFrame by date.
    Missing weather values are forward-filled.
    """
    if weather_df.empty:
        # Fill with zeros if no weather data
        for col in ["rainfall_mm", "temperature_max", "humidity"]:
            price_df[col] = 0.0
        return price_df

    merged = pd.merge(
        price_df,
        weather_df[["date", "rainfall_mm", "temperature_max", "temperature_min", "humidity"]],
        on="date",
        how="left",
    )
    for col in ["rainfall_mm", "temperature_max", "temperature_min", "humidity"]:
        merged[col] = merged[col].ffill().bfill().fillna(0)

    return merged
