import { useState, useEffect } from "react";
import { MapPin, Loader2, Navigation, X, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommodities, usePriceData } from "@/hooks/useCommodities";
import { formatDistanceToNow } from "date-fns";

// Indian state lookup by lat/lng (approximate bounding boxes)
function getStateFromCoords(lat: number, lng: number): string {
  if (lat >= 8 && lat <= 13.5 && lng >= 76.5 && lng <= 80.5) return "Tamil Nadu";
  if (lat >= 8 && lat <= 12.5 && lng >= 74.5 && lng <= 77.5) return "Kerala";
  if (lat >= 14 && lat <= 19.5 && lng >= 74 && lng <= 78.5) return "Karnataka";
  if (lat >= 14 && lat <= 20 && lng >= 76.5 && lng <= 84) return "Andhra Pradesh";
  if (lat >= 17 && lat <= 22.5 && lng >= 77.5 && lng <= 84.5) return "Telangana";
  if (lat >= 18 && lat <= 22.5 && lng >= 72.5 && lng <= 80.5) return "Maharashtra";
  if (lat >= 22 && lat <= 27.5 && lng >= 68.5 && lng <= 74.5) return "Gujarat";
  if (lat >= 24 && lat <= 30.5 && lng >= 73 && lng <= 78.5) return "Rajasthan";
  if (lat >= 23.5 && lat <= 30.5 && lng >= 75 && lng <= 84.5) return "Madhya Pradesh";
  if (lat >= 23.5 && lat <= 27.5 && lng >= 83 && lng <= 88.5) return "Chhattisgarh";
  if (lat >= 24 && lat <= 31 && lng >= 77 && lng <= 84.5) return "Uttar Pradesh";
  if (lat >= 27 && lat <= 31 && lng >= 74 && lng <= 78.5) return "Haryana";
  if (lat >= 29 && lat <= 32 && lng >= 73.5 && lng <= 77.5) return "Punjab";
  if (lat >= 28 && lat <= 32 && lng >= 76.5 && lng <= 81) return "Uttarakhand";
  if (lat >= 21.5 && lat <= 25 && lng >= 85 && lng <= 90) return "West Bengal";
  if (lat >= 20 && lat <= 24 && lng >= 84 && lng <= 87.5) return "Odisha";
  return "Tamil Nadu"; // default
}

// Known mandis per state with lat/lng
const MANDIS_BY_STATE: Record<string, Array<{ name: string; lat: number; lng: number; city: string }>> = {
  "Tamil Nadu": [
    { name: "Koyambedu", lat: 13.07, lng: 80.19, city: "Chennai" },
    { name: "Madurai Market", lat: 9.92, lng: 78.12, city: "Madurai" },
    { name: "Coimbatore Market", lat: 11.01, lng: 76.96, city: "Coimbatore" },
    { name: "Salem Market", lat: 11.65, lng: 78.16, city: "Salem" },
    { name: "Trichy Market", lat: 10.79, lng: 78.70, city: "Tiruchirappalli" },
    { name: "Tirunelveli Market", lat: 8.72, lng: 77.69, city: "Tirunelveli" },
    { name: "Erode Market", lat: 11.34, lng: 77.72, city: "Erode" },
  ],
  "Karnataka": [
    { name: "APMC Bangalore", lat: 12.97, lng: 77.59, city: "Bangalore" },
    { name: "Mysore Market", lat: 12.29, lng: 76.64, city: "Mysore" },
    { name: "Hubli Market", lat: 15.35, lng: 75.13, city: "Hubli" },
    { name: "Mangalore Market", lat: 12.87, lng: 74.88, city: "Mangalore" },
    { name: "Belgaum Market", lat: 15.85, lng: 74.50, city: "Belgaum" },
  ],
  "Maharashtra": [
    { name: "Pune APMC", lat: 18.52, lng: 73.86, city: "Pune" },
    { name: "Nashik Market", lat: 20.00, lng: 73.79, city: "Nashik" },
    { name: "Nagpur Market", lat: 21.15, lng: 79.08, city: "Nagpur" },
    { name: "Aurangabad Market", lat: 19.88, lng: 75.34, city: "Aurangabad" },
    { name: "Mumbai APMC", lat: 19.08, lng: 72.88, city: "Mumbai" },
  ],
  "Andhra Pradesh": [
    { name: "Rythu Bazaar Vijayawada", lat: 16.51, lng: 80.63, city: "Vijayawada" },
    { name: "Visakhapatnam Market", lat: 17.69, lng: 83.21, city: "Visakhapatnam" },
    { name: "Guntur Market", lat: 16.30, lng: 80.43, city: "Guntur" },
    { name: "Tirupati Market", lat: 13.63, lng: 79.42, city: "Tirupati" },
    { name: "Kurnool Market", lat: 15.83, lng: 78.04, city: "Kurnool" },
  ],
  "Telangana": [
    { name: "Bowenpally Market", lat: 17.47, lng: 78.49, city: "Hyderabad" },
    { name: "Gaddiannaram Market", lat: 17.34, lng: 78.54, city: "Hyderabad" },
    { name: "Warangal Market", lat: 17.97, lng: 79.60, city: "Warangal" },
    { name: "Karimnagar Market", lat: 18.44, lng: 79.13, city: "Karimnagar" },
    { name: "Nizamabad Market", lat: 18.67, lng: 78.09, city: "Nizamabad" },
  ],
  "Kerala": [
    { name: "Chalai Market", lat: 8.49, lng: 76.94, city: "Thiruvananthapuram" },
    { name: "Ernakulam Market", lat: 9.98, lng: 76.30, city: "Kochi" },
    { name: "Kozhikode Market", lat: 11.25, lng: 75.78, city: "Kozhikode" },
    { name: "Thrissur Market", lat: 10.52, lng: 76.21, city: "Thrissur" },
    { name: "Kollam Market", lat: 8.89, lng: 76.61, city: "Kollam" },
  ],
};

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface UserLocation { lat: number; lng: number; state: string; city?: string }

