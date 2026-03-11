// src/hooks/useAgriData.ts
// ──────────────────────────
// Frontend data hooks that connect to:
//   1. Supabase (cached historical + predictions from daily scheduler)
//   2. FastAPI backend (live prices directly from data.gov.in)
//
// Replaces the N+1 query useLatestPrices with a single view query.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

// ─────────────────────────────────────────────────────────
// 1. Latest prices — ONE query via DB view (fixes N+1 bug)
// ─────────────────────────────────────────────────────────

export function useLatestPrices() {
  return useQuery({
    queryKey: ["latest_prices_view"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("latest_prices_view")  // created in migration 003
        .select("*")
        .order("commodity_name");

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5 * 60 * 1000,  // refresh every 5 min
    staleTime:       2 * 60 * 1000,
  });
}


// ─────────────────────────────────────────────────────────
// 2. Live price — fetches directly from data.gov.in via backend
// ─────────────────────────────────────────────────────────

export function useLivePrice(commodity: string, state?: string) {
  return useQuery({
    queryKey: ["live_price", commodity, state],
    queryFn: async () => {
      const params = new URLSearchParams({ commodity });
      if (state) params.set("state", state);

      const res = await fetch(`${BACKEND_URL}/prices/live?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Failed to fetch live price for ${commodity}`);
      }
      return res.json() as Promise<{
        commodity: string;
        state?: string;
        prices: Array<{
          date: string;
          mandi: string;
          state: string;
          min_price: number;
          max_price: number;
          modal_price: number;
        }>;
        source: string;
        fetched_at: string;
      }>;
    },
    enabled: !!commodity,
    refetchInterval: 60 * 60 * 1000,  // hourly (Agmarknet updates once/day)
    staleTime:       30 * 60 * 1000,
  });
}


// ─────────────────────────────────────────────────────────
// 3. Historical prices from Supabase (fast, cached)
// ─────────────────────────────────────────────────────────

export function useHistoricalPrices(commodityId?: string, days = 30) {
  return useQuery({
    queryKey: ["historical_prices", commodityId, days],
    queryFn: async () => {
      if (!commodityId) return [];

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from("price_data")
        .select("price, min_price, max_price, recorded_at, mandi_name, state")
        .eq("commodity_id", commodityId)
        .gte("recorded_at", fromDate.toISOString())
        .order("recorded_at", { ascending: true });

      if (error) throw error;

      // Group by date and compute daily avg/min/max
      const byDate = new Map<string, { prices: number[]; mins: number[]; maxs: number[]; date: string }>();
      for (const row of data ?? []) {
        const dateKey = row.recorded_at.slice(0, 10);
        if (!byDate.has(dateKey)) {
          byDate.set(dateKey, { prices: [], mins: [], maxs: [], date: dateKey });
        }
        const entry = byDate.get(dateKey)!;
        if (row.price) entry.prices.push(Number(row.price));
        if (row.min_price) entry.mins.push(Number(row.min_price));
        if (row.max_price) entry.maxs.push(Number(row.max_price));
      }

      return Array.from(byDate.values()).map((e) => {
        const avg = e.prices.reduce((a, b) => a + b, 0) / (e.prices.length || 1);
        return {
          date:     e.date,
          avgPrice: Math.round(avg * 100) / 100,
          minPrice: e.mins.length ? Math.min(...e.mins) : 0,
          maxPrice: e.maxs.length ? Math.max(...e.maxs) : 0,
          dataPoints: e.prices.length,
        };
      });
    },
    enabled: !!commodityId,
  });
}


// ─────────────────────────────────────────────────────────
// 4. LSTM predictions from Supabase (updated daily at 10AM)
// ─────────────────────────────────────────────────────────

export function usePredictions(commodityId?: string) {
  return useQuery({
    queryKey: ["predictions", commodityId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      let query = supabase
        .from("predictions")
        .select(`*, commodities(name, icon, unit)`)
        .gte("prediction_date", today)
        .order("prediction_date", { ascending: true });

      if (commodityId) query = query.eq("commodity_id", commodityId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: true,
    refetchInterval: commodityId ? false : 60_000,  // only auto-refresh on dashboard
    staleTime: 10 * 60 * 1000,
  });
}


// ─────────────────────────────────────────────────────────
// 5. On-demand prediction from backend LSTM (real-time)
// ─────────────────────────────────────────────────────────

export function useLSTMPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commodity,
      state,
      horizon = 7,
    }: {
      commodity: string;
      state?: string;
      horizon?: number;
    }) => {
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commodity, state, horizon }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Prediction failed");
      }
      return res.json() as Promise<{
        commodity: string;
        state?: string;
        predictions: Array<{
          date: string;
          predicted_price_inr_quintal: number;
          predicted_price_inr_kg: number;
          confidence: string;
          horizon_day: number;
        }>;
        model_version: string;
        data_source: string;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}


// ─────────────────────────────────────────────────────────
// 6. Train model mutation
// ─────────────────────────────────────────────────────────

export function useTrainModel() {
  return useMutation({
    mutationFn: async ({
      commodity,
      state,
      days = 365,
      epochs,
    }: {
      commodity: string;
      state?: string;
      days?: number;
      epochs?: number;
    }) => {
      const res = await fetch(`${BACKEND_URL}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commodity, state, days, epochs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Training failed");
      }
      return res.json();
    },
  });
}


// ─────────────────────────────────────────────────────────
// 7. Model metrics
// ─────────────────────────────────────────────────────────

export function useModelMetrics(commodity?: string) {
  return useQuery({
    queryKey: ["model_metrics", commodity],
    queryFn: async () => {
      if (!commodity) return null;
      const res = await fetch(`${BACKEND_URL}/metrics/${encodeURIComponent(commodity)}`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        mae: number;
        rmse: number;
        mape: number;
        smape: number;
        r2_score: number;
        commodity: string;
      }>;
    },
    enabled: !!commodity,
    staleTime: 60 * 60 * 1000,  // metrics valid for 1 hour
  });
}


// ─────────────────────────────────────────────────────────
// 8. Weather forecast hook
// ─────────────────────────────────────────────────────────

export function useWeatherForecast(state?: string, days = 7) {
  return useQuery({
    queryKey: ["weather", state, days],
    queryFn: async () => {
      if (!state) return [];
      const res = await fetch(
        `${BACKEND_URL}/weather/${encodeURIComponent(state)}?days=${days}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.forecast ?? [];
    },
    enabled: !!state,
    staleTime: 3 * 60 * 60 * 1000,  // 3 hours
  });
}
