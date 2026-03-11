/**
 * API Service Layer — connects React frontend to FastAPI backend
 * Base URL defaults to localhost:8000 (Python backend)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agri-api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  version: string;
}

export interface TrainRequest {
  filename?: string;
  epochs?: number;
}

export interface TrainResponse {
  message: string;
  metrics: Record<string, number>;
  epochs_run: number;
}

export interface PredictRequest {
  sequence: number[][];
  commodity?: string;
}

export interface PredictResponse {
  commodity: string;
  predicted_price: number;
  confidence_note: string;
}

export interface MetricsResponse {
  mae: number;
  rmse: number;
  mape: number;
  r2_score: number;
}

// ── API Calls ──────────────────────────────────

export const agriApi = {
  health: () => request<HealthResponse>("/health"),

  trainModel: (body?: TrainRequest) =>
    request<TrainResponse>("/train-model", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  predictPrice: (body: PredictRequest) =>
    request<PredictResponse>("/predict-price", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getMetrics: () => request<MetricsResponse>("/model-metrics"),
};
