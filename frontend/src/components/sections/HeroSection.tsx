import { useState, useEffect } from "react";
import { ArrowRight, TrendingUp, MapPin, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const VEGETABLES = [
  "Tomato","Onion","Potato","Brinjal","Cabbage","Cauliflower",
  "Carrot","Beans","Capsicum","Lady Finger","Bitter Gourd",
  "Bottle Gourd","Drumstick","Pumpkin","Spinach"
];

const TN_DISTRICTS = [
  "Chennai","Coimbatore","Madurai","Salem","Trichy","Erode",
  "Vellore","Tirunelveli","Namakkal","Kanchipuram","Dindigul",
  "Thanjavur","Cuddalore","Villupuram","Krishnagiri"
];

export function HeroSection() {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [locationState, setLocationState] = useState<"idle"|"loading"|"granted"|"denied">("idle");
  const [userLocation, setUserLocation] = useState<string>("");
  const [showLocationBanner, setShowLocationBanner] = useState(true);

  // Auto-request location on load
  useEffect(() => {
    const saved = localStorage.getItem("agriprice_location");
    if (saved) {
      setUserLocation(saved);
      setLocationState("granted");
      setShowLocationBanner(false);
    }
  }, []);

  const requestLocation = () => {
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode using nominatim
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await r.json();
          const district = data.address?.county || data.address?.state_district || data.address?.city || "Tamil Nadu";
          const loc = district.replace(" District","").trim();
          setUserLocation(loc);
          localStorage.setItem("agriprice_location", loc);
          setLocationState("granted");
          setShowLocationBanner(false);
        } catch {
          setUserLocation("Tamil Nadu");
          setLocationState("granted");
          setShowLocationBanner(false);
        }
      },
      () => {
        setLocationState("denied");
      }
    );
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length < 1) { setSuggestions([]); return; }
    const all = [...VEGETABLES, ...TN_DISTRICTS];
    setSuggestions(all.filter(v => v.toLowerCase().startsWith(val.toLowerCase())).slice(0, 6));
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0f0a]">

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(34,197,94,0.15), transparent)",
        }}/>
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}/>
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{background:"radial-gradient(circle, #22c55e, transparent)"}}/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{background:"radial-gradient(circle, #16a34a, transparent)"}}/>
      </div>

      {/* Location permission banner */}
      {showLocationBanner && locationState !== "denied" && (
        <div className="absolute top-20 left-0 right-0 z-20 flex justify-center px-4">
          <div className="flex items-center gap-3 bg-green-950/90 border border-green-500/30 rounded-2xl px-5 py-3 backdrop-blur-xl shadow-2xl max-w-lg w-full">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-100">Get prices near you</p>
              <p className="text-xs text-green-400/70">Allow location for your local mandi prices</p>
            </div>
            <button
              onClick={requestLocation}
              disabled={locationState === "loading"}
              className="shrink-0 bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-4 py-1.5 rounded-xl transition-all"
            >
              {locationState === "loading" ? <Loader2 className="w-3 h-3 animate-spin"/> : "Allow"}
            </button>
            <button onClick={() => setShowLocationBanner(false)} className="text-green-500/50 hover:text-green-400">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          <span className="text-green-400 text-sm font-medium tracking-wide">Live Market Intelligence</span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white mb-6 leading-none tracking-tight">
          Know Your
          <br/>
          <span className="text-transparent bg-clip-text"
            style={{backgroundImage:"linear-gradient(135deg, #22c55e, #86efac, #4ade80)"}}>
            Crop Price
          </span>
          <br/>
          <span className="text-white/40 text-3xl sm:text-4xl font-normal">before you sell</span>
        </h1>

        <p className="text-white/50 text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
          Real-time vegetable prices from Tamil Nadu mandis.
          AI-powered 10-day predictions. Always free for farmers.
        </p>

        {/* Search bar */}
        <div className="relative max-w-xl mx-auto mb-10">
          <div className="flex items-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] rounded-2xl px-5 py-4 gap-3 focus-within:border-green-500/50 focus-within:bg-[rgba(255,255,255,0.08)] transition-all">
            <Search className="w-5 h-5 text-white/30 shrink-0"/>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search vegetable or district..."
              className="flex-1 bg-transparent text-white placeholder-white/30 text-base outline-none"
            />
            {userLocation && (
              <div className="flex items-center gap-1 shrink-0 bg-green-500/15 border border-green-500/20 rounded-lg px-2 py-1">
                <MapPin className="w-3 h-3 text-green-400"/>
                <span className="text-green-400 text-xs font-medium">{userLocation}</span>
              </div>
            )}
            {!userLocation && (
              <button onClick={requestLocation} className="shrink-0 text-white/30 hover:text-green-400 transition-colors">
                <MapPin className="w-5 h-5"/>
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-[rgba(255,255,255,0.10)] rounded-2xl overflow-hidden shadow-2xl z-50">
              {suggestions.map(s => (
                <button key={s}
                  onClick={() => {
                    setSearch(s);
                    setSuggestions([]);
                    scrollTo(VEGETABLES.includes(s) ? "dashboard" : "nearby-mandis");
                  }}
                  className="w-full text-left px-5 py-3 text-white/70 hover:bg-green-500/10 hover:text-green-400 transition-colors flex items-center gap-3 text-sm"
                >
                  <span>{VEGETABLES.includes(s) ? "🥬" : "📍"}</span>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => scrollTo("dashboard")}
            className="group flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(34,197,94,0.4)] active:scale-95"
          >
            View Live Prices
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
          </button>
          <button
            onClick={() => scrollTo("predictions")}
            className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.10)] text-white font-medium px-8 py-4 rounded-2xl text-base transition-all"
          >
            <TrendingUp className="w-5 h-5 text-green-400"/>
            10-Day Forecast
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { value: "1,400+", label: "Daily Records" },
            { value: "40+", label: "TN Markets" },
            { value: "15", label: "Vegetables" },
          ].map(stat => (
            <div key={stat.label} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
              <p className="text-2xl sm:text-3xl font-black text-white mb-1">{stat.value}</p>
              <p className="text-white/40 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <div className="w-px h-12 bg-gradient-to-b from-transparent to-green-500/40"/>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500/40"/>
      </div>
    </section>
  );
}
