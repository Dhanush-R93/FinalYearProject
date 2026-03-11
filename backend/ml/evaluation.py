"""
ml/evaluation.py
─────────────────
Regression evaluation metrics:
  MAE, RMSE, MAPE, R², SMAPE
"""

import json
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from config import METRICS_PATH


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    commodity: str,
) -> dict:
    """
    Evaluate predictions and persist metrics to disk.

    Parameters
    ----------
    y_true    : actual de-normalised prices (INR/quintal)
    y_pred    : predicted de-normalised prices
    commodity : name used to build the metrics file path
    """
    mae  = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2   = float(r2_score(y_true, y_pred))

    # MAPE — guard against zero actual prices
    mask = y_true != 0
    mape = float(
        np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
    ) if mask.sum() > 0 else 0.0

    # sMAPE — symmetric, bounded [0, 200%]
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2
    smape_vals = np.where(denom == 0, 0, np.abs(y_true - y_pred) / denom * 100)
    smape = float(np.mean(smape_vals))

    metrics = {
        "mae":       round(mae,   2),
        "rmse":      round(rmse,  2),
        "mape":      round(mape,  2),
        "smape":     round(smape, 2),
        "r2_score":  round(r2,    4),
        "commodity": commodity,
    }

    path = METRICS_PATH.format(commodity=commodity.replace(" ", "_"))
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)

    return metrics
