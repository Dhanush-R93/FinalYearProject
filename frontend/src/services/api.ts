/**
 * API Service Layer — connects React frontend to FastAPI backend
 * Base URL: http://localhost:8000 (Python backend)
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

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

export interface TrainRequest { commodity?: string; state?: string; days?: number; epochs?: number; }
export interface TrainResponse { message: string; commodity: string; metrics: Record<string, number>; epochs_run: number; data_rows: number; }
export interface MetricsResponse { mae: number; rmse: number; mape: number; r2_score: number; smape?: number; commodity?: string; }
export interface PredictRequest { commodity: string; state?: string; days?: number; }
export interface PredictResponse { commodity: string; state?: string; predictions: Array<{ date: string; predicted_price: number; confidence_lower: number; confidence_upper: number; }>; model_version: string; generated_at: string; }

export const agriApi = {
  health: () => request<{ status: string; model_loaded: boolean; version: string }>("/health"),

  trainModel: (body?: TrainRequest) =>
    request<TrainResponse>("/train", {
      method: "POST",
      body: JSON.stringify({ commodity: "Tomato", state: "Tamil Nadu", days: 365, epochs: 50, ...body }),
    }),

  getMetrics: (commodity = "Tomato") =>
    request<MetricsResponse>(`/metrics/${encodeURIComponent(commodity)}`),

  predictPrice: (body: PredictRequest) =>
    request<PredictResponse>("/predict", {
      method: "POST",
      body: JSON.stringify({ days: 7, ...body }),
    }),

  getLivePrices: (commodity: string, state?: string) => {
    const params = new URLSearchParams({ commodity });
    if (state) params.set("state", state);
    return request<{ commodity: string; prices: any[]; count: number; source: string }>(`/prices/live?${params}`);
  },

  runPipeline: () =>
    request<{ message: string }>("/pipeline/run", { method: "POST" }),
};
