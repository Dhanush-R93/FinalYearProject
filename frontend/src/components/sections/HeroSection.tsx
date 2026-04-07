import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, BarChart3, Shield, MapPin, Search, Loader2, X, Sparkles, ChevronDown } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";
import { cn } from "@/lib/utils";

const VEGETABLES = ["Tomato","Onion","Potato","Brinjal","Cabbage","Cauliflower","Carrot","Beans","Capsicum","Lady Finger","Bitter Gourd","Bottle Gourd","Drumstick","Pumpkin","Spinach"];
const TN_DISTRICTS = ["Chennai","Coimbatore","Madurai","Salem","Trichy","Erode","Vellore","Tirunelveli","Namakkal","Kanchipuram","Dindigul","Thanjavur","Cuddalore","Villupuram","Krishnagiri","Dharmapuri","Theni","Sivaganga","Pudukkottai","Perambalur"];

interface Props { onLocationChange?: (loc: string) => void; }

function CountUpStat({ value, suffix = "", label, icon: Icon, colorClass }: {
  value: string; suffix?: string; label: string; icon: any; colorClass: string;
}) {
  return (
    <div className="stat-card group hover:border-primary/30 hover:-translate-y-2 transition-all duration-500 hover:shadow-lg">
      <div className="flex items-center justify-center gap-3">
        <div className={`p-2.5 rounded-xl ${colorClass} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}{suffix}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function HeroSection({ onLocationChange }: Props) {
  const scrollY = useParallax();
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
          const loc = (d.address?.county || d.address?.state_district || d.address?.city || "Tamil Nadu")
            .replace(" District","").trim();
          setUserLocation(loc);
          localStorage.setItem("agriprice_location", loc);
          setLocationStatus("granted");
          setShowBanner(false);
          onLocationChange?.(loc);
        } catch {
          setUserLocation("Tamil Nadu");
          setLocationStatus("granted");
          setShowBanner(false);
          onLocationChange?.("Tamil Nadu");
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
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16 bg-gradient-to-b from-primary/5 via-background to-background">

      {/* Parallax background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.12),transparent_50%)]"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.1),transparent_50%)]"
          style={{ transform: `translateY(${scrollY * 0.25}px)` }} />
        <div className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl top-[10%] left-[5%]"
          style={{ transform: `translate(${scrollY * 0.05}px, ${scrollY * 0.2}px)` }} />
        <div className="absolute w-72 h-72 rounded-full bg-accent/8 blur-3xl top-[30%] right-[10%]"
          style={{ transform: `translate(${scrollY * -0.08}px, ${scrollY * 0.15}px)` }} />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_40%,black,transparent)]"
        style={{ transform: `translateY(${scrollY * 0.05}px)` }} />

      {/* Location permission banner */}
      {showBanner && locationStatus !== "denied" && (
        <div className="absolute top-20 inset-x-4 z-20 flex justify-center">
          <div className="card-elevated flex items-center gap-3 max-w-md w-full px-4 py-3 shadow-lg animate-fade-in">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">See prices near you</p>
              <p className="text-xs text-muted-foreground">Allow location for your local mandi prices</p>
            </div>
            <Button size="sm" onClick={requestLocation} disabled={locationStatus === "loading"}
              className="shrink-0 h-8 text-xs">
              {locationStatus === "loading" ? <Loader2 className="h-3 w-3 animate-spin"/> : "Allow"}
            </Button>
            <button onClick={() => setShowBanner(false)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4"/>
            </button>
          </div>
        </div>
      )}

      <div className="container relative z-10 px-4 py-16"
        style={{ transform: `translateY(${scrollY * -0.1}px)`, opacity: Math.max(0, 1 - scrollY * 0.001) }}>
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <div className="badge-primary mb-8 animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Agricultural Analytics</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[1.1] mb-6 animate-slide-up tracking-tight">
            Smart Price{" "}
            <span className="text-gradient-primary relative">
              Predictions
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M0 7 Q50 0 100 4 Q150 8 200 1" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </span>
            <br />
            for <span className="text-gradient-secondary">Indian Farmers</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-slide-up leading-relaxed"
            style={{ animationDelay: "0.1s" }}>
            Real-time mandi prices from Tamil Nadu. AI-powered 10-day forecasts. Free for farmers.
          </p>

          {/* Search bar */}
          <div ref={searchRef} className="relative max-w-xl mx-auto mb-8 animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <div className={cn(
              "flex items-center gap-3 card-elevated px-5 py-3.5 transition-all duration-300",
              "focus-within:border-primary/50 focus-within:shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
            )}>
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder={userLocation ? `Search in ${userLocation}...` : "Search vegetable or district..."}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none"
              />
              {userLocation ? (
                <button onClick={() => scrollTo("dashboard")}
                  className="flex items-center gap-1.5 shrink-0 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg px-3 py-1.5 transition-all">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="text-primary text-xs font-semibold">{userLocation}</span>
                </button>
              ) : (
                <button onClick={requestLocation}
                  className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1">
                  <MapPin className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 card-elevated shadow-xl z-50 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s}
                    onClick={() => { setSearch(s); setSuggestions([]); scrollTo("dashboard"); }}
                    className="w-full text-left px-5 py-3 flex items-center gap-3 text-sm text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-all">
                    <span className="text-base">{VEGETABLES.includes(s) ? "🥬" : "📍"}</span>
                    <span>{s}</span>
                    <span className="ml-auto text-xs text-muted-foreground/50">
                      {VEGETABLES.includes(s) ? "vegetable" : "district"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location denied notice */}
          {locationStatus === "denied" && (
            <p className="text-sm text-muted-foreground mb-6 animate-fade-in">
              📍 Showing Tamil Nadu prices.{" "}
              <button onClick={requestLocation} className="text-primary hover:underline">Try again</button>
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up"
            style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="btn-primary group px-10 py-6 text-base rounded-xl shadow-lg hover:shadow-xl"
              onClick={() => scrollTo("dashboard")}>
              <span className="flex items-center">
                View Live Prices
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            <Button variant="outline" size="lg" className="btn-outline px-10 py-6 text-base rounded-xl group" asChild>
              <a href="#predictions">
                See Predictions
                <TrendingUp className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto animate-slide-up"
            style={{ animationDelay: "0.3s" }}>
            <CountUpStat value="1,400+" label="Daily Records" icon={BarChart3} colorClass="bg-primary/10 text-primary" />
            <CountUpStat value="40+" label="TN Mandis Covered" icon={Shield} colorClass="bg-secondary/10 text-secondary" />
            <CountUpStat value="Real-time" label="Market Updates" icon={TrendingUp} colorClass="bg-accent/20 text-accent-foreground" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button onClick={() => scrollTo("dashboard")}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors animate-bounce-gentle"
        style={{ opacity: Math.max(0, 1 - scrollY * 0.005) }}>
        <span className="text-xs font-medium">Scroll Down</span>
        <ChevronDown className="h-5 w-5" />
      </button>
    </section>
  );
}
