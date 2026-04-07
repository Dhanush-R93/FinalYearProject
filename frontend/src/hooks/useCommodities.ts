import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCommodities() {
  return useQuery({
    queryKey: ["commodities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commodities").select("*").order("name");
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
        .select(`*, commodities (name, icon, unit)`)
        .order("recorded_at", { ascending: false })
        .limit(100);
      if (commodityId) query = query.eq("commodity_id", commodityId);
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
        .select(`*, commodities (name, icon, unit)`)
        .order("prediction_date", { ascending: true });
      if (commodityId) query = query.eq("commodity_id", commodityId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
    refetchInterval: 60000,
  });
}

export function useLatestPrices(location?: string) {
  return useQuery({
    queryKey: ["latest_prices", location],
    queryFn: async () => {
      // Fetch all recent price data
      const { data, error } = await supabase
        .from("price_data")
        .select(`*, commodities(id, name, icon, unit, category)`)
        .in("source", ["agmarknet_gov_in", "interpolated", "simulated"])
        .order("recorded_at", { ascending: false })
        .limit(2000);

      if (error) throw error;
      if (!data) return [];

      // Group by commodity — prefer location match, then real data, then latest
      const map = new Map<string, any>();
      for (const row of data) {
        const cname = row.commodities?.name;
        if (!cname || !row.price) continue;

        const existing = map.get(cname);
        const isLocMatch = location && (
          row.mandi_location?.toLowerCase().includes(location.toLowerCase()) ||
          row.mandi_name?.toLowerCase().includes(location.toLowerCase())
        );
        const isReal = row.source === "agmarknet_gov_in";

        if (!existing) {
          map.set(cname, { ...row, _locMatch: isLocMatch });
        } else {
          // Prefer: location match > real data > latest date
          const existLocMatch = existing._locMatch;
          if (isLocMatch && !existLocMatch) {
            map.set(cname, { ...row, _locMatch: true });
          } else if (!existLocMatch && isReal && existing.source !== "agmarknet_gov_in") {
            map.set(cname, { ...row, _locMatch: false });
          }
        }
      }

      // Calculate day-over-day change
      const prevMap = new Map<string, number>();
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      for (const row of data) {
        const cname = row.commodities?.name;
        if (!cname) continue;
        const d = row.recorded_at?.toString().split("T")[0];
        if (d <= yesterday && !prevMap.has(cname)) {
          prevMap.set(cname, Number(row.price));
        }
      }

      return Array.from(map.values()).map((row: any) => {
        const price = Number(row.price) || 0;
        const prev = prevMap.get(row.commodities?.name) || price;
        const change = price - prev;
        const changePercent = prev > 0 ? (change / prev) * 100 : 0;
        return {
          id: row.commodities?.id,
          name: row.commodities?.name,
          icon: row.commodities?.icon,
          unit: row.commodities?.unit,
          category: row.commodities?.category,
          price,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 10) / 10,
          mandiName: row.mandi_name ?? "N/A",
          mandiLocation: row.mandi_location ?? "",
          recordedAt: row.recorded_at ?? null,
          source: row.source ?? null,
        };
      }).filter(r => r.name).sort((a,b) => a.name.localeCompare(b.name));
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}
