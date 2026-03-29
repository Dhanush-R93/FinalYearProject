import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Search, MapPin } from "lucide-react";
import { useLatestPrices } from "@/hooks/useCommodities";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const EMOJI_MAP: Record<string, string> = {
  Tomato:"🍅", Onion:"🧅", Potato:"🥔", Brinjal:"🍆", Cabbage:"🥬",
  Cauliflower:"🥦", Carrot:"🥕", Beans:"🫘", Capsicum:"🫑",
  "Lady Finger":"🌿", "Bitter Gourd":"🥒", "Bottle Gourd":"🥬",
  Drumstick:"🌿", Pumpkin:"🎃", Spinach:"🥬",
};

export function PriceDashboard() {
  const { data: prices, isLoading, refetch, isFetching } = useLatestPrices();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name"|"price"|"change">("name");

  const filtered = (prices || [])
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price") return (b.price||0) - (a.price||0);
      if (sortBy === "change") return (b.changePercent||0) - (a.changePercent||0);
      return a.name.localeCompare(b.name);
    });

  return (
    <section id="dashboard" className="py-20 bg-[#0d120d]">
      <div className="container px-4 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-green-400 text-sm font-medium">Live Market Data</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Today's Prices</h2>
            <p className="text-white/40 text-sm mt-1">Tamil Nadu Agmarknet — real wholesale rates</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-4 py-2 rounded-xl text-sm transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")}/>
            Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <Search className="w-4 h-4 text-white/30"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vegetable..."
              className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {(["name","price","change"] as const).map(s => (
              <button key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize",
                  sortBy === s
                    ? "bg-green-500 text-black"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                )}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array(15).fill(0).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse"/>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {filtered.map(item => {
              const price = Number(item.price) || 0;
              const change = Number(item.changePercent) || 0;
              const isUp = change > 0;
              const isDown = change < 0;

              return (
                <div key={item.id}
                  className="group relative bg-white/3 hover:bg-white/6 border border-white/8 hover:border-green-500/30 rounded-2xl p-5 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(34,197,94,0.08)]"
                >
                  {/* Change badge */}
                  <div className={cn(
                    "absolute top-3 right-3 flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold",
                    isUp ? "bg-red-500/15 text-red-400" :
                    isDown ? "bg-green-500/15 text-green-400" :
                    "bg-white/10 text-white/40"
                  )}>
                    {isUp ? <TrendingUp className="w-3 h-3"/> :
                     isDown ? <TrendingDown className="w-3 h-3"/> :
                     <Minus className="w-3 h-3"/>}
                    {Math.abs(change).toFixed(1)}%
                  </div>

                  {/* Icon */}
                  <div className="text-3xl mb-3">
                    {EMOJI_MAP[item.name] || "🌿"}
                  </div>

                  {/* Name */}
                  <p className="text-white/60 text-xs font-medium mb-1">{item.name}</p>

                  {/* Price */}
                  <p className="text-white text-2xl font-black mb-1">
                    {price > 0 ? `₹${price.toFixed(0)}` : "—"}
                    {price > 0 && <span className="text-white/30 text-xs font-normal">/kg</span>}
                  </p>

                  {/* Mandi */}
                  {item.mandiName && (
                    <div className="flex items-center gap-1 mt-2">
                      <MapPin className="w-2.5 h-2.5 text-white/20 shrink-0"/>
                      <p className="text-white/25 text-xs truncate">{item.mandiName.split("(")[0].trim()}</p>
                    </div>
                  )}

                  {/* Source badge */}
                  <div className={cn(
                    "absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full",
                    item.source === "agmarknet_gov_in" ? "bg-green-400" :
                    item.source === "interpolated" ? "bg-blue-400" : "bg-yellow-400"
                  )} title={item.source === "agmarknet_gov_in" ? "Live" : item.source === "interpolated" ? "Estimated" : "Simulated"}/>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-6 text-xs text-white/25">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400"/><span>Live govt data</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400"/><span>Estimated</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400"/><span>Simulated</span></div>
        </div>
      </div>
    </section>
  );
}
