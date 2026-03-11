import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCommodities() {
  return useQuery({
    queryKey: ["commodities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commodities")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
}

export function usePriceData(commodityId?: string) {
  return useQuery({
    queryKey: ["price_data", commodityId],
    queryFn: async () => {
      let query = supabase
        .from("price_data")
        .select(`
          *,
          commodities (name, icon, unit)
        `)
        .order("recorded_at", { ascending: false })
        .limit(100);
      
      if (commodityId) {
        query = query.eq("commodity_id", commodityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
}

export function usePredictions(commodityId?: string) {
  return useQuery({
    queryKey: ["predictions", commodityId],
    queryFn: async () => {
      let query = supabase
        .from("predictions")
        .select(`
          *,
          commodities (name, icon, unit)
        `)
        .order("prediction_date", { ascending: true });
      
      if (commodityId) {
        query = query.eq("commodity_id", commodityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });
}

export function useLatestPrices() {
  return useQuery({
    queryKey: ["latest_prices"],
    queryFn: async () => {
      // Get commodities with their latest prices
      const { data: commodities, error: commoditiesError } = await supabase
        .from("commodities")
        .select("*");
      
      if (commoditiesError) throw commoditiesError;

      // For each commodity, get the two most recent prices to calculate change
      const pricesWithChange = await Promise.all(
        commodities.map(async (commodity) => {
          const { data: prices, error: pricesError } = await supabase
            .from("price_data")
            .select("*")
            .eq("commodity_id", commodity.id)
            .order("recorded_at", { ascending: false })
            .limit(2);
          
          if (pricesError) throw pricesError;

          const currentPrice = prices?.[0]?.price || 0;
          const previousPrice = prices?.[1]?.price || currentPrice;
          const change = currentPrice - previousPrice;
          const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

          return {
            ...commodity,
            price: currentPrice,
            change,
            changePercent,
            mandiName: prices?.[0]?.mandi_name || "N/A",
            recordedAt: prices?.[0]?.recorded_at,
            source: prices?.[0]?.source || null,
          };
        })
      );

      return pricesWithChange;
    },
  });
}
