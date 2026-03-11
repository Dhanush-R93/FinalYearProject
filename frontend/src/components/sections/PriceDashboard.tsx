import { TrendingUp, TrendingDown, Minus, Loader2, Package, RefreshCw, CloudDownload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLatestPrices } from "@/hooks/useCommodities";
import { useRealtimePriceData } from "@/hooks/useRealtimeData";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface CommodityCardProps {
  name: string;
  price: number;
  unit: string;
  change: number;
  changePercent: number;
  icon: string | null;
  mandiName?: string;
  source?: string | null;
}

function CommodityCard({ name, price, unit, change, changePercent, icon, mandiName, source }: CommodityCardProps) {
  const isUp = change > 0;
  const isDown = change < 0;
  const isNeutral = change === 0;

  return (
    <div className="group/card relative card-interactive p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/30 cursor-pointer">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover/card:from-primary/[0.03] group-hover/card:to-secondary/[0.03] transition-all duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl transition-transform duration-300 group-hover/card:scale-110 group-hover/card:rotate-6">{icon || "🌾"}</div>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-all duration-300 group-hover/card:scale-105",
              isUp && "bg-price-up/10 text-price-up group-hover/card:bg-price-up/20",
              isDown && "bg-price-down/10 text-price-down group-hover/card:bg-price-down/20",
              isNeutral && "bg-price-neutral/10 text-price-neutral group-hover/card:bg-price-neutral/20"
            )}
          >
            {isUp && <TrendingUp className="h-3 w-3" />}
            {isDown && <TrendingDown className="h-3 w-3" />}
            {isNeutral && <Minus className="h-3 w-3" />}
            {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
          </div>
        </div>

        <h3 className="font-semibold text-lg text-foreground mb-1 transition-colors duration-300 group-hover/card:text-primary">{name}</h3>
        {mandiName && (
          <p className="text-xs text-muted-foreground mb-2 transition-colors duration-300 group-hover/card:text-muted-foreground/80">{mandiName}</p>
        )}
        {source && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mb-3 transition-all duration-300",
            source === "data_gov_in"
              ? "bg-price-up/10 text-price-up group-hover/card:bg-price-up/15"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover/card:bg-amber-500/15"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", source === "data_gov_in" ? "bg-price-up" : "bg-amber-500")} />
            {source === "data_gov_in" ? "Live API" : "Simulated"}
          </span>
        )}

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground transition-all duration-300 group-hover/card:text-3xl group-hover/card:text-primary">₹{price.toFixed(0)}</span>
          <span className="text-sm text-muted-foreground">/{unit}</span>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-sm group-hover/card:border-primary/20 transition-colors duration-300">
          <span className="text-muted-foreground">Change</span>
          <span className={cn(
            "font-medium transition-all duration-300 group-hover/card:font-bold",
            isUp && "text-price-up",
            isDown && "text-price-down",
            isNeutral && "text-price-neutral"
          )}>
            {change > 0 ? "+" : ""}₹{change.toFixed(2)}
          </span>
        </div>
      </div>
      
      {/* Bottom highlight bar on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent scale-x-0 group-hover/card:scale-x-100 transition-transform duration-500 origin-left" />
    </div>
  );
}

function PriceCardSkeleton() {
  return (
    <div className="card-interactive p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-24 mb-1" />
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-28" />
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function PriceDashboard() {
  const { data: commodities, isLoading, error, refetch, isFetching } = useLatestPrices();
  const { lastUpdate } = useRealtimePriceData();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-prices");
      if (error) throw error;
      toast.success(`Synced ${data.records_inserted} price records from ${data.commodities_updated} commodities`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync prices");
    } finally {
      setSyncing(false);
    }
  };

  const lastUpdated = commodities?.[0]?.recordedAt
    ? formatDistanceToNow(new Date(commodities[0].recordedAt), { addSuffix: true })
    : "recently";

  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section id="dashboard" className="py-16 bg-muted/30">
      <div className="container px-4">
        {/* Section Header */}
        <div
          ref={headerRef}
          className={cn(
            "section-header transition-all duration-700",
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="badge-primary mb-4">
            <span className="h-2 w-2 rounded-full bg-price-up animate-pulse" />
            Live Market Data
          </div>
          <h2 className="section-title">Today's Market Prices</h2>
          <p className="section-description">
            Real-time commodity prices from major agricultural markets across India
          </p>
        </div>

        {/* Last Updated with Real-time indicator */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-card border border-border text-sm">
            <LiveIndicator lastUpdate={lastUpdate} />
            <span className="text-muted-foreground">Updated {lastUpdated}</span>
            <button 
              onClick={() => refetch()}
              className="p-1 hover:bg-muted rounded-full transition-colors"
              disabled={isFetching}
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isFetching && "animate-spin")} />
            </button>
            <button
              onClick={handleSync}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudDownload className="h-3 w-3" />}
              {syncing ? "Syncing…" : "Sync Prices"}
            </button>
          </div>
        </div>

        {/* Loading State with Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <PriceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-16 bg-destructive/5 rounded-xl border border-destructive/20">
            <p className="text-destructive font-medium">Failed to load prices. Please try again.</p>
          </div>
        )}

        {/* Commodity Grid */}
        {commodities && commodities.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {commodities.map((commodity, index) => (
              <div
                key={commodity.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CommodityCard
                  name={commodity.name}
                  price={commodity.price}
                  unit={commodity.unit}
                  change={commodity.change}
                  changePercent={commodity.changePercent}
                  icon={commodity.icon}
                  mandiName={commodity.mandiName}
                  source={commodity.source}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {commodities && commodities.length === 0 && (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No commodities available yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
