import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, Loader2, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCommodities } from "@/hooks/useCommodities";
import { useHistoricalPrices } from "@/hooks/useHistoricalPrices";

const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

export function HistoricalPriceChart() {
  const [selectedCommodity, setSelectedCommodity] = useState<string>("");
  const [days, setDays] = useState("30");

  const { data: commodities, isLoading: commoditiesLoading } = useCommodities();
  const { data: history, isLoading: historyLoading } = useHistoricalPrices(
    selectedCommodity,
    parseInt(days)
  );

  const isLoading = commoditiesLoading || historyLoading;
  const selectedData = commodities?.find((c) => c.id === selectedCommodity);

  // Compute summary stats
  const stats = history && history.length > 1
    ? (() => {
        const first = history[0].avgPrice;
        const last = history[history.length - 1].avgPrice;
        const change = last - first;
        const changePercent = first > 0 ? (change / first) * 100 : 0;
        const highest = Math.max(...history.map((h) => h.maxPrice));
        const lowest = Math.min(...history.map((h) => h.minPrice));
        const avg = history.reduce((s, h) => s + h.avgPrice, 0) / history.length;
        return { change, changePercent, highest, lowest, avg, last };
      })()
    : null;

  return (
    <section id="historical-trends" className="py-16 bg-muted/30">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-primary mb-4">
            <BarChart3 className="h-4 w-4" />
            Historical Trends
          </div>
          <h2 className="section-title">Price History</h2>
          <p className="section-description">
            Track commodity price movements over time to identify trends and make informed decisions
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
            <Select value={selectedCommodity} onValueChange={setSelectedCommodity}>
              <SelectTrigger className="w-full sm:w-72 input-modern">
                <SelectValue placeholder="Select a commodity" />
              </SelectTrigger>
              <SelectContent>
                {commodities?.map((commodity) => (
                  <SelectItem key={commodity.id} value={commodity.id}>
                    <span className="flex items-center gap-2">
                      <span>{commodity.icon}</span>
                      <span>{commodity.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-full sm:w-44 input-modern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Empty state */}
          {!selectedCommodity && (
            <div className="card-elevated p-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Select a Commodity</p>
              <p className="text-muted-foreground">Choose a commodity to view its price history</p>
            </div>
          )}

          {/* Loading */}
          {selectedCommodity && isLoading && (
            <div className="card-elevated p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading historical data...</p>
            </div>
          )}

          {/* Chart + Stats */}
          {selectedCommodity && !isLoading && history && history.length > 0 && stats && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Latest</p>
                  <p className="text-lg font-bold text-foreground">₹{stats.last.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Average</p>
                  <p className="text-lg font-bold text-foreground">₹{stats.avg.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Highest</p>
                  <p className="text-lg font-bold text-price-up">₹{stats.highest.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Lowest</p>
                  <p className="text-lg font-bold text-price-down">₹{stats.lowest.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Trend</p>
                  <div className="flex items-center justify-center gap-1">
                    {stats.change > 0 ? (
                      <TrendingUp className="h-4 w-4 text-price-up" />
                    ) : stats.change < 0 ? (
                      <TrendingDown className="h-4 w-4 text-price-down" />
                    ) : (
                      <Minus className="h-4 w-4 text-price-neutral" />
                    )}
                    <span
                      className={cn(
                        "text-lg font-bold",
                        stats.change > 0 && "text-price-up",
                        stats.change < 0 && "text-price-down",
                        stats.change === 0 && "text-price-neutral"
                      )}
                    >
                      {stats.changePercent > 0 ? "+" : ""}
                      {stats.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedData?.icon}</span>
                    <h3 className="font-semibold text-lg">
                      {selectedData?.name} — {PERIOD_OPTIONS.find((o) => o.value === days)?.label}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Avg Price</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                      <span className="text-muted-foreground">Range</span>
                    </div>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="histAvgGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 55%, 32%)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(152, 55%, 32%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="histRangeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(215, 15%, 45%)" stopOpacity={0.08} />
                          <stop offset="95%" stopColor="hsl(215, 15%, 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" />
                      <XAxis
                        dataKey="dateLabel"
                        stroke="hsl(215, 15%, 45%)"
                        fontSize={12}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="hsl(215, 15%, 45%)"
                        fontSize={12}
                        tickFormatter={(v) => `₹${v}`}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "1px solid hsl(215, 20%, 88%)",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            avgPrice: "Avg",
                            maxPrice: "High",
                            minPrice: "Low",
                          };
                          return [`₹${value.toFixed(2)}`, labels[name] || name];
                        }}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      {/* Range band */}
                      <Area
                        type="monotone"
                        dataKey="maxPrice"
                        stroke="none"
                        fill="url(#histRangeGradient)"
                      />
                      <Area
                        type="monotone"
                        dataKey="minPrice"
                        stroke="none"
                        fill="transparent"
                      />
                      {/* Average line */}
                      <Area
                        type="monotone"
                        dataKey="avgPrice"
                        stroke="hsl(152, 55%, 32%)"
                        strokeWidth={2.5}
                        fill="url(#histAvgGradient)"
                        dot={{ fill: "hsl(152, 55%, 32%)", strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* No data */}
          {selectedCommodity && !isLoading && (!history || history.length === 0) && (
            <div className="card-elevated p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No Historical Data</p>
              <p className="text-muted-foreground">
                Price data for this period is not yet available
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
