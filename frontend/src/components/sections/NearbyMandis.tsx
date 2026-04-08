import { useState, useEffect } from "react";
import { MapPin, Loader2, Navigation, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

// Vegetable list with emojis
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

// All real TN mandis from DB with coordinates
const TN_MANDIS = [
  {name:"Koyambedu", keywords:["Koyambedu","Koyamb"], lat:13.07, lng:80.19, city:"Chennai"},
  {name:"Madurai", keywords:["Madurai","Anna nagar","Melur"], lat:9.92, lng:78.12, city:"Madurai"},
  {name:"Coimbatore", keywords:["Coimbatore","Udumalpet","Mettupalayam","Kurichi"], lat:11.01, lng:76.96, city:"Coimbatore"},
  {name:"Salem", keywords:["Salem","Mecheri","Tiruchengode","Thathakapatti","Attayampatti","Elampillai"], lat:11.65, lng:78.16, city:"Salem"},
  {name:"Trichy", keywords:["Trichy","Tiruchirappalli","Kulithalai","Vengamedu"], lat:10.79, lng:78.70, city:"Trichy"},
  {name:"Erode", keywords:["Erode","Perundurai","Thalavadi","Sathiyamagalam"], lat:11.34, lng:77.72, city:"Erode"},
  {name:"Tirunelveli", keywords:["Tirunelveli","Melapalayam","NGO Colony"], lat:8.72, lng:77.69, city:"Tirunelveli"},
  {name:"Namakkal", keywords:["Namakkal","Tiruchengode"], lat:11.22, lng:78.17, city:"Namakkal"},
  {name:"Vellore", keywords:["Vellore","Pallikonda","Vadalur"], lat:12.92, lng:79.13, city:"Vellore"},
  {name:"Dindigul", keywords:["Dindigul","Vedasanthur"], lat:10.36, lng:77.98, city:"Dindigul"},
  {name:"Thanjavur", keywords:["Thanjavur","Mayiladuthurai","Sirkali"], lat:10.79, lng:79.14, city:"Thanjavur"},
  {name:"Tuticorin", keywords:["Tuticorin","Kovilpatti"], lat:8.79, lng:78.13, city:"Tuticorin"},
  {name:"Villupuram", keywords:["Villupuram","Tindivanam","Ulundurpettai"], lat:11.94, lng:79.49, city:"Villupuram"},
  {name:"Theni", keywords:["Theni","Bodinayakanur","Chinnamanur"], lat:10.01, lng:77.48, city:"Theni"},
  {name:"Krishnagiri", keywords:["Krishnagiri","Dharmapuri","AJattihalli"], lat:12.52, lng:78.21, city:"Krishnagiri"},
];

export function NearbyMandis() {
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number;state:string}|null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState("Tomato");
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Load saved location
  useEffect(() => {
    const saved = localStorage.getItem("agri_location_v2");
    if (saved) {
      setUserLoc(JSON.parse(saved));
    } else {
      setTimeout(() => setShowPopup(true), 1000);
    }
  }, []);

  // Fetch prices from DB when vegetable changes
  useEffect(() => {
    fetchPricesFromDB(selectedVeg);
  }, [selectedVeg]);

  const fetchPricesFromDB = async (vegName: string) => {
    setLoadingPrices(true);
    try {
      // Get commodity ID
      const { data: comm } = await supabase
        .from("commodities").select("id").eq("name", vegName).single();
      if (!comm) { setLoadingPrices(false); return; }

      // Get today's prices from all TN mandis
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
      const twoDaysAgo = new Date(Date.now()-172800000).toISOString().split("T")[0];

      const { data: priceRows } = await supabase
        .from("price_data")
        .select("price, min_price, max_price, mandi_name, mandi_location, recorded_at, source")
        .eq("commodity_id", comm.id)
        .in("source", ["agmarknet_gov_in", "interpolated"])
        .gte("recorded_at", twoDaysAgo)
        .order("recorded_at", { ascending: false });

      // Map prices to our mandis by keyword matching
      const priceMap: Record<string, any> = {};
      for (const mandi of TN_MANDIS) {
        const match = (priceRows || []).find(p =>
          mandi.keywords.some(kw =>
            p.mandi_name?.toLowerCase().includes(kw.toLowerCase())
          )
        );
        if (match) {
          priceMap[mandi.name] = match;
        }
      }
      setPrices(priceMap);
    } catch(e) {
      console.error(e);
    }
    setLoadingPrices(false);
  };

  const requestLocation = () => {
    setShowPopup(false);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        const loc = { lat: latitude, lng: longitude, state: getStateFromCoords(latitude, longitude) };
        setUserLoc(loc);
        localStorage.setItem("agri_location_v2", JSON.stringify(loc));
        setLoading(false);
      },
      () => {
        // Default to Chennai
        const loc = { lat: 13.07, lng: 80.19, state: "Tamil Nadu" };
        setUserLoc(loc);
        setLocationDenied(true);
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // Get 5 nearest mandis
  const nearbyMandis = userLoc
    ? TN_MANDIS
        .map(m => ({ ...m, distance: getDistance(userLoc.lat, userLoc.lng, m.lat, m.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    : TN_MANDIS.slice(0, 5);

  const emoji = VEGETABLES.find(v => v.name === selectedVeg)?.emoji || "🥬";

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
              Allow location to see <strong>5 closest mandis</strong> with real vegetable prices
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={requestLocation}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                <Navigation className="h-4 w-4" />
                Allow Location Access
              </button>
              <button onClick={() => { setShowPopup(false); requestLocation(); }}
                className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors">
                Use Default (Tamil Nadu)
              </button>
            </div>
          </div>
        </div>
      )}

      <section id="nearby-mandis" className="py-16 bg-muted/20">
        <div className="container px-4">
          <div className="section-header">
            <div className="badge-primary mb-4">
              <Navigation className="h-4 w-4" />
              Nearby Markets
            </div>
            <h2 className="section-title">Markets Near You</h2>
            <p className="section-description">
              5 closest mandis with today's real prices
            </p>
          </div>

          {/* Location info bar */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {loading ? (
                <><Loader2 className="h-3 w-3 animate-spin"/><span>Detecting location...</span></>
              ) : locationDenied ? (
                <span className="text-muted-foreground">Showing Tamil Nadu mandis</span>
              ) : userLoc ? (
                <span className="font-medium">Tamil Nadu · 5 mandis found</span>
              ) : (
                <span className="text-muted-foreground">Location not set</span>
              )}
            </div>
            {!userLoc && !loading && (
              <button onClick={requestLocation}
                className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-primary/90 transition-all">
                <Navigation className="h-3 w-3" />
                Detect My Location
              </button>
            )}
            <button onClick={() => fetchPricesFromDB(selectedVeg)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-3 py-2 rounded-full border border-border hover:border-primary/30 transition-all">
              <RefreshCw className={cn("h-3 w-3", loadingPrices && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Vegetable selector */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {VEGETABLES.map(v => (
              <button key={v.name}
                onClick={() => setSelectedVeg(v.name)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  selectedVeg === v.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}>
                <span>{v.emoji}</span>
                {v.name}
              </button>
            ))}
          </div>

          {/* Mandis grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {nearbyMandis.map((mandi, idx) => {
              const priceRow = prices[mandi.name];
              const price = priceRow?.price ? Number(priceRow.price) : null;
              const isNearest = idx === 0;
              const isReal = priceRow?.source === "agmarknet_gov_in";
              const timeAgo = priceRow?.recorded_at
                ? formatDistanceToNow(new Date(priceRow.recorded_at), { addSuffix: true })
                : null;

              return (
                <div key={mandi.name}
                  className={cn(
                    "card-elevated p-5 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg",
                    isNearest && "border-primary/40 bg-primary/5"
                  )}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        isNearest ? "bg-primary/20" : "bg-muted"
                      )}>
                        <MapPin className={cn("h-4 w-4", isNearest ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      {isNearest && (
                        <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          NEAREST
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {mandi.distance ? `~${mandi.distance} km` : ""}
                    </span>
                  </div>

                  {/* Mandi name */}
                  <h3 className="font-bold text-foreground mb-0.5">{mandi.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{mandi.city}, Tamil Nadu</p>

                  {/* Price */}
                  {loadingPrices ? (
                    <div className="h-8 bg-muted rounded animate-pulse"/>
                  ) : price !== null ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground">₹{price.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">per kg · {emoji} {selectedVeg}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {isReal ? (
                          <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                            ✅ Live
                          </span>
                        ) : (
                          <span className="text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">
                            Estimated
                          </span>
                        )}
                        {timeAgo && <span className="text-xs text-muted-foreground">{timeAgo}</span>}
                      </div>
                      {priceRow?.min_price && priceRow?.max_price && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Range: ₹{Number(priceRow.min_price).toFixed(0)} – ₹{Number(priceRow.max_price).toFixed(0)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground italic">No data today</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Not reported at this mandi</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            📊 Prices from data.gov.in Agmarknet · Tamil Nadu government vegetable markets
          </p>
        </div>
      </section>
    </>
  );
}
