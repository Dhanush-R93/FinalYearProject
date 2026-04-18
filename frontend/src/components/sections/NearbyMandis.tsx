import { useState, useEffect } from "react";
import { MapPin, Loader2, Navigation, RefreshCw, Search, X, ChevronDown } from "lucide-react";
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

// Exact districts from DB
const TN_DISTRICTS = [
  "Salem","Coimbatore","Erode","Namakkal","Karur","Dharmapuri",
  "Vellore","Villupuram","Thanjavur","Thiruchirappalli","Thiruvannamalai",
  "Nagapattinam","Cuddalore","Pudukkottai","Dindigul","Ariyalur","Thiruvarur",
];

const DISTRICT_COORDS: Record<string,{lat:number;lng:number}> = {
  "Salem":{lat:11.65,lng:78.16},"Coimbatore":{lat:11.01,lng:76.96},
  "Erode":{lat:11.34,lng:77.72},"Namakkal":{lat:11.22,lng:78.17},
  "Karur":{lat:10.96,lng:78.08},"Dharmapuri":{lat:12.13,lng:78.16},
  "Vellore":{lat:12.92,lng:79.13},"Villupuram":{lat:11.94,lng:79.49},
  "Thanjavur":{lat:10.79,lng:79.14},"Thiruchirappalli":{lat:10.79,lng:78.70},
  "Thiruvannamalai":{lat:12.23,lng:79.07},"Nagapattinam":{lat:10.76,lng:79.84},
  "Cuddalore":{lat:11.75,lng:79.77},"Pudukkottai":{lat:10.37,lng:78.82},
  "Dindigul":{lat:10.36,lng:77.98},"Ariyalur":{lat:11.13,lng:79.08},
  "Thiruvarur":{lat:10.77,lng:79.64},
};

