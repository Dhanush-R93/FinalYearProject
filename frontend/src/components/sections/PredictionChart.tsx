import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, Loader2, RefreshCw, Info, BarChart3, Calendar } from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCommodities, usePredictions, usePriceData } from "@/hooks/useCommodities";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { format, addDays } from "date-fns";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>
            ₹{Number(entry.value).toFixed(2)}/kg
          </span>
        </div>
      ))}
    </div>
  );
};

export function PredictionChart() {
  const [selectedCommodity, setSelectedCommodity] = useState<string>("");
  const { data: commodities, isLoading: commoditiesLoading } = useCommodities();
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = usePredictions(selectedCommodity);
  const { data: priceData, isLoading: priceLoading } = usePriceData(selectedCommodity);

  const isLoading = commoditiesLoading || predictionsLoading || priceLoading;
  const selectedCommodityData = commodities?.find(c => c.id === selectedCommodity);
  const today = new Date();

  // Build unified chart data: last 14 days actual + 10 days predicted
  const chartData = (() => {
    const points: any[] = [];

    // Last 14 days of actual prices
    const actuals = (priceData || [])
      .filter(p => p.mandi_name === "Koyambedu" || !p.mandi_name)
      .slice(0, 14)
      .reverse();

    actuals.forEach(p => {
      points.push({
        date: format(new Date(p.recorded_at), "MMM dd"),
        actual: Number(p.price),
        type: "actual",
      });
    });

    // Today divider
    const lastActualPrice = actuals.length > 0 ? actuals[actuals.length - 1]?.price : null;

    // 10 days of future predictions
    const futurePreds = (predictions || [])
      .filter(p => new Date(p.prediction_date) > today)
      .sort((a, b) => new Date(a.prediction_date).getTime() - new Date(b.prediction_date).getTime())
      .slice(0, 10);

    futurePreds.forEach((p, i) => {
      points.push({
        date: format(new Date(p.prediction_date), "MMM dd"),
        predicted: Number(p.predicted_price),
        conf_lower: p.confidence_lower ? Number(p.confidence_lower) : undefined,
        conf_upper: p.confidence_upper ? Number(p.confidence_upper) : undefined,
        // Bridge: connect actual to prediction on day 0
        ...(i === 0 && lastActualPrice ? { actual: Number(lastActualPrice) } : {}),
        type: "predicted",
        day: i + 1,
      });
    });

    return points;
  })();

  const latestActual = priceData?.find(p => p.mandi_name === "Koyambedu") || priceData?.[0];
  const day1Prediction = predictions?.find(p => new Date(p.prediction_date) > today);
  const day10Prediction = predictions
    ?.filter(p => new Date(p.prediction_date) > today)
    .sort((a, b) => new Date(a.prediction_date).getTime() - new Date(b.prediction_date).getTime())[9];

  const priceDiff = day1Prediction && latestActual
    ? Number(day1Prediction.predicted_price) - Number(latestActual.price)
    : 0;

  const avgConfidence = predictions?.length
    ? predictions.reduce((acc, p) => acc + (Number(p.confidence_score) || 0), 0) / predictions.length * 100
    : 0;

  const todayLabel = format(today, "MMM dd");

  return (
    <section id="predictions" className="py-16">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-secondary mb-4">
            <Brain className="h-4 w-4" /> AI Predictions
          </div>
          <h2 className="section-title">10-Day Price Forecast</h2>
          <p className="section-description">
            LSTM + Holt-Winters model — 14 days history + 10 days future prediction
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
            <LiveIndicator lastUpdate={new Date().toISOString()} />
            <Button variant="outline" size="sm" onClick={() => refetchPredictions()} disabled={predictionsLoading}>
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
                <SelectValue placeholder="Select a vegetable" />
              </SelectTrigger>
              <SelectContent>
                {commodities?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedCommodity && (
            <div className="card-elevated p-12 text-center">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Select a Vegetable</p>
              <p className="text-muted-foreground">Choose a commodity to view 10-day price forecast</p>
            </div>
          )}

          {selectedCommodity && isLoading && (
            <div className="card-elevated p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading predictions...</p>
            </div>
          )}

          {selectedCommodity && !isLoading && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Today's Price</p>
                  <p className="text-2xl font-bold text-foreground">
                    ₹{latestActual?.price ? Number(latestActual.price).toFixed(0) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">/kg</p>
                </div>

                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Tomorrow (Day 1)</p>
                  <p className="text-2xl font-bold text-primary">
                    ₹{day1Prediction ? Number(day1Prediction.predicted_price).toFixed(0) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">/kg predicted</p>
                </div>

                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Day 10 Forecast</p>
                  <p className="text-2xl font-bold text-orange-500">
                    ₹{day10Prediction ? Number(day10Prediction.predicted_price).toFixed(0) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">/kg</p>
                </div>

                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Expected Change</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {priceDiff >= 0
                      ? <TrendingUp className="h-4 w-4 text-green-500" />
                      : <TrendingDown className="h-4 w-4 text-red-500" />}
                    <span className={cn("text-xl font-bold", priceDiff >= 0 ? "text-green-600" : "text-red-600")}>
                      {priceDiff >= 0 ? "+" : ""}₹{priceDiff.toFixed(0)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{avgConfidence.toFixed(0)}% confidence</p>
                </div>
              </div>

              {/* Algorithm Info */}
              <div className="card-elevated p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">LSTM + Holt-Winters Triple Exponential Smoothing</p>
                    <Badge variant="outline" className="text-xs">v2</Badge>
                    <Badge className="text-xs bg-green-100 text-green-700 border-0">10-Day Forecast</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    14-day history • Level (α=0.35) + Trend (β=0.10) + Weekly Seasonality (γ=0.25) • Confidence bands shown
                  </p>
                </div>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon"><Info className="h-4 w-4 text-muted-foreground" /></Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      <p className="font-semibold mb-1">How 10-day predictions work:</p>
                      <ul className="list-disc pl-3 space-y-0.5">
                        <li>Uses last 60 days of actual Koyambedu APMC prices</li>
                        <li>LSTM captures long-term patterns and seasonality</li>
                        <li>Holt-Winters handles level + trend + weekly cycles</li>
                        <li>Confidence bands widen as forecast goes further out</li>
                        <li>Orange dashed = future predictions, green = actual prices</li>
                      </ul>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>

              {/* Main Chart */}
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedCommodityData?.icon}</span>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCommodityData?.name} — Price Forecast</h3>
                      <p className="text-xs text-muted-foreground">14 days actual + 10 days future prediction</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-green-600" />
                      <span className="text-muted-foreground">Actual Price</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-orange-500" />
                      <span className="text-muted-foreground">Predicted</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-orange-100 border border-orange-300" />
                      <span className="text-muted-foreground">Confidence Band</span>
                    </div>
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.08}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" fontSize={11} tickLine={false} stroke="#94a3b8" />
                        <YAxis
                          fontSize={11}
                          tickLine={false}
                          stroke="#94a3b8"
                          tickFormatter={(v) => `₹${v}`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Today reference line */}
                        <ReferenceLine
                          x={todayLabel}
                          stroke="#6366f1"
                          strokeDasharray="4 4"
                          label={{ value: "Today", position: "top", fontSize: 11, fill: "#6366f1" }}
                        />

                        {/* Confidence band */}
                        <Area
                          dataKey="conf_upper"
                          stroke="none"
                          fill="url(#confGrad)"
                          name="Confidence Upper"
                          legendType="none"
                        />
                        <Area
                          dataKey="conf_lower"
                          stroke="none"
                          fill="#fff"
                          name="Confidence Lower"
                          legendType="none"
                        />

                        {/* Actual prices */}
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="#16a34a"
                          strokeWidth={2.5}
                          fill="url(#actualGrad)"
                          dot={{ fill: "#16a34a", r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          name="Actual Price"
                          connectNulls={false}
                        />

                        {/* Predicted prices */}
                        <Area
                          type="monotone"
                          dataKey="predicted"
                          stroke="#f97316"
                          strokeWidth={2.5}
                          strokeDasharray="6 3"
                          fill="url(#predGrad)"
                          dot={{ fill: "#f97316", r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          name="Predicted Price"
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">No predictions found</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Run the prediction generator to create 10-day forecasts
                    </p>
                    <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono">
                      py -3.11 generate_predictions.py
                    </code>
                  </div>
                )}
              </div>

              {/* 10-day prediction table */}
              {predictions && predictions.filter(p => new Date(p.prediction_date) > today).length > 0 && (
                <div className="card-elevated p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    10-Day Forecast Table — {selectedCommodityData?.name}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs uppercase">
                          <th className="text-left pb-2">Day</th>
                          <th className="text-left pb-2">Date</th>
                          <th className="text-right pb-2">Predicted ₹/kg</th>
                          <th className="text-right pb-2">Low</th>
                          <th className="text-right pb-2">High</th>
                          <th className="text-right pb-2">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictions
                          .filter(p => new Date(p.prediction_date) > today)
                          .sort((a, b) => new Date(a.prediction_date).getTime() - new Date(b.prediction_date).getTime())
                          .slice(0, 10)
                          .map((p, i) => {
                            const price = Number(p.predicted_price);
                            const todayPrice = Number(latestActual?.price || price);
                            const diff = price - todayPrice;
                            return (
                              <tr key={p.id} className={cn("border-b border-muted/50 hover:bg-muted/20", i === 0 && "bg-orange-50/50")}>
                                <td className="py-2 font-medium">
                                  {i === 0 ? <Badge className="text-xs bg-orange-500">Tomorrow</Badge> : `Day ${i + 1}`}
                                </td>
                                <td className="py-2 text-muted-foreground">
                                  {format(new Date(p.prediction_date), "EEE, MMM dd")}
                                </td>
                                <td className="py-2 text-right font-bold">₹{price.toFixed(2)}</td>
                                <td className="py-2 text-right text-muted-foreground text-xs">
                                  ₹{p.confidence_lower ? Number(p.confidence_lower).toFixed(2) : "—"}
                                </td>
                                <td className="py-2 text-right text-muted-foreground text-xs">
                                  ₹{p.confidence_upper ? Number(p.confidence_upper).toFixed(2) : "—"}
                                </td>
                                <td className="py-2 text-right">
                                  <span className={cn(
                                    "text-xs font-medium",
                                    diff > 0 ? "text-red-500" : "text-green-600"
                                  )}>
                                    {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({((p.confidence_score || 0.85) * 100).toFixed(0)}%)
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
