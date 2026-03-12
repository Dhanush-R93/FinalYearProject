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
      // ✅ Fixed: single query via DB view (replaces N+1 queries)
      const { data, error } = await supabase
        .from("latest_prices_view")
        .select("*")
        .order("commodity_name");

      if (error) throw error;

      // Map DB view columns → component-friendly field names
      return (data ?? []).map((row: any) => ({
        id:            row.commodity_id,
        name:          row.commodity_name,
        icon:          row.icon,
        unit:          row.unit,
        category:      row.category,
        price:         row.current_price ?? 0,        // ✅ Fixed: was "price", view returns "current_price"
        change:        row.price_change ?? 0,
        changePercent: row.change_percent ?? 0,
        mandiName:     row.mandi_name ?? "N/A",
        recordedAt:    row.recorded_at ?? null,
        source:        row.source ?? null,
      }));
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime:       2 * 60 * 1000,
  });
}