function getDist(lat1:number,lng1:number,lat2:number,lng2:number){
  const R=6371,dL=((lat2-lat1)*Math.PI)/180,dG=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dL/2)**2+Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dG/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export function NearbyMandis() {
  const [selectedDistrict, setSelectedDistrict] = useState("Salem");
  const [selectedVeg, setSelectedVeg] = useState("Tomato");
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [avgPrice, setAvgPrice] = useState(0);

  // Auto-load saved district on mount
  useEffect(() => {
    const saved = localStorage.getItem("agri_loc_v4");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.district && TN_DISTRICTS.includes(p.district)) setSelectedDistrict(p.district);
      } catch {}
    }
  }, []);

  useEffect(() => { fetchMarkets(selectedDistrict, selectedVeg); }, [selectedDistrict, selectedVeg]);

  const fetchMarkets = async (district: string, veg: string) => {
    setLoading(true);
    setMarkets([]);
    try {
      const { data: comm } = await supabase
        .from("commodities").select("id").eq("name", veg).single();
      if (!comm) { setLoading(false); return; }

      // Only last 3 days — skip stale markets
      const from = new Date(Date.now()-3*86400000).toISOString().split("T")[0];
      const { data: rows } = await supabase
        .from("price_data")
        .select("price,min_price,max_price,mandi_name,mandi_location,recorded_at,source")
        .eq("commodity_id", comm.id)
        .eq("mandi_location", district)
        .gte("recorded_at", from)
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (!rows?.length) { setLoading(false); return; }

      // Deduplicate by normalized mandi name (strip variety/type in parentheses)
      const normalizeName = (name: string) =>
        name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

      const seen = new Map<string,any>();
      for (const r of rows) {
        const key = normalizeName(r.mandi_name || '');
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, r);
        } else {
          // Prefer more recent record
          if (new Date(r.recorded_at) > new Date(existing.recorded_at)) {
            seen.set(key, r);
          }
        }
      }

      const sorted = Array.from(seen.values())
        .sort((a,b) => Number(a.price)-Number(b.price))
        .slice(0,10);

      const avg = sorted.reduce((s,m)=>s+Number(m.price),0)/sorted.length;
      setAvgPrice(Math.round(avg*100)/100);
      setMarkets(sorted);
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  const useGPS = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Find nearest district
        const nearest = TN_DISTRICTS
          .filter(d => DISTRICT_COORDS[d])
          .map(d => ({ d, dist: getDist(coords.latitude, coords.longitude, DISTRICT_COORDS[d].lat, DISTRICT_COORDS[d].lng) }))
          .sort((a,b) => a.dist-b.dist)[0];
        if (nearest) {
          setSelectedDistrict(nearest.d);
          localStorage.setItem("agri_loc_v4", JSON.stringify({ coords: { lat: coords.latitude, lng: coords.longitude }, district: nearest.d }));
        }
        setLocLoading(false);
      },
      () => setLocLoading(false),
      { timeout: 8000 }
    );
  };

  const selectDistrict = (d: string) => {
    setSelectedDistrict(d);
    setSearchOpen(false);
    setSearchText("");
    localStorage.setItem("agri_loc_v4", JSON.stringify({ district: d }));
  };

  const filtered = TN_DISTRICTS.filter(d =>
    searchText ? d.toLowerCase().includes(searchText.toLowerCase()) : true
  );

  const emoji = VEGETABLES.find(v=>v.name===selectedVeg)?.emoji||"🥬";
  const minP = markets.length ? Math.min(...markets.map(m=>Number(m.price))) : 0;
  const maxP = markets.length ? Math.max(...markets.map(m=>Number(m.price))) : 0;

  return (
    <section id="nearby-mandis" className="py-16 bg-muted/20">
      <div className="container px-4">

        {/* Header */}
        <div className="section-header">
          <div className="badge-primary mb-4"><Navigation className="h-4 w-4"/>Nearby Markets</div>
          <h2 className="section-title">Markets Near You</h2>
          <p className="section-description">Top 10 markets in your district with real vegetable prices</p>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">

          {/* District picker */}
          <div className="relative">
            <button onClick={()=>setSearchOpen(v=>!v)}
              className="flex items-center gap-2 bg-card border border-border hover:border-primary/40 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all min-w-[160px]">
              <MapPin className="h-4 w-4 text-primary shrink-0"/>
              <span className="flex-1 text-left">{selectedDistrict}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", searchOpen && "rotate-180")}/>
            </button>

            {searchOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0"/>
                  <input autoFocus value={searchText} onChange={e=>setSearchText(e.target.value)}
                    placeholder="Search district..."
                    className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"/>
                  {searchText && <button onClick={()=>setSearchText("")}><X className="h-3.5 w-3.5 text-muted-foreground"/></button>}
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filtered.map(d=>(
                    <button key={d} onClick={()=>selectDistrict(d)}
                      className={cn("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-all hover:bg-primary/5 hover:text-primary",
                        selectedDistrict===d && "bg-primary/10 text-primary font-semibold")}>
                      <MapPin className="h-3.5 w-3.5 shrink-0"/>
                      {d}
                      {selectedDistrict===d && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GPS button */}
          <button onClick={useGPS} disabled={locLoading}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
            {locLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Navigation className="h-3.5 w-3.5"/>}
            Use GPS
          </button>

          {/* Refresh */}
          <button onClick={()=>fetchMarkets(selectedDistrict,selectedVeg)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 px-4 py-2.5 rounded-xl transition-all">
            <RefreshCw className={cn("h-3.5 w-3.5",loading&&"animate-spin")}/>
            Refresh
          </button>
        </div>

        {/* Vegetable pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {VEGETABLES.map(v=>(
            <button key={v.name} onClick={()=>setSelectedVeg(v.name)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                selectedVeg===v.name
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground")}>
              <span>{v.emoji}</span>{v.name}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        {markets.length>0 && !loading && (
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
            {[
              {label:"Lowest",value:`₹${minP.toFixed(2)}`,color:"text-green-600"},
              {label:"Average",value:`₹${avgPrice.toFixed(2)}`,color:"text-foreground"},
              {label:"Highest",value:`₹${maxP.toFixed(2)}`,color:"text-red-500"},
            ].map(s=>(
              <div key={s.label} className="card-elevated p-4 text-center rounded-2xl">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={cn("text-xl font-black",s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2 max-w-3xl mx-auto">
            {Array(5).fill(0).map((_,i)=>(
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>
            ))}
          </div>
        ) : markets.length===0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-lg font-semibold text-foreground mb-1">No data for {selectedVeg} in {selectedDistrict}</p>
            <p className="text-muted-foreground text-sm mb-4">Run <code className="bg-muted px-2 py-0.5 rounded">py -3.11 seed_prices.py</code> to fetch latest data</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TN_DISTRICTS.filter(d=>d!==selectedDistrict).slice(0,4).map(d=>(
                <button key={d} onClick={()=>selectDistrict(d)}
                  className="text-sm bg-card border border-border hover:border-primary/40 px-4 py-2 rounded-xl transition-all text-muted-foreground hover:text-primary">
                  Try {d}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="card-elevated rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
                <span className="text-xl">{emoji}</span>
                <div>
                  <h3 className="font-bold text-foreground">{selectedVeg} — {selectedDistrict} District</h3>
                  <p className="text-xs text-muted-foreground">{markets.length} markets · sorted cheapest first</p>
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
              {markets.map((m,i)=>{
                const price = Number(m.price);
                const isBest = i===0;
                const isMostExp = i===markets.length-1;
                const isLive = m.source==="agmarknet_gov_in";
                const vsAvg = Math.round((price-avgPrice)*100)/100;
                const cleanName = m.mandi_name?.replace(/\s*\(Uzhavar Sandhai\s*\)\s*/gi,' ').replace(/\s*\([^)]*\)\s*/g,' ').replace(/APMC\s*$/,'APMC').trim();
                const timeAgo = m.recorded_at ? formatDistanceToNow(new Date(m.recorded_at),{addSuffix:true}) : "—";

                return (
                  <div key={i} className={cn(
                    "grid grid-cols-12 px-6 py-4 border-b border-border/50 hover:bg-muted/20 transition-all items-center",
                    isBest && "bg-green-50/50 dark:bg-green-950/20"
                  )}>
                    <div className="col-span-1">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                        isBest?"bg-green-500 text-white":"bg-muted text-muted-foreground")}>
                        {i+1}
                      </div>
                    </div>

                    <div className="col-span-5">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">
                            {cleanName}
                            {isBest&&<span className="ml-2 text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 rounded-full">Best</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.mandi_location}</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className={cn("text-base font-black",
                        isBest?"text-green-600":isMostExp?"text-red-500":"text-foreground")}>
                        ₹{price.toFixed(2)}
                      </p>
                      <p className={cn("text-xs font-medium",
                        vsAvg<0?"text-green-500":vsAvg>0?"text-red-400":"text-muted-foreground")}>
                        {vsAvg===0?"avg":vsAvg>0?`+${vsAvg.toFixed(1)}`:`${vsAvg.toFixed(1)}`}
                      </p>
                    </div>

                    <div className="col-span-2 text-right">
                      {m.min_price&&m.max_price?(
                        <p className="text-xs text-muted-foreground">₹{Number(m.min_price).toFixed(0)}–₹{Number(m.max_price).toFixed(0)}</p>
                      ):<span className="text-xs text-muted-foreground">—</span>}
                      <p className={cn("text-xs mt-0.5",isLive?"text-green-500":"text-blue-400")}>
                        {isLive?"✅ Live":"📊 Est"}
                      </p>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="text-xs text-muted-foreground">{timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              📊 Data from data.gov.in Agmarknet · Sorted cheapest first · Run seed_prices.py daily for fresh data
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
