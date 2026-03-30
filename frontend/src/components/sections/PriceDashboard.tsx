import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Search, MapPin, Info } from "lucide-react";
import { useLatestPrices } from "@/hooks/useCommodities";
import { formatDistanceToNow } from "date-fns";

const EMOJI: Record<string,string> = {
  Tomato:"🍅",Onion:"🧅",Potato:"🥔",Brinjal:"🍆",Cabbage:"🥬",
  Cauliflower:"🥦",Carrot:"🥕",Beans:"🫘",Capsicum:"🫑",
  "Lady Finger":"🌿","Bitter Gourd":"🥒","Bottle Gourd":"🫙",
  Drumstick:"🌿",Pumpkin:"🎃",Spinach:"🌿",
};

interface Props { location?: string; }

export function PriceDashboard({ location }: Props) {
  const { data: prices, isLoading, refetch, isFetching } = useLatestPrices(location);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name"|"price"|"change">("name");
  const [hoveredId, setHoveredId] = useState<string|null>(null);

  const filtered = (prices||[])
    .filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sort==="price") return (b.price||0)-(a.price||0);
      if (sort==="change") return Math.abs(b.changePercent||0)-Math.abs(a.changePercent||0);
      return (a.name||"").localeCompare(b.name||"");
    });

  const liveCount = (prices||[]).filter(p=>p.source==="agmarknet_gov_in").length;

  return (
    <section id="dashboard" style={{background:"#0a0f0a",paddingTop:"5rem",paddingBottom:"5rem"}}>
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-sm font-medium text-green-400">
                {liveCount > 0 ? `${liveCount} live records` : "Market Data"} · Tamil Nadu Agmarknet
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              {location ? `Prices near ${location}` : "Today's Prices"}
            </h2>
            {location && (
              <p className="text-white/40 text-sm mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3"/>
                Showing best prices for your area
              </p>
            )}
          </div>
          <button onClick={()=>refetch()} disabled={isFetching}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-all text-white/50 hover:text-white"
            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <RefreshCw className={`w-4 h-4 ${isFetching?"animate-spin":""}`}/>
            Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-4 py-2.5"
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <Search className="w-4 h-4 shrink-0" style={{color:"rgba(255,255,255,0.25)"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Filter vegetables..."
              className="flex-1 bg-transparent text-white text-sm outline-none"
              style={{caretColor:"#22c55e"}}/>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.08)"}}>
            {(["name","price","change"] as const).map(s=>(
              <button key={s} onClick={()=>setSort(s)}
                className="px-4 py-2 text-sm font-medium capitalize transition-all"
                style={{
                  background: sort===s ? "#22c55e" : "rgba(255,255,255,0.03)",
                  color: sort===s ? "#000" : "rgba(255,255,255,0.4)",
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array(15).fill(0).map((_,i)=>(
              <div key={i} className="h-44 rounded-2xl animate-pulse" style={{background:"rgba(255,255,255,0.03)"}}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-4xl mb-3">🔍</p>
            <p>No vegetables found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filtered.map(item => {
              const price = Number(item.price)||0;
              const chg = Number(item.changePercent)||0;
              const isUp = chg > 0.5;
              const isDown = chg < -0.5;
              const isHovered = hoveredId === item.id;
              const isLive = item.source === "agmarknet_gov_in";
              const timeAgo = item.recordedAt ? formatDistanceToNow(new Date(item.recordedAt), {addSuffix:true}) : null;

              return (
                <div key={item.id}
                  onMouseEnter={()=>setHoveredId(item.id)}
                  onMouseLeave={()=>setHoveredId(null)}
                  className="relative rounded-2xl p-4 transition-all duration-200 cursor-pointer"
                  style={{
                    background: isHovered ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)",
                    border: isHovered ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    boxShadow: isHovered ? "0 8px 30px rgba(34,197,94,0.08)" : "none",
                  }}>

                  {/* Change badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: isUp ? "rgba(239,68,68,0.12)" : isDown ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                      color: isUp ? "#f87171" : isDown ? "#4ade80" : "rgba(255,255,255,0.3)",
                    }}>
                    {isUp ? <TrendingUp className="w-3 h-3"/> : isDown ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                    {Math.abs(chg).toFixed(1)}%
                  </div>

                  {/* Emoji */}
                  <div className="text-3xl mb-3">{EMOJI[item.name]||"🌿"}</div>

                  {/* Name */}
                  <p className="text-xs font-medium mb-1 truncate" style={{color:"rgba(255,255,255,0.45)"}}>{item.name}</p>

                  {/* Price */}
                  <p className="text-2xl font-black text-white">
                    {price > 0 ? `₹${price % 1 === 0 ? price : price.toFixed(1)}` : "—"}
                    {price > 0 && <span className="text-xs font-normal ml-0.5" style={{color:"rgba(255,255,255,0.2)"}}>/kg</span>}
                  </p>

                  {/* Mandi */}
                  {item.mandiName && item.mandiName !== "N/A" && (
                    <div className="flex items-center gap-1 mt-2">
                      <MapPin className="w-2.5 h-2.5 shrink-0" style={{color:"rgba(255,255,255,0.18)"}}/>
                      <p className="text-xs truncate" style={{color:"rgba(255,255,255,0.2)"}}>
                        {item.mandiName.split("(")[0].trim().replace(/\(.*\)/g,"")}
                      </p>
                    </div>
                  )}

                  {/* Time ago on hover */}
                  {isHovered && timeAgo && (
                    <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.2)"}}>{timeAgo}</p>
                  )}

                  {/* Source indicator */}
                  <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full"
                    style={{background: isLive ? "#22c55e" : item.source==="interpolated" ? "#60a5fa" : "#f59e0b"}}
                    title={isLive?"Live govt data":item.source==="interpolated"?"Estimated":"Simulated"}/>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend + summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-5 text-xs" style={{color:"rgba(255,255,255,0.2)"}}>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400"/><span>Live (Agmarknet)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background:"#60a5fa"}}/><span>Estimated</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background:"#f59e0b"}}/><span>Simulated</span></div>
          </div>
          <p className="text-xs" style={{color:"rgba(255,255,255,0.15)"}}>
            {filtered.length} commodities · Data from data.gov.in Agmarknet
          </p>
        </div>
      </div>
    </section>
  );
}
