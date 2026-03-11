"""
ml/data_preprocessing.py
─────────────────────────
Full preprocessing pipeline:
  Raw Agmarknet data + Open-Meteo weather
    → cleaned & enriched DataFrame
    → Min-Max scaled sequences
    → (X_train, X_test, y_train, y_test) arrays
"""

import pickle
import logging
import numpy as np
import pandas as pd
from typing import Tuple, Optional
from sklearn.preprocessing import MinMaxScaler

from config import (
    SCALER_PATH, SEQUENCE_LENGTH, FEATURE_COLUMNS,
    TARGET_COLUMN, TEST_SPLIT,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 1. Aggregate mandi data → daily national average
# ──────────────────────────────────────────────

def aggregate_daily(df: pd.DataFrame) -> pd.DataFrame:
    """
    Agmarknet has multiple mandi rows per day.
    Collapse to one row per date using weighted-average modal price
    and total arrivals.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()

    agg = df.groupby("date").agg(
        modal_price     = ("modal_price",     "median"),
        min_price       = ("min_price",       "min"),
        max_price       = ("max_price",       "max"),
        arrivals_tonnes = ("arrivals_tonnes", "sum") if "arrivals_tonnes" in df.columns else ("modal_price", "count"),
    ).reset_index()

    return agg


# ──────────────────────────────────────────────
# 2. Add temporal + seasonal features
# ──────────────────────────────────────────────

def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["day_of_week"] = df["date"].dt.dayofweek        # 0=Mon … 6=Sun
    df["month"]       = df["date"].dt.month             # 1–12
    df["season"]      = df["month"].apply(_month_to_season)
    return df


def _month_to_season(m: int) -> int:
    """
    Indian agricultural seasons:
      Kharif (Jun-Oct) = 1,  Rabi (Nov-Mar) = 2,  Zaid (Apr-May) = 3
    """
    if m in (6, 7, 8, 9, 10):
        return 1   # Kharif
    elif m in (11, 12, 1, 2, 3):
        return 2   # Rabi
    else:
        return 3   # Zaid


# ──────────────────────────────────────────────
# 3. Clean: impute + clip outliers
# ──────────────────────────────────────────────

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Forward-fill missing values then clip extreme outliers
    at 2nd / 98th percentile (less aggressive than 1%/99%).
    """
    df = df.ffill().bfill()

    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
            continue
        q2  = df[col].quantile(0.02)
        q98 = df[col].quantile(0.98)
        df[col] = df[col].clip(lower=q2, upper=q98)

    return df


# ──────────────────────────────────────────────
# 4. Normalise (Min-Max)
# ──────────────────────────────────────────────

def normalise_data(
    df: pd.DataFrame,
    commodity: str,
    fit: bool = True,
    scaler: Optional[MinMaxScaler] = None,
) -> Tuple[np.ndarray, MinMaxScaler]:
    """
    Scales FEATURE_COLUMNS to [0, 1].
    fit=True  → fits a new scaler and saves it to disk.
    fit=False → uses provided scaler (inference mode).
    """
    # Ensure all feature columns exist
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    features = df[FEATURE_COLUMNS].values.astype("float32")

    if fit:
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = scaler.fit_transform(features)
        path = SCALER_PATH.format(commodity=commodity.replace(" ", "_"))
        with open(path, "wb") as f:
            pickle.dump(scaler, f)
        logger.info(f"Scaler saved → {path}")
    else:
        if scaler is None:
            raise ValueError("Provide scaler when fit=False")
        scaled = scaler.transform(features)

    return scaled, scaler


def load_scaler(commodity: str) -> MinMaxScaler:
    """Load a previously fitted scaler from disk."""
    import os
    path = SCALER_PATH.format(commodity=commodity.replace(" ", "_"))
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"No scaler at {path}. Train the model for '{commodity}' first."
        )
    with open(path, "rb") as f:
        return pickle.load(f)


# ──────────────────────────────────────────────
# 5. Sliding-window sequences
# ──────────────────────────────────────────────

def create_sequences(
    data: np.ndarray,
    seq_length: int = SEQUENCE_LENGTH,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Input  : array (T, F)
    Output : X (T-L, L, F),  y (T-L,)   — next-day modal_price
    """
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i : i + seq_length])
        y.append(data[i + seq_length, target_idx])
    return np.array(X), np.array(y)


# ──────────────────────────────────────────────
# 6. Full pipeline
# ──────────────────────────────────────────────

def prepare_dataset(
    price_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    commodity: str,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, MinMaxScaler]:
    """
    End-to-end: raw API dataframes → train/test arrays.

    Returns
    -------
    X_train, X_test, y_train, y_test, fitted_scaler
    """
    from services.weather_fetcher import enrich_prices_with_weather

    df = aggregate_daily(price_df)
    df = enrich_prices_with_weather(df, weather_df)
    df = add_temporal_features(df)
    df = clean_data(df)

    logger.info(f"Dataset shape after preprocessing: {df.shape}")

    scaled, scaler = normalise_data(df, commodity=commodity, fit=True)
    X, y = create_sequences(scaled)

    split_idx = int(len(X) * (1 - TEST_SPLIT))
    return X[:split_idx], X[split_idx:], y[:split_idx], y[split_idx:], scaler


# ──────────────────────────────────────────────
# 7. Inverse transform (prediction → INR/quintal)
# ──────────────────────────────────────────────

def inverse_transform_price(scaled_value: float, scaler: MinMaxScaler) -> float:
    """Convert normalised prediction back to original INR/quintal scale."""
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    dummy = np.zeros((1, len(FEATURE_COLUMNS)))
    dummy[0, target_idx] = scaled_value
    return float(scaler.inverse_transform(dummy)[0, target_idx])