// ── Location Permission Popup ─────────────────────────────────
function LocationPopup({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center text-foreground mb-2">Find Nearby Mandis</h2>
        <p className="text-muted-foreground text-center text-sm mb-6">
          Allow location access to see the <strong>5 closest mandis</strong> to you with real-time vegetable prices
        </p>
        <div className="space-y-3">
          <button
            onClick={onAllow}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold hover:bg-primary/90 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Allow Location Access
          </button>
          <button
            onClick={onDeny}
            className="w-full py-3 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export function NearbyMandis() {
  const [showPopup, setShowPopup] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState<string>("");
  const { data: commodities } = useCommodities();
  const { data: priceData } = usePriceData(selectedCommodity);

  // Show popup on first visit
  useEffect(() => {
    const saved = localStorage.getItem("agri_location");
    if (saved) {
      setUserLocation(JSON.parse(saved));
    } else {
      setTimeout(() => setShowPopup(true), 1500);
    }
    // Set default commodity
    if (commodities && commodities.length > 0 && !selectedCommodity) {
      setSelectedCommodity(commodities[0].id);
    }
  }, [commodities]);

  const requestLocation = () => {
    setShowPopup(false);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const state = getStateFromCoords(latitude, longitude);
        const loc = { lat: latitude, lng: longitude, state };
        setUserLocation(loc);
        localStorage.setItem("agri_location", JSON.stringify(loc));
        setLoading(false);
      },
      (err) => {
        setLocationError("Location denied. Showing Tamil Nadu mandis by default.");
        setUserLocation({ lat: 13.07, lng: 80.19, state: "Tamil Nadu", city: "Chennai" });
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // Get nearest 5 mandis
  const nearbyMandis = (() => {
    if (!userLocation) return [];
    const stateMandis = MANDIS_BY_STATE[userLocation.state] ?? MANDIS_BY_STATE["Tamil Nadu"];
    return stateMandis
      .map((m) => ({ ...m, distance: Math.round(getDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  })();

  // Get price for a mandi from Supabase data
  const getPriceForMandi = (mandiName: string) => {
    if (!priceData) return null;
    const match = priceData
      .filter((p) => p.mandi_name.toLowerCase().includes(mandiName.toLowerCase().split(" ")[0]))
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
    return match ?? null;
  };

  const selectedCommodityData = commodities?.find((c) => c.id === selectedCommodity);

  return (
    <>
      {showPopup && <LocationPopup onAllow={requestLocation} onDeny={() => setShowPopup(false)} />}

      <section id="nearby-mandis" className="py-16 bg-muted/20">
        <div className="container px-4">
          <div className="section-header">
            <div className="badge-primary mb-4">
              <Navigation className="h-4 w-4" />
              Nearby Mandis
            </div>
            <h2 className="section-title">Markets Near You</h2>
            <p className="section-description">
              5 closest agricultural markets to your location with live prices
            </p>
          </div>

          {/* Location bar */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-card border border-border text-sm">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Detecting location...</span></>
              ) : userLocation ? (
                <>
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-medium">{userLocation.state}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{nearbyMandis.length} mandis found</span>
                  <button onClick={() => setShowPopup(true)} className="text-primary hover:underline text-xs ml-1">
                    Change
                  </button>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">Location not set</span>
                  <button onClick={() => setShowPopup(true)} className="text-primary hover:underline text-xs">
                    Enable
                  </button>
                </>
              )}
            </div>
          </div>

          {locationError && (
            <p className="text-center text-xs text-amber-600 mb-4">{locationError}</p>
          )}

          {/* Commodity selector */}
          {userLocation && nearbyMandis.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-center mb-6">
                <div className="flex flex-wrap gap-2 justify-center">
                  {commodities?.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCommodity(c.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                        selectedCommodity === c.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandi Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {nearbyMandis.map((mandi, idx) => {
                  const priceRow = getPriceForMandi(mandi.name);
                  const price = priceRow?.price;
                  return (
                    <div
                      key={mandi.name}
                      className={cn(
                        "relative bg-card border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                        idx === 0 ? "border-primary/40 bg-primary/5" : "border-border"
                      )}
                    >
                      {idx === 0 && (
                        <span className="absolute -top-2.5 left-4 text-[10px] px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-bold">
                          NEAREST
                        </span>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          ~{mandi.distance} km
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground text-sm mb-0.5">{mandi.name}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{mandi.city}, {userLocation.state}</p>
                      {price != null ? (
                        <div>
                          <div className="text-2xl font-bold text-foreground">
                            ₹{price.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            per {selectedCommodityData?.unit ?? "kg"} • {selectedCommodityData?.name}
                          </div>
                          {priceRow?.recorded_at && (
                            <div className="text-[10px] text-muted-foreground/70 mt-1">
                              {formatDistanceToNow(new Date(priceRow.recorded_at), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">No price data</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No location state */}
          {!userLocation && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Navigation className="h-10 w-10 text-primary/50" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">Enable Location</p>
              <p className="text-muted-foreground mb-6 text-sm">Allow location access to see mandis near you</p>
              <button
                onClick={() => setShowPopup(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                <Navigation className="h-4 w-4" />
                Find Nearby Mandis
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
