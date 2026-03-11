"""
ml/lstm_model.py
─────────────────
Stacked LSTM + Attention for agricultural price forecasting.

Architecture:
  Input → LSTM(64, return_seq) → Dropout
        → LSTM(128, return_seq) → Dropout
        → Attention layer
        → Dense(64) → Dense(1)

Key improvements over basic LSTM:
  - Attention lets the model focus on the most relevant past days
  - ReduceLROnPlateau + EarlyStopping for robust training
  - Per-commodity model files (train once per crop)
"""

import os
import logging
import numpy as np
import tensorflow as tf
from tensorflow.keras import Model, Input  # type: ignore
from tensorflow.keras.layers import (  # type: ignore
    LSTM, Dense, Dropout, Attention, GlobalAveragePooling1D,
    Concatenate, LayerNormalization,
)
from tensorflow.keras.callbacks import (  # type: ignore
    EarlyStopping, ReduceLROnPlateau, ModelCheckpoint,
)
from tensorflow.keras.optimizers import Adam  # type: ignore

from config import (
    LSTM_UNITS_1, LSTM_UNITS_2, DROPOUT_RATE,
    EPOCHS, BATCH_SIZE, VALIDATION_SPLIT,
    LEARNING_RATE, MODEL_PATH, FEATURE_COLUMNS,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 1. Build model with attention
# ──────────────────────────────────────────────

def build_model(input_shape: tuple) -> Model:
    """
    Build stacked LSTM + Bahdanau-style attention model.

    Parameters
    ----------
    input_shape : (sequence_length, num_features)
    """
    seq_input = Input(shape=input_shape, name="sequence_input")

    # ── Layer 1: LSTM with return_sequences for attention
    x = LSTM(LSTM_UNITS_1, return_sequences=True, name="lstm_1")(seq_input)
    x = Dropout(DROPOUT_RATE, name="drop_1")(x)
    x = LayerNormalization(name="norm_1")(x)

    # ── Layer 2: LSTM with return_sequences for attention
    lstm_out = LSTM(LSTM_UNITS_2, return_sequences=True, name="lstm_2")(x)
    lstm_out = Dropout(DROPOUT_RATE, name="drop_2")(lstm_out)
    lstm_out = LayerNormalization(name="norm_2")(lstm_out)

    # ── Attention: query=last step, value=all steps
    query = lstm_out[:, -1:, :]          # (batch, 1, units)
    attn_out = Attention(name="attention")([query, lstm_out])  # (batch, 1, units)
    attn_out = tf.squeeze(attn_out, axis=1)  # (batch, units)

    # ── Dense head
    x = Dense(64, activation="relu", name="dense_1")(attn_out)
    x = Dropout(0.1)(x)
    output = Dense(1, name="price_output")(x)

    model = Model(inputs=seq_input, outputs=output, name="AgriLSTM_Attention")
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss="huber",          # robust to outliers vs plain MSE
        metrics=["mae"],
    )
    model.summary(print_fn=logger.info)
    return model


# ──────────────────────────────────────────────
# 2. Train
# ──────────────────────────────────────────────

def train_model(
    model: Model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    commodity: str,
    epochs: int = EPOCHS,
) -> dict:
    """
    Train with early stopping, LR reduction, and best-weights checkpoint.
    Returns Keras history dict.
    """
    model_path = MODEL_PATH.format(commodity=commodity.replace(" ", "_"))

    callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=15,
            restore_best_weights=True,
            verbose=1,
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=7,
            min_lr=1e-6,
            verbose=1,
        ),
        ModelCheckpoint(
            filepath=model_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=0,
        ),
    ]

    history = model.fit(
        X_train, y_train,
        epochs=epochs,
        batch_size=BATCH_SIZE,
        validation_split=VALIDATION_SPLIT,
        callbacks=callbacks,
        verbose=1,
    )

    logger.info(f"✅ Model saved → {model_path}")
    return history.history


# ──────────────────────────────────────────────
# 3. Load
# ──────────────────────────────────────────────

def load_trained_model(commodity: str) -> Model:
    """Load a saved Keras model for a specific commodity."""
    path = MODEL_PATH.format(commodity=commodity.replace(" ", "_"))
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"No trained model at {path}. "
            f"Call POST /train-model with commodity='{commodity}' first."
        )
    return tf.keras.models.load_model(path)


# ──────────────────────────────────────────────
# 4. Predict
# ──────────────────────────────────────────────

def predict(model: Model, X: np.ndarray) -> np.ndarray:
    """
    Run batch inference.

    Parameters
    ----------
    X : (n_samples, seq_length, n_features)

    Returns
    -------
    Normalised predictions, shape (n_samples,)
    """
    return model.predict(X, verbose=0).flatten()


# ──────────────────────────────────────────────
# 5. Multi-step forecast (7 / 14 / 30 days)
# ──────────────────────────────────────────────

def predict_multistep(
    model: Model,
    seed_sequence: np.ndarray,  # shape (seq_length, n_features)
    steps: int = 7,
) -> np.ndarray:
    """
    Iterative multi-step forecast using last prediction
    as next input (autoregressive).

    Returns normalised predictions for `steps` future days.
    """
    from config import FEATURE_COLUMNS, TARGET_COLUMN

    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    seq = seed_sequence.copy()
    preds = []

    for _ in range(steps):
        X = seq[-len(seq):].reshape(1, len(seq), len(FEATURE_COLUMNS))
        pred = float(model.predict(X, verbose=0)[0, 0])
        preds.append(pred)

        # Build next row: use prediction for price, carry forward other features
        next_row = seq[-1].copy()
        next_row[target_idx] = pred
        # Increment day_of_week
        dow_idx = FEATURE_COLUMNS.index("day_of_week") if "day_of_week" in FEATURE_COLUMNS else None
        if dow_idx is not None:
            next_row[dow_idx] = (next_row[dow_idx] + 1) % 7

        seq = np.vstack([seq[1:], next_row])

    return np.array(preds)
