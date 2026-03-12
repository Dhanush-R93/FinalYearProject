import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ✅ Fixed: merged 3 separate realtime channels into 1
// (reduces Supabase connection overhead and avoids channel limit)
export function useRealtimePriceData() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("agri_realtime_all")
      .on("postgres_changes", { event: "*", schema: "public", table: "price_data" }, () => {
        setLastUpdate(new Date());
        queryClient.invalidateQueries({ queryKey: ["price_data"] });
        queryClient.invalidateQueries({ queryKey: ["latest_prices"] });
        queryClient.invalidateQueries({ queryKey: ["historical_prices"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => {
        setLastUpdate(new Date());
        queryClient.invalidateQueries({ queryKey: ["predictions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "market_news" }, () => {
        queryClient.invalidateQueries({ queryKey: ["market_news"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { lastUpdate };
}

// Keep these exports for backward compatibility but they all use the merged channel
export function useRealtimePredictions() {
  return useRealtimePriceData();
}

export function useRealtimeNews() {
  return { lastUpdate: null };
}

export function useRealtimeSubscriptions() {
  const { lastUpdate } = useRealtimePriceData();
  return {
    priceLastUpdate:        lastUpdate,
    predictionsLastUpdate:  lastUpdate,
    newsLastUpdate:         null,
  };
}

