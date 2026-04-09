import { useState, useEffect } from "react";
import { MapPin, Loader2, Navigation, RefreshCw, ChevronDown } from "lucide-react";
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

function getStateFromCoords(lat: number, lng: number): string {
  if (lat >= 8 && lat <= 13.5 && lng >= 76.5 && lng <= 80.5) return "Tamil Nadu";
  if (lat >= 8 && lat <= 12.5 && lng >= 74.5 && lng <= 77.5) return "Kerala";
  if (lat >= 14 && lat <= 19.5 && lng >= 74 && lng <= 78.5) return "Karnataka";
  return "Tamil Nadu";
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// TN districts with coordinates — matches DB mandi_location field
const TN_LOCATIONS = [
  { name: "Chennai",        district: "Chennai",          lat: 13.07, lng: 80.19 },
  { name: "Madurai",        district: "Madurai",          lat: 9.92,  lng: 78.12 },
  { name: "Coimbatore",     district: "Coimbatore",       lat: 11.01, lng: 76.96 },
  { name: "Salem",          district: "Salem",            lat: 11.65, lng: 78.16 },
  { name: "Trichy",         district: "Tiruchirappalli",  lat: 10.79, lng: 78.70 },
  { name: "Erode",          district: "Erode",            lat: 11.34, lng: 77.72 },
  { name: "Tirunelveli",    district: "Thirunelveli",     lat: 8.72,  lng: 77.69 },
  { name: "Namakkal",       district: "Namakkal",         lat: 11.22, lng: 78.17 },
  { name: "Vellore",        district: "Vellore",          lat: 12.92, lng: 79.13 },
  { name: "Dindigul",       district: "Dindigul",         lat: 10.36, lng: 77.98 },
  { name: "Thanjavur",      district: "Thanjavur",        lat: 10.79, lng: 79.14 },
  { name: "Tuticorin",      district: "Tuticorin",        lat: 8.79,  lng: 78.13 },
  { name: "Villupuram",     district: "Villupuram",       lat: 11.94, lng: 79.49 },
  { name: "Theni",          district: "Theni",            lat: 10.01, lng: 77.48 },
  { name: "Krishnagiri",    district: "Krishnagiri",      lat: 12.52, lng: 78.21 },
  { name: "Dharmapuri",     district: "Dharmapuri",       lat: 12.13, lng: 78.16 },
  { name: "Kancheepuram",   district: "Kancheepuram",     lat: 12.83, lng: 79.70 },
  { name: "Cuddalore",      district: "Cuddalore",        lat: 11.75, lng: 79.77 },
  { name: "Nagapattinam",   district: "Nagapattinam",     lat: 10.76, lng: 79.84 },
  { name: "Ramanathapuram", district: "Ramanathapuram",   lat: 9.37,  lng: 78.83 },
];

export function NearbyMandis() {
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState("Tomato");
  const [prices, setPrices] = useState<Record<string, any[]>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("agri_loc_v3");
    if (saved) setUserLoc(JSON.parse(saved));
    else setTimeout(() => setShowPopup(true), 1200);
  }, []);

  useEffect(() => { fetchPrices(selectedVeg); }, [selectedVeg]);

  const requestLocation = () => {
    setShowPopup(false);
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setUserLoc(loc);
        localStorage.setItem("agri_loc_v3", JSON.stringify(loc));
        setLocLoading(false);
      },
      () => {
        // Default: Chennai
        const loc = { lat: 13.07, lng: 80.19 };
        setUserLoc(loc);
        setLocDenied(true);
        setLocLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const fetchPrices = async (vegName: string) => {
    setLoadingPrices(true);
    try {
      // Step 1: get commodity id
      const { data: comm, error: commErr } = await supabase
        .from("commodities").select("id").eq("name", vegName).single();

      if (commErr || !comm) {
        console.error("Commodity not found:", vegName, commErr);
        setLoadingPrices(false);
        return;
      }

      // Step 2: fetch all recent price data for this commodity (last 30 days)
      const fromDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const { data: rows, error: rowErr } = await supabase
        .from("price_data")
        .select("price, min_price, max_price, mandi_name, mandi_location, recorded_at, source")
        .eq("commodity_id", comm.id)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: false })
        .limit(500);

      if (rowErr) { console.error("Price fetch error:", rowErr); setLoadingPrices(false); return; }

      // Step 3: group by district — pick latest price per district
      const districtMap: Record<string, any[]> = {};
      for (const row of (rows || [])) {
        const dist = row.mandi_location || "";
        if (!districtMap[dist]) districtMap[dist] = [];
        districtMap[dist].push(row);
      }

      setPrices(districtMap);
    } catch(e) {
      console.error("fetchPrices error:", e);
    }
    setLoadingPrices(false);
  };

  // Get 5 nearest locations sorted by distance
  const nearest5 = userLoc
    ? [...TN_LOCATIONS]
        .map(loc => ({ ...loc, distance: getDistance(userLoc.lat, userLoc.lng, loc.lat, loc.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    : TN_LOCATIONS.slice(0, 5).map(l => ({ ...l, distance: 0 }));

  // Get best price for a district
  const getPriceForDistrict = (district: string) => {
    // Try exact district match first
    const rows = prices[district] || [];
    // Also try partial matches (DB might have slightly different names)
    const allRows = Object.entries(prices)
      .filter(([key]) => key.toLowerCase().includes(district.toLowerCase()) ||
                         district.toLowerCase().includes(key.toLowerCase()))
      .flatMap(([, v]) => v);
    const combined = [...rows, ...allRows];
    if (combined.length === 0) return null;
    // Return most recent
    return combined.sort((a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )[0];
  };

  const emoji = VEGETABLES.find(v => v.name === selectedVeg)?.emoji || "🥬";
  const totalPriceEntries = Object.values(prices).flat().length;

  return (
    <>
      {/* Location popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Find Nearby Mandis</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Allow location to see <strong>5 closest markets</strong> with real vegetable prices
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={requestLocation}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                <Navigation className="h-4 w-4" />
                Allow Location Access
              </button>
              <button onClick={() => { setShowPopup(false); requestLocation(); }}
                className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors">
                Skip — Use Tamil Nadu Default
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
              <Navigation className="h-4 w-4" />
              Nearby Markets
            </div>
            <h2 className="section-title">Markets Near You</h2>
            <p className="section-description">
              5 closest Tamil Nadu mandis with real vegetable prices
            </p>
          </div>

          {/* Location bar */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {locLoading
                ? <><Loader2 className="h-3 w-3 animate-spin"/><span>Detecting...</span></>
                : locDenied
                  ? <span className="text-muted-foreground">Showing Tamil Nadu · {totalPriceEntries} price records</span>
                  : userLoc
                    ? <span className="font-medium">Tamil Nadu · {totalPriceEntries} price records found</span>
                    : <span className="text-muted-foreground">Allow location for nearby mandis</span>
              }
            </div>
            {!userLoc && !locLoading && (
              <button onClick={requestLocation}
                className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-primary/90 transition-all">
                <Navigation className="h-3 w-3" />
                Detect My Location
              </button>
            )}
            <button onClick={() => fetchPrices(selectedVeg)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-3 py-2 rounded-full border border-border hover:border-primary/30 transition-all">
              <RefreshCw className={cn("h-3 w-3", loadingPrices && "animate-spin")} />
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

          {/* 5 mandi cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {nearest5.map((loc, idx) => {
              const priceRow = getPriceForDistrict(loc.district);
              const price = priceRow ? Number(priceRow.price) : null;
              const isNearest = idx === 0;
              const isLive = priceRow?.source === "agmarknet_gov_in";
              const isInterp = priceRow?.source === "interpolated";
              const timeAgo = priceRow?.recorded_at
                ? formatDistanceToNow(new Date(priceRow.recorded_at), { addSuffix: true })
                : null;

              return (
                <div key={loc.name}
                  className={cn(
                    "card-elevated p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                    isNearest && "border-primary/40 bg-primary/5 shadow-md"
                  )}>

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                      isNearest ? "bg-primary/20" : "bg-muted"
                    )}>
                      <MapPin className={cn("h-4 w-4", isNearest ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="text-right">
                      {isNearest && (
                        <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full block mb-1">
                          NEAREST
                        </span>
                      )}
                      {loc.distance > 0 && (
                        <span className="text-xs text-muted-foreground">~{loc.distance} km</span>
                      )}
                    </div>
                  </div>

                  {/* Name & district */}
                  <h3 className="font-bold text-foreground text-base mb-0.5">{loc.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{loc.district}, Tamil Nadu</p>

                  {/* Price */}
                  {loadingPrices ? (
                    <div className="space-y-2">
                      <div className="h-7 bg-muted rounded animate-pulse"/>
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-2/3"/>
                    </div>
                  ) : price !== null ? (
                    <div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-black text-foreground">
                          ₹{price % 1 === 0 ? price : price.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">/kg</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {emoji} {selectedVeg}
                        {priceRow?.min_price && priceRow?.max_price && (
                          <span className="ml-1 text-muted-foreground/60">
                            (₹{Number(priceRow.min_price).toFixed(0)}–₹{Number(priceRow.max_price).toFixed(0)})
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isLive ? (
                          <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                            ✅ Live
                          </span>
                        ) : isInterp ? (
                          <span className="text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">
                            📊 Estimated
                          </span>
                        ) : (
                          <span className="text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-2 py-0.5 rounded-full font-medium">
                            ⚡ Simulated
                          </span>
                        )}
                        {timeAgo && (
                          <span className="text-xs text-muted-foreground">{timeAgo}</span>
                        )}
                      </div>
                      {priceRow?.mandi_name && (
                        <p className="text-xs text-muted-foreground/50 mt-1 truncate" title={priceRow.mandi_name}>
                          📍 {priceRow.mandi_name.split("(")[0].trim()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-2">
                      <p className="text-sm text-muted-foreground italic">No data available</p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">
                        {selectedVeg} not reported here recently
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            📊 Data from data.gov.in Agmarknet · Tamil Nadu government vegetable markets
          </p>
        </div>
      </section>
    </>
  );
}
