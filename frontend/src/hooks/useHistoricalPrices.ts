import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export function useHistoricalPrices(commodityId?: string, days = 30) {
  return useQuery({
    queryKey: ["historical_prices", commodityId, days],
    queryFn: async () => {
      if (!commodityId) return [];

      const fromDate = subDays(new Date(), days).toISOString();

      const { data, error } = await supabase
        .from("price_data")
        .select("price, min_price, max_price, recorded_at, mandi_name, source")  // ✅ Fixed: added min_price, max_price
        .eq("commodity_id", commodityId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: true });

      if (error) throw error;

      // Group by date and average prices across mandis
      const byDate = new Map<string, { prices: number[]; mins: number[]; maxs: number[]; date: string }>();
      for (const row of data) {
        const dateKey = format(new Date(row.recorded_at), "yyyy-MM-dd");
        if (!byDate.has(dateKey)) {
          byDate.set(dateKey, { prices: [], mins: [], maxs: [], date: dateKey });
        }
        const entry = byDate.get(dateKey)!;
        entry.prices.push(row.price);
        // ✅ Fixed: use actual min/max from DB columns (added in migration 003)
        if (row.min_price) entry.mins.push(row.min_price);
        if (row.max_price) entry.maxs.push(row.max_price);
      }

      return Array.from(byDate.values()).map((entry) => {
        const avg = entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length;
        // Fall back to modal price if min/max not populated
        const min = entry.mins.length ? Math.min(...entry.mins) : Math.min(...entry.prices);
        const max = entry.maxs.length ? Math.max(...entry.maxs) : Math.max(...entry.prices);
        return {
          date: entry.date,
          dateLabel: format(new Date(entry.date), "MMM dd"),
          avgPrice: Math.round(avg * 100) / 100,
          minPrice: Math.round(min * 100) / 100,
          maxPrice: Math.round(max * 100) / 100,
          dataPoints: entry.prices.length,
        };
      });
    },
    enabled: !!commodityId,
  });
}
