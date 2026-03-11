import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

// Hook to subscribe to real-time price data updates
export function useRealtimePriceData() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel("price_data_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "price_data",
        },
        (payload) => {
          console.log("Price data change received:", payload);
          setLastUpdate(new Date());
          // Invalidate relevant queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ["price_data"] });
          queryClient.invalidateQueries({ queryKey: ["latest_prices"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { lastUpdate };
}

// Hook to subscribe to real-time predictions updates
export function useRealtimePredictions() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel("predictions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "predictions",
        },
        (payload) => {
          console.log("Predictions change received:", payload);
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: ["predictions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { lastUpdate };
}

// Hook to subscribe to real-time market news updates
export function useRealtimeNews() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel("market_news_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "market_news",
        },
        (payload) => {
          console.log("Market news change received:", payload);
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: ["market_news"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { lastUpdate };
}

// Combined hook for all real-time subscriptions
export function useRealtimeSubscriptions() {
  const priceData = useRealtimePriceData();
  const predictions = useRealtimePredictions();
  const news = useRealtimeNews();

  return {
    priceLastUpdate: priceData.lastUpdate,
    predictionsLastUpdate: predictions.lastUpdate,
    newsLastUpdate: news.lastUpdate,
  };
}
