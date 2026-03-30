import { useState, useEffect, useRef } from "react";
import { ArrowRight, TrendingUp, MapPin, Search, Loader2, X, ChevronDown } from "lucide-react";

const VEGETABLES = ["Tomato","Onion","Potato","Brinjal","Cabbage","Cauliflower","Carrot","Beans","Capsicum","Lady Finger","Bitter Gourd","Bottle Gourd","Drumstick","Pumpkin","Spinach"];
const TN_DISTRICTS = ["Chennai","Coimbatore","Madurai","Salem","Trichy","Erode","Vellore","Tirunelveli","Namakkal","Kanchipuram","Dindigul","Thanjavur","Cuddalore","Villupuram","Krishnagiri","Dharmapuri","Theni","Sivaganga","Pudukkottai","Perambalur"];

interface HeroSectionProps { onLocationChange?: (loc: string) => void; }

export function HeroSection({ onLocationChange }: HeroSectionProps) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle"|"loading"|"granted"|"denied">("idle");
  const [userLocation, setUserLocation] = useState("");
  const [showBanner, setShowBanner] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("agriprice_location");
    if (saved) { setUserLocation(saved); setLocationStatus("granted"); setShowBanner(false); onLocationChange?.(saved); }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`);
          const d = await r.json();
          const loc = (d.address?.county || d.address?.state_district || d.address?.city || "Tamil Nadu").replace(" District","").trim();
          setUserLocation(loc); localStorage.setItem("agriprice_location", loc);
          setLocationStatus("granted"); setShowBanner(false); onLocationChange?.(loc);
        } catch {
          setUserLocation("Tamil Nadu"); setLocationStatus("granted"); setShowBanner(false);
        }
      },
      () => { setLocationStatus("denied"); setShowBanner(false); }
    );
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const all = [...VEGETABLES, ...TN_DISTRICTS];
    setSuggestions(all.filter(v => v.toLowerCase().includes(val.toLowerCase())).slice(0, 8));
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{background:"#080c08"}}>
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 100% 70% at 50% -10%, rgba(34,197,94,0.12), transparent 70%)"}}/>
        <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(34,197,94,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,0.04) 1px,transparent 1px)",backgroundSize:"64px 64px"}}/>
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(34,197,94,0.06),transparent)"}}/>
        <div className="absolute bottom-1/3 right-1/4 w-60 h-60 rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(74,222,128,0.05),transparent)"}}/>
      </div>

      {/* Location Banner */}
      {showBanner && locationStatus !== "denied" && (
        <div className="absolute top-20 inset-x-4 z-20 flex justify-center">
          <div className="flex items-center gap-3 max-w-md w-full rounded-2xl px-4 py-3 backdrop-blur-xl shadow-2xl"
            style={{background:"rgba(10,30,10,0.9)",border:"1px solid rgba(34,197,94,0.25)"}}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:"rgba(34,197,94,0.15)"}}>
              <MapPin className="w-4 h-4 text-green-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">See prices near you</p>
              <p className="text-xs text-green-400/60 truncate">Allow location for your local mandi data</p>
            </div>
            <button onClick={requestLocation} disabled={locationStatus==="loading"}
              className="shrink-0 font-bold text-xs px-4 py-2 rounded-xl transition-all"
              style={{background:"#22c55e",color:"#000"}}>
              {locationStatus==="loading" ? <Loader2 className="w-3 h-3 animate-spin"/> : "Allow"}
            </button>
            <button onClick={()=>setShowBanner(false)} className="shrink-0 text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 text-center px-4 w-full max-w-4xl mx-auto">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-sm font-medium"
          style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.18)",color:"#4ade80"}}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          Live Agricultural Market Intelligence
        </div>

        {/* Heading */}
        <h1 className="font-black text-white leading-none tracking-tight mb-4" style={{fontSize:"clamp(2.5rem,8vw,5.5rem)"}}>
          Real Mandi Prices<br/>
          <span style={{background:"linear-gradient(135deg,#22c55e,#86efac,#4ade80)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
            For Tamil Nadu
          </span>
        </h1>

        <p className="text-white/40 mb-10 max-w-xl mx-auto leading-relaxed" style={{fontSize:"clamp(1rem,2.5vw,1.2rem)"}}>
          Government verified vegetable prices from 40+ Tamil Nadu mandis. AI-powered 10-day predictions. Free for farmers.
        </p>

        {/* Search */}
        <div ref={searchRef} className="relative max-w-lg mx-auto mb-8">
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4 transition-all"
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <Search className="w-5 h-5 shrink-0" style={{color:"rgba(255,255,255,0.25)"}}/>
            <input value={search} onChange={e=>handleSearch(e.target.value)}
              placeholder={userLocation ? `Prices in ${userLocation}...` : "Search vegetable or district..."}
              className="flex-1 bg-transparent text-white text-base outline-none"
              style={{caretColor:"#22c55e"}}
            />
            {userLocation ? (
              <div className="flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 cursor-pointer"
                style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)"}}
                onClick={()=>scrollTo("dashboard")}>
                <MapPin className="w-3 h-3 text-green-400"/>
                <span className="text-green-400 text-xs font-semibold">{userLocation}</span>
              </div>
            ) : (
              <button onClick={requestLocation} title="Use my location"
                className="shrink-0 rounded-xl p-2 transition-all hover:bg-green-500/10"
                style={{color:"rgba(255,255,255,0.3)"}}>
                <MapPin className="w-4 h-4"/>
              </button>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-50"
              style={{background:"#0f1f0f",border:"1px solid rgba(255,255,255,0.08)"}}>
              {suggestions.map(s => (
                <button key={s} onClick={()=>{setSearch(s);setSuggestions([]);scrollTo("dashboard");}}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 text-sm transition-all"
                  style={{color:"rgba(255,255,255,0.6)"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="rgba(34,197,94,0.08)")}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                  <span className="text-base">{VEGETABLES.includes(s)?"🥬":"📍"}</span>
                  <span>{s}</span>
                  <span className="ml-auto text-xs" style={{color:"rgba(255,255,255,0.2)"}}>
                    {VEGETABLES.includes(s)?"vegetable":"district"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <button onClick={()=>scrollTo("dashboard")}
            className="group flex items-center gap-2 font-bold px-8 py-4 rounded-2xl text-base transition-all active:scale-95"
            style={{background:"#22c55e",color:"#000",boxShadow:"0 0 0 rgba(34,197,94,0)"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="0 0 30px rgba(34,197,94,0.35)";(e.currentTarget as HTMLElement).style.background="#4ade80"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow="none";(e.currentTarget as HTMLElement).style.background="#22c55e"}}>
            View Live Prices
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
          </button>
          <button onClick={()=>scrollTo("predictions")}
            className="flex items-center gap-2 font-medium px-8 py-4 rounded-2xl text-base transition-all text-white"
            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <TrendingUp className="w-5 h-5 text-green-400"/>
            10-Day Forecast
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
          {[
            {v:"1,400+",l:"Daily Records"},
            {v:"40+",l:"TN Markets"},
            {v:"15",l:"Vegetables"},
          ].map(s=>(
            <div key={s.l} className="rounded-2xl p-4 text-center"
              style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <p className="text-xl sm:text-2xl font-black text-white">{s.v}</p>
              <p className="text-xs mt-0.5" style={{color:"rgba(255,255,255,0.35)"}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
        <ChevronDown className="w-5 h-5" style={{color:"rgba(34,197,94,0.4)"}}/>
      </div>
    </section>
  );
}
