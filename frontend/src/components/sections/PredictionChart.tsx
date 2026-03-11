import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, Loader2, Calendar, RefreshCw, Info, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCommodities, usePredictions, usePriceData } from "@/hooks/useCommodities";
import { useRealtimePredictions } from "@/hooks/useRealtimeData";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function PredictionChart() {
  const [selectedCommodity, setSelectedCommodity] = useState<string>("");
  
  const { data: commodities, isLoading: commoditiesLoading } = useCommodities();
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = usePredictions(selectedCommodity);
  const { data: priceData, isLoading: priceLoading } = usePriceData(selectedCommodity);
  const { lastUpdate } = useRealtimePredictions();

  const isLoading = commoditiesLoading || predictionsLoading || priceLoading;

  // Prepare chart data
  const chartData = [
    ...(priceData?.slice(0, 7).reverse().map(p => ({
      date: format(new Date(p.recorded_at), "MMM dd"),
      actual: p.price,
    })) || []),
    ...(predictions?.slice(0, 7).map(p => ({
      date: format(new Date(p.prediction_date), "MMM dd"),
      predicted: p.predicted_price,
    })) || [])
  ];

  const selectedCommodityData = commodities?.find(c => c.id === selectedCommodity);
  const latestPrediction = predictions?.[0];
  const latestActual = priceData?.[0];
  const priceDiff = latestPrediction && latestActual 
    ? latestPrediction.predicted_price - latestActual.price 
    : 0;

  const avgConfidence = predictions?.length
    ? (predictions.reduce((acc, p) => acc + (p.confidence_score || 0), 0) / predictions.length) * 100
    : 0;

  const modelVersion = predictions?.[0]?.model_version || "unknown";

  return (
    <section id="predictions" className="py-16">
      <div className="container px-4">
        {/* Section Header */}
        <div className="section-header">
          <div className="badge-secondary mb-4">
            <Brain className="h-4 w-4" />
            AI Predictions
          </div>
          <h2 className="section-title">Price Forecasting</h2>
          <p className="section-description">
            Holt-Winters Triple Exponential Smoothing with weekly seasonality for accurate forecasts
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
            <LiveIndicator lastUpdate={lastUpdate} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPredictions()}
              disabled={predictionsLoading}
              className="text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", predictionsLoading && "animate-spin")} />
              Refresh Predictions
            </Button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Commodity Selector */}
          <div className="flex justify-center mb-8">
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
          </div>

          {/* No commodity selected */}
          {!selectedCommodity && (
            <div className="card-elevated p-12 text-center">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Select a Commodity</p>
              <p className="text-muted-foreground">Choose a commodity to view price predictions</p>
            </div>
          )}

          {/* Loading */}
          {selectedCommodity && isLoading && (
            <div className="card-elevated p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading predictions...</p>
            </div>
          )}

          {/* Chart and Stats */}
          {selectedCommodity && !isLoading && chartData.length > 0 && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card text-center">
                  <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                  <p className="text-xl font-bold text-foreground">
                    ₹{latestActual?.price?.toFixed(0) || "N/A"}
                  </p>
                </div>
                
                <div className="stat-card text-center">
                  <p className="text-sm text-muted-foreground mb-1">Predicted</p>
                  <p className="text-xl font-bold text-primary">
                    ₹{latestPrediction?.predicted_price?.toFixed(0) || "N/A"}
                  </p>
                </div>
                
                <div className="stat-card text-center">
                  <p className="text-sm text-muted-foreground mb-1">Change</p>
                  <div className="flex items-center justify-center gap-1">
                    {priceDiff >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-price-up" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-price-down" />
                    )}
                    <span className={cn(
                      "text-xl font-bold",
                      priceDiff >= 0 ? "text-price-up" : "text-price-down"
                    )}>
                      {priceDiff >= 0 ? "+" : ""}₹{priceDiff.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="stat-card text-center">
                  <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                  <p className="text-xl font-bold text-secondary">
                    {avgConfidence.toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Algorithm Info Panel */}
              <div className="card-elevated p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Algorithm: Holt-Winters Triple Exponential Smoothing</p>
                      <Badge variant="outline" className="text-xs">{modelVersion}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      60-day history • Level (α=0.35) + Trend (β=0.10) + Weekly Seasonality (γ=0.25)
                    </p>
                  </div>
                </div>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                      <p className="font-semibold mb-1">How predictions work:</p>
                      <ul className="list-disc pl-3 space-y-0.5">
                        <li>Fetches last 60 days of daily average prices per commodity</li>
                        <li>Decomposes into <strong>level</strong>, <strong>trend</strong>, and <strong>weekly seasonal</strong> components</li>
                        <li>Forecast = level + trend × h + seasonal[h mod 7]</li>
                        <li>Confidence calibrated from backcast error on last 7 days</li>
                        <li>Captures recurring weekly market patterns (e.g. weekend dips)</li>
                      </ul>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>

              {/* Chart */}
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedCommodityData?.icon}</span>
                    <h3 className="font-semibold text-lg">{selectedCommodityData?.name} Price Trend</h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Actual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-secondary" />
                      <span className="text-muted-foreground">Predicted</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 55%, 32%)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(152, 55%, 32%)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(28, 50%, 45%)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(28, 50%, 45%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(215, 15%, 45%)"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="hsl(215, 15%, 45%)"
                        fontSize={12}
                        tickFormatter={(value) => `₹${value}`}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "1px solid hsl(215, 20%, 88%)",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                        formatter={(value: number, name: string) => [
                          `₹${value.toFixed(2)}`, 
                          name === "actual" ? "Actual" : "Predicted"
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="hsl(152, 55%, 32%)"
                        strokeWidth={2}
                        fill="url(#actualGradient)"
                        dot={{ fill: "hsl(152, 55%, 32%)", strokeWidth: 0, r: 4 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="predicted"
                        stroke="hsl(28, 50%, 45%)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#predictedGradient)"
                        dot={{ fill: "hsl(28, 50%, 45%)", strokeWidth: 0, r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* No predictions available */}
          {selectedCommodity && !isLoading && chartData.length === 0 && (
            <div className="card-elevated p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No Predictions Available</p>
              <p className="text-muted-foreground">Predictions for this commodity are being generated</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
