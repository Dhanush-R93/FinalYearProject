import { useState, useEffect } from "react";
import { MapPin, Loader2, Navigation, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const VEGETABLES = [
  {name:"Tomato",emoji:"🍅"},{name:"Onion",emoji:"🧅"},{name:"Potato",emoji:"🥔"},
  {name:"Brinjal",emoji:"🍆"},{name:"Cabbage",emoji:"🥬"},{name:"Cauliflower",emoji:"🥦"},
  {name:"Carrot",emoji:"🥕"},{name:"Beans",emoji:"🫘"},{name:"Capsicum",emoji:"🫑"},
  {name:"Lady Finger",emoji:"🌿"},{name:"Bitter Gourd",emoji:"🥒"},
  {name:"Bottle Gourd",emoji:"🫙"},{name:"Drumstick",emoji:"🌿"},
  {name:"Pumpkin",emoji:"🎃"},{name:"Spinach",emoji:"🥬"},
];

// Exact districts from DB with coordinates
const TN_DISTRICTS = [
  { name:"Salem",           lat:11.65, lng:78.16 },
  { name:"Coimbatore",      lat:11.01, lng:76.96 },
  { name:"Erode",           lat:11.34, lng:77.72 },
  { name:"Namakkal",        lat:11.22, lng:78.17 },
  { name:"Karur",           lat:10.96, lng:78.08 },
  { name:"Dharmapuri",      lat:12.13, lng:78.16 },
  { name:"Vellore",         lat:12.92, lng:79.13 },
  { name:"Villupuram",      lat:11.94, lng:79.49 },
  { name:"Thanjavur",       lat:10.79, lng:79.14 },
  { name:"Thiruchirappalli",lat:10.79, lng:78.70 },
  { name:"Thiruvannamalai", lat:12.23, lng:79.07 },
  { name:"Nagapattinam",    lat:10.76, lng:79.84 },
  { name:"Cuddalore",       lat:11.75, lng:79.77 },
  { name:"Pudukkottai",     lat:10.37, lng:78.82 },
  { name:"Dindigul",        lat:10.36, lng:77.98 },
  { name:"Ariyalur",        lat:11.13, lng:79.08 },
  { name:"Thiruvarur",      lat:10.77, lng:79.64 },
];

const DISTRICT_SEARCH = TN_DISTRICTS.map(d => d.name);

function getDistance(lat1:number,lng1:number,lat2:number,lng2:number):number {
  const R=6371,dLat=((lat2-lat1)*Math.PI)/180,dLng=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export function NearbyMandis() {
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [showPopup, setShowPopup] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState("Tomato");
  const [markets, setMarkets] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("agri_loc_v4");
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserLoc(parsed.coords);
      setSelectedDistrict(parsed.district);
    } else {
      setTimeout(() => setShowPopup(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (selectedDistrict) fetchMarkets(selectedDistrict, selectedVeg);
  }, [selectedDistrict, selectedVeg]);

  const requestLocation = () => {
    setShowPopup(false);
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setUserLoc(loc);
        // Find nearest district
        const nearest = TN_DISTRICTS
          .map(d => ({ ...d, dist: getDistance(loc.lat, loc.lng, d.lat, d.lng) }))
          .sort((a,b) => a.dist - b.dist)[0];
        setSelectedDistrict(nearest.name);
        localStorage.setItem("agri_loc_v4", JSON.stringify({ coords: loc, district: nearest.name }));
        setLocLoading(false);
      },
      () => {
        setSelectedDistrict("Salem");
        setLocLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const fetchMarkets = async (district: string, vegName: string) => {
    setLoadingPrices(true);
    setMarkets([]);
    try {
      // Get commodity id
      const { data: comm } = await supabase
        .from("commodities").select("id").eq("name", vegName).single();
      if (!comm) { setLoadingPrices(false); return; }

      // Fetch all prices for this district — last 30 days
      const fromDate = new Date(Date.now()-30*86400000).toISOString().split("T")[0];
      const { data: rows } = await supabase
        .from("price_data")
        .select("price,min_price,max_price,mandi_name,mandi_location,recorded_at,source")
        .eq("commodity_id", comm.id)
        .eq("mandi_location", district)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (!rows || rows.length === 0) {
        setMarkets([]);
        setLoadingPrices(false);
        return;
      }

      // Deduplicate by mandi_name — keep latest per mandi
      const mandiMap = new Map<string, any>();
      for (const row of rows) {
        const key = row.mandi_name;
        if (!mandiMap.has(key)) mandiMap.set(key, row);
      }

      // Sort by price ascending (cheapest first) and take top 10
      const sorted = Array.from(mandiMap.values())
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 10);

      setMarkets(sorted);
    } catch(e) {
      console.error(e);
    }
    setLoadingPrices(false);
  };

  const handleSearchInput = (val: string) => {
    setSearch(val);
    if (!val.trim()) { setSuggestions([]); return; }
    setSuggestions(
      DISTRICT_SEARCH.filter(d => d.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
    );
  };

  const selectDistrict = (d: string) => {
    setSelectedDistrict(d);
    setSearch("");
    setSuggestions([]);
    setShowSearch(false);
    localStorage.setItem("agri_loc_v4", JSON.stringify({
      coords: userLoc || { lat: 11.65, lng: 78.16 },
      district: d
    }));
  };

  const emoji = VEGETABLES.find(v => v.name === selectedVeg)?.emoji || "🥬";
  const avgPrice = markets.length
    ? Math.round(markets.reduce((s,m) => s + Number(m.price), 0) / markets.length * 100) / 100
    : 0;
  const minPrice = markets.length ? Math.min(...markets.map(m => Number(m.price))) : 0;
  const maxPrice = markets.length ? Math.max(...markets.map(m => Number(m.price))) : 0;

  return (
    <>
      {/* Location popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-primary"/>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Find Nearby Mandis</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Allow location to see markets near you, or search your district manually
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={requestLocation}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                <Navigation className="h-4 w-4"/>Allow Location Access
              </button>
              <button onClick={() => { setShowPopup(false); setShowSearch(true); }}
                className="w-full border border-border text-foreground font-medium py-3 rounded-xl hover:bg-muted transition-all flex items-center justify-center gap-2">
                <Search className="h-4 w-4"/>Search My District
              </button>
              <button onClick={() => { setShowPopup(false); setSelectedDistrict("Salem"); }}
                className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors">
                Skip — Show Tamil Nadu Markets
              </button>
            </div>
          </div>
        </div>
      )}

      <section id="nearby-mandis" className="py-16 bg-muted/20">
        <div className="container px-4">

          {/* Header */}
          <div className="section-header">
            <div className="badge-primary mb-4">
              <Navigation className="h-4 w-4"/>Nearby Markets
            </div>
            <h2 className="section-title">Markets Near You</h2>
            <p className="section-description">
              Top 10 markets in your district with real vegetable prices
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">

            {/* Location / District selector */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => setShowSearch(!showSearch)}>
                <MapPin className="h-4 w-4 text-primary"/>
                {locLoading
                  ? <><Loader2 className="h-3 w-3 animate-spin"/><span>Detecting...</span></>
                  : <span className="font-medium">{selectedDistrict || "Select District"}</span>
                }
                <Search className="h-3 w-3 text-muted-foreground ml-1"/>
              </div>

              {/* District search dropdown */}
              {showSearch && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0"/>
                      <input
                        autoFocus
                        value={search}
                        onChange={e => handleSearchInput(e.target.value)}
                        placeholder="Type district name..."
                        className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                      />
                      <button onClick={() => { setShowSearch(false); setSearch(""); setSuggestions([]); }}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground"/>
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {(suggestions.length > 0 ? suggestions : DISTRICT_SEARCH).map(d => (
                      <button key={d} onClick={() => selectDistrict(d)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm transition-all hover:bg-primary/5 hover:text-primary flex items-center gap-2",
                          selectedDistrict === d && "bg-primary/10 text-primary font-medium"
                        )}>
                        <MapPin className="h-3 w-3 shrink-0"/>
                        {d}
                        {selectedDistrict === d && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* GPS button */}
            <button onClick={requestLocation}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-sm font-medium px-4 py-2 rounded-full transition-all">
              <Navigation className="h-3 w-3"/>Use GPS
            </button>

            {/* Refresh */}
            <button onClick={() => selectedDistrict && fetchMarkets(selectedDistrict, selectedVeg)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-3 py-2 rounded-full border border-border hover:border-primary/30 transition-all">
              <RefreshCw className={cn("h-3 w-3", loadingPrices && "animate-spin")}/>
              Refresh
            </button>
          </div>

          {/* Vegetable pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {VEGETABLES.map(v => (
              <button key={v.name} onClick={() => setSelectedVeg(v.name)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                  selectedVeg === v.name
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}>
                <span>{v.emoji}</span>{v.name}
              </button>
            ))}
          </div>

          {/* Summary stats */}
          {markets.length > 0 && (
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
              {[
                { label:"Lowest", value:`₹${minPrice.toFixed(2)}`, color:"text-green-600" },
                { label:"Average", value:`₹${avgPrice.toFixed(2)}`, color:"text-foreground" },
                { label:"Highest", value:`₹${maxPrice.toFixed(2)}`, color:"text-red-500" },
              ].map(s => (
                <div key={s.label} className="card-elevated p-4 text-center rounded-2xl">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Markets table */}
          {!selectedDistrict ? (
            <div className="text-center py-16">
              <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-lg font-medium text-foreground mb-2">Select Your District</p>
              <p className="text-muted-foreground text-sm mb-4">Choose a district to see nearby market prices</p>
              <button onClick={() => setShowSearch(true)}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-all">
                Search District
              </button>
            </div>
          ) : loadingPrices ? (
            <div className="space-y-3 max-w-3xl mx-auto">
              {Array(5).fill(0).map((_,i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse"/>
              ))}
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-lg font-medium mb-1">No data for {selectedVeg} in {selectedDistrict}</p>
              <p className="text-muted-foreground text-sm">Try another vegetable or district</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="card-elevated rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{emoji}</span>
                    <h3 className="font-bold text-foreground">
                      {selectedVeg} — {selectedDistrict} District
                    </h3>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {markets.length} markets found
                    </span>
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-muted/10">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Market Name</div>
                  <div className="col-span-2 text-right">Price/kg</div>
                  <div className="col-span-2 text-right">Range</div>
                  <div className="col-span-2 text-right">Updated</div>
                </div>

                {/* Rows */}
                {markets.map((m, idx) => {
                  const price = Number(m.price);
                  const isBest = idx === 0;
                  const isMostExpensive = idx === markets.length - 1;
                  const isLive = m.source === "agmarknet_gov_in";
                  const timeAgo = m.recorded_at
                    ? formatDistanceToNow(new Date(m.recorded_at), { addSuffix: true })
                    : "—";
                  const vsAvg = price - avgPrice;

                  // Clean mandi name — remove variety in parentheses
                  const cleanName = m.mandi_name?.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || m.mandi_name;

                  return (
                    <div key={idx}
                      className={cn(
                        "grid grid-cols-12 px-6 py-4 border-b border-border/50 hover:bg-muted/20 transition-all items-center",
                        isBest && "bg-green-50/50 dark:bg-green-950/20",
                      )}>
                      <div className="col-span-1">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          isBest ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {idx + 1}
                        </div>
                      </div>

                      <div className="col-span-5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                          <div>
                            <p className="text-sm font-medium text-foreground leading-tight">
                              {cleanName}
                              {isBest && (
                                <span className="ml-2 text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                                  Best
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{m.mandi_location}</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 text-right">
                        <p className={cn(
                          "text-base font-black",
                          isBest ? "text-green-600" : isMostExpensive ? "text-red-500" : "text-foreground"
                        )}>
                          ₹{price.toFixed(2)}
                        </p>
                        <p className={cn(
                          "text-xs font-medium",
                          vsAvg < 0 ? "text-green-500" : vsAvg > 0 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {vsAvg === 0 ? "avg" : `${vsAvg > 0 ? "+" : ""}${vsAvg.toFixed(1)}`}
                        </p>
                      </div>

                      <div className="col-span-2 text-right">
                        {m.min_price && m.max_price ? (
                          <p className="text-xs text-muted-foreground">
                            ₹{Number(m.min_price).toFixed(0)}–₹{Number(m.max_price).toFixed(0)}
                          </p>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                        <div className={cn(
                          "text-xs mt-0.5",
                          isLive ? "text-green-500" : "text-blue-400"
                        )}>
                          {isLive ? "✅ Live" : "📊 Est"}
                        </div>
                      </div>

                      <div className="col-span-2 text-right">
                        <p className="text-xs text-muted-foreground">{timeAgo}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-xs text-muted-foreground mt-4">
                📊 Data from data.gov.in Agmarknet · Sorted by price (cheapest first)
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
