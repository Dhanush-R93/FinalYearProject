import { useState } from "react";
import { TableProperties, Loader2, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCommodities, usePriceData } from "@/hooks/useCommodities";
import { formatDistanceToNow } from "date-fns";

export function MandiComparisonTable() {
  const [selectedCommodity, setSelectedCommodity] = useState<string>("");
  const { data: commodities, isLoading: commoditiesLoading } = useCommodities();
  const { data: priceData, isLoading: priceLoading } = usePriceData(selectedCommodity);

  const isLoading = commoditiesLoading || priceLoading;
  const selectedData = commodities?.find((c) => c.id === selectedCommodity);

  // Group latest price per mandi
  const mandiPrices = (() => {
    if (!priceData || priceData.length === 0) return [];
    const latestByMandi = new Map<string, typeof priceData[0]>();
    for (const row of priceData) {
      const existing = latestByMandi.get(row.mandi_name);
      if (!existing || new Date(row.recorded_at) > new Date(existing.recorded_at)) {
        latestByMandi.set(row.mandi_name, row);
      }
    }
    return Array.from(latestByMandi.values()).sort((a, b) => a.price - b.price);
  })();

  const lowestPrice = mandiPrices.length > 0 ? mandiPrices[0].price : 0;
  const highestPrice = mandiPrices.length > 0 ? mandiPrices[mandiPrices.length - 1].price : 0;
  const avgPrice = mandiPrices.length > 0
    ? mandiPrices.reduce((s, p) => s + p.price, 0) / mandiPrices.length
    : 0;

  return (
    <section id="mandi-comparison" className="py-16">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-secondary mb-4">
            <TableProperties className="h-4 w-4" />
            Mandi Comparison
          </div>
          <h2 className="section-title">Price Across Mandis</h2>
          <p className="section-description">
            Compare the same commodity's price across different markets to find the best deals
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
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

          {/* Empty state */}
          {!selectedCommodity && (
            <div className="card-elevated p-12 text-center">
              <TableProperties className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Select a Commodity</p>
              <p className="text-muted-foreground">Choose a commodity to compare prices across mandis</p>
            </div>
          )}

          {/* Loading */}
          {selectedCommodity && isLoading && (
            <div className="card-elevated p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading mandi prices...</p>
            </div>
          )}

          {/* Table */}
          {selectedCommodity && !isLoading && mandiPrices.length > 0 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Lowest</p>
                  <p className="text-lg font-bold text-price-up">₹{lowestPrice.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Average</p>
                  <p className="text-lg font-bold text-foreground">₹{avgPrice.toFixed(0)}</p>
                </div>
                <div className="stat-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Highest</p>
                  <p className="text-lg font-bold text-price-down">₹{highestPrice.toFixed(0)}</p>
                </div>
              </div>

              {/* Price Table */}
              <div className="card-elevated overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <span className="text-2xl">{selectedData?.icon}</span>
                  <h3 className="font-semibold text-lg">{selectedData?.name} — Mandi-wise Prices</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Mandi</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Price (₹/{selectedData?.unit || "kg"})</TableHead>
                      <TableHead className="text-right">vs Avg</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mandiPrices.map((row, idx) => {
                      const diff = row.price - avgPrice;
                      const isLowest = idx === 0;
                      const isHighest = idx === mandiPrices.length - 1;
                      return (
                        <TableRow
                          key={row.mandi_name}
                          className={cn(
                            isLowest && "bg-price-up/5",
                            isHighest && mandiPrices.length > 1 && "bg-price-down/5"
                          )}
                        >
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{row.mandi_name}</span>
                              {isLowest && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-price-up/10 text-price-up font-semibold">
                                  Best
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.mandi_location || row.state || "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold">₹{row.price.toFixed(2)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium text-sm",
                              diff < 0 && "text-price-up",
                              diff > 0 && "text-price-down",
                              diff === 0 && "text-muted-foreground"
                            )}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(row.recorded_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* No data */}
          {selectedCommodity && !isLoading && mandiPrices.length === 0 && (
            <div className="card-elevated p-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No Mandi Data</p>
              <p className="text-muted-foreground">Price data for this commodity is not yet available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
