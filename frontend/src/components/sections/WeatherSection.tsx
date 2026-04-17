import { useEffect, useState } from "react";
import { Cloud, Droplets, Wind, Sun, CloudRain, CloudDrizzle, Thermometer, MapPin, RefreshCw, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

// TN districts with coordinates + nearby districts mapping
const TN_DISTRICT_COORDS: Record<string, { lat: number; lng: number; nearby: string[] }> = {
  "Salem":          { lat: 11.65, lng: 78.16, nearby: ["Erode","Namakkal","Dharmapuri","Kallakurichi","Krishnagiri"] },
  "Coimbatore":     { lat: 11.01, lng: 76.96, nearby: ["Erode","Tiruppur","Nilgiris","Pollachi","Dindigul"] },
  "Madurai":        { lat: 9.92,  lng: 78.12, nearby: ["Dindigul","Virudhunagar","Sivaganga","Theni","Ramanathapuram"] },
  "Chennai":        { lat: 13.08, lng: 80.27, nearby: ["Kancheepuram","Tiruvallur","Chengalpattu","Villupuram","Vellore"] },
  "Trichy":         { lat: 10.79, lng: 78.70, nearby: ["Karur","Thanjavur","Perambalur","Ariyalur","Pudukkottai"] },
  "Erode":          { lat: 11.34, lng: 77.72, nearby: ["Salem","Coimbatore","Namakkal","Tiruppur","Karur"] },
  "Namakkal":       { lat: 11.22, lng: 78.17, nearby: ["Salem","Erode","Karur","Tiruchirappalli","Dharmapuri"] },
  "Dharmapuri":     { lat: 12.13, lng: 78.16, nearby: ["Salem","Krishnagiri","Tiruvannamalai","Villupuram","Vellore"] },
  "Vellore":        { lat: 12.92, lng: 79.13, nearby: ["Tiruvannamalai","Kancheepuram","Ranipet","Tirupattur","Krishnagiri"] },
  "Thanjavur":      { lat: 10.79, lng: 79.14, nearby: ["Trichy","Tiruvarur","Nagapattinam","Pudukkottai","Ariyalur"] },
  "Tirunelveli":    { lat: 8.72,  lng: 77.69, nearby: ["Thoothukudi","Kanyakumari","Virudhunagar","Tenkasi","Ramanathapuram"] },
  "Dindigul":       { lat: 10.36, lng: 77.98, nearby: ["Madurai","Theni","Karur","Coimbatore","Sivaganga"] },
  "Villupuram":     { lat: 11.94, lng: 79.49, nearby: ["Cuddalore","Kallakurichi","Tiruvannamalai","Vellore","Puducherry"] },
  "Krishnagiri":    { lat: 12.52, lng: 78.21, nearby: ["Dharmapuri","Salem","Vellore","Tiruvannamalai","Bangalore"] },
  "Cuddalore":      { lat: 11.75, lng: 79.77, nearby: ["Villupuram","Nagapattinam","Tiruvannamalai","Kallakurichi","Ariyalur"] },
};

// All districts with coords for lookup
const ALL_DISTRICTS: Record<string, { lat: number; lng: number }> = {
  "Salem":{ lat:11.65,lng:78.16 },"Coimbatore":{ lat:11.01,lng:76.96 },"Madurai":{ lat:9.92,lng:78.12 },
  "Chennai":{ lat:13.08,lng:80.27 },"Trichy":{ lat:10.79,lng:78.70 },"Erode":{ lat:11.34,lng:77.72 },
  "Namakkal":{ lat:11.22,lng:78.17 },"Dharmapuri":{ lat:12.13,lng:78.16 },"Vellore":{ lat:12.92,lng:79.13 },
  "Thanjavur":{ lat:10.79,lng:79.14 },"Tirunelveli":{ lat:8.72,lng:77.69 },"Dindigul":{ lat:10.36,lng:77.98 },
  "Villupuram":{ lat:11.94,lng:79.49 },"Krishnagiri":{ lat:12.52,lng:78.21 },"Cuddalore":{ lat:11.75,lng:79.77 },
  "Karur":{ lat:10.96,lng:78.08 },"Tiruppur":{ lat:11.10,lng:77.34 },"Theni":{ lat:10.01,lng:77.48 },
  "Virudhunagar":{ lat:9.58,lng:77.96 },"Sivaganga":{ lat:9.84,lng:78.48 },"Thoothukudi":{ lat:8.79,lng:78.13 },
  "Kanyakumari":{ lat:8.08,lng:77.55 },"Ramanathapuram":{ lat:9.37,lng:78.83 },"Pudukkottai":{ lat:10.37,lng:78.82 },
  "Ariyalur":{ lat:11.13,lng:79.08 },"Perambalur":{ lat:11.23,lng:78.88 },"Nagapattinam":{ lat:10.76,lng:79.84 },
  "Tiruvarur":{ lat:10.77,lng:79.64 },"Tiruvannamalai":{ lat:12.23,lng:79.07 },"Kancheepuram":{ lat:12.83,lng:79.70 },
  "Kallakurichi":{ lat:11.74,lng:78.96 },"Ranipet":{ lat:12.92,lng:79.33 },"Tirupattur":{ lat:12.49,lng:78.57 },
  "Tenkasi":{ lat:8.96,lng:77.32 },"Chengalpattu":{ lat:12.69,lng:79.97 },"Tiruvallur":{ lat:13.14,lng:79.91 },
  "Nilgiris":{ lat:11.40,lng:76.73 },"Pollachi":{ lat:10.66,lng:77.00 },"Puducherry":{ lat:11.93,lng:79.82 },
};

interface WeatherData {
  district: string;
  temp: number;
  tempMin: number;
  humidity: number;
  wind: number;
  rain: number;
  condition: string;
  impact: string;
  isMain?: boolean;
}

function getCondition(temp: number, rain: number, humidity: number): string {
  if (rain > 15) return "Heavy Rain";
  if (rain > 5) return "Light Rain";
  if (humidity > 80) return "Humid";
  if (temp > 36) return "Very Hot";
  if (temp > 32) return "Sunny & Hot";
  if (temp < 20) return "Cool";
  return "Pleasant";
}

function getImpact(rain: number, temp: number, humidity: number): string {
  if (rain > 15) return "⚠️ Heavy rain — expect price rise 10-20%";
  if (rain > 5)  return "🌧️ Light rain — slight price increase likely";
  if (temp > 36) return "🌡️ Heat wave — risk of spoilage, sell quickly";
  if (humidity > 80) return "💧 High humidity — storage risk for leafy veg";
  if (temp < 22) return "❄️ Cool weather — extended shelf life";
  return "✅ Ideal conditions — stable prices expected";
}

function WeatherIcon({ condition, size = 6 }: { condition: string; size?: number }) {
  const cls = `h-${size} w-${size}`;
  if (condition.includes("Rain")) return <CloudRain className={cls}/>;
  if (condition.includes("Humid")) return <CloudDrizzle className={cls}/>;
  if (condition.includes("Hot")) return <Sun className={cls}/>;
  if (condition.includes("Cloud")) return <Cloud className={cls}/>;
  return <Sun className={cls}/>;
}

function WeatherCard({ w, index }: { w: WeatherData; index: number }) {
  const isRainy = w.rain > 5;
  const isHot = w.temp > 34;

  return (
    <div className={cn(
      "card-elevated p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
      w.isMain && "border-primary/40 bg-primary/5 shadow-md",
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin className="h-3 w-3 text-primary"/>
            <h3 className={cn("font-bold text-base text-foreground", w.isMain && "text-primary")}>
              {w.district}
            </h3>
            {w.isMain && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">Your area</span>}
          </div>
          <p className="text-xs text-muted-foreground">{w.condition}</p>
        </div>
        <div className={cn(
          "p-2 rounded-xl",
          isRainy ? "bg-blue-500/10 text-blue-500" : isHot ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
        )}>
          <WeatherIcon condition={w.condition} size={5}/>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className={cn("text-3xl font-black", isHot ? "text-orange-500" : isRainy ? "text-blue-500" : "text-foreground")}>
          {w.temp}°
        </span>
        <span className="text-xs text-muted-foreground">C · min {w.tempMin}°</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex flex-col items-center gap-0.5">
          <Droplets className="h-3.5 w-3.5 text-blue-400"/>
          <span className="text-xs text-muted-foreground">{w.humidity}%</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Wind className="h-3.5 w-3.5 text-gray-400"/>
          <span className="text-xs text-muted-foreground">{w.wind} km/h</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <CloudRain className="h-3.5 w-3.5 text-blue-400"/>
          <span className="text-xs text-muted-foreground">{w.rain} mm</span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">{w.impact}</p>
      </div>
    </div>
  );
}

async function fetchWeather(district: string, coords: { lat: number; lng: number }): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=1`;
    const r = await fetch(url);
    const d = await r.json();
    const cur = d.current || {};
    const daily = d.daily || {};
    const temp = Math.round(cur.temperature_2m ?? daily.temperature_2m_max?.[0] ?? 30);
    const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? temp - 5);
    const humidity = Math.round(cur.relative_humidity_2m ?? daily.relative_humidity_2m_max?.[0] ?? 65);
    const wind = Math.round(cur.wind_speed_10m ?? daily.wind_speed_10m_max?.[0] ?? 10);
    const rain = Math.round((cur.precipitation ?? daily.precipitation_sum?.[0] ?? 0) * 10) / 10;
    const condition = getCondition(temp, rain, humidity);
    return { district, temp, tempMin, humidity, wind, rain, condition, impact: getImpact(rain, temp, humidity) };
  } catch {
    return null;
  }
}

export function WeatherSection() {
  const [mainDistrict, setMainDistrict] = useState("Salem");
  const [weatherList, setWeatherList] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("agri_loc_v4");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.district) setMainDistrict(parsed.district);
      } catch {}
    }
  }, []);

  useEffect(() => { loadWeather(mainDistrict); }, [mainDistrict]);

  const loadWeather = async (district: string) => {
    setLoading(true);
    const config = TN_DISTRICT_COORDS[district] || TN_DISTRICT_COORDS["Salem"];
    const nearby = config.nearby.slice(0, 4);
    const allDistricts = [district, ...nearby];

    // Sequential calls with delay to avoid Open-Meteo 429 rate limit
    const results: WeatherData[] = [];
    for (const d of allDistricts) {
      const coords = ALL_DISTRICTS[d] || config;
      const w = await fetchWeather(d, coords);
      if (w) results.push(w);
      await new Promise(r => setTimeout(r, 400));
    }

    if (results.length > 0) results[0].isMain = true;
    setWeatherList(results);
    setLastUpdated(new Date());
    setLoading(false);
  };

  const availableDistricts = Object.keys(TN_DISTRICT_COORDS);
  const rainyCount = weatherList.filter(w => w.rain > 5).length;
  const hotCount = weatherList.filter(w => w.temp > 34).length;

  return (
    <section id="weather" className="py-16">
      <div className="container px-4">

        {/* Header */}
        <div className="section-header">
          <div className="badge-primary mb-4">
            <Sun className="h-4 w-4"/>Weather Impact
          </div>
          <h2 className="section-title">Weather & Price Forecast</h2>
          <p className="section-description">
            Live weather for {mainDistrict} and nearby districts — how it affects vegetable prices
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <select
            value={mainDistrict}
            onChange={e => setMainDistrict(e.target.value)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-medium text-foreground outline-none focus:border-primary/50 cursor-pointer"
          >
            {availableDistricts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <button onClick={() => loadWeather(mainDistrict)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 px-4 py-2 rounded-xl transition-all">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")}/>
            Refresh
          </button>

          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Alert banner if rain */}
        {rainyCount > 0 && !loading && (
          <div className="max-w-2xl mx-auto mb-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CloudRain className="h-5 w-5 text-blue-500 shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Rain detected in {rainyCount} of {weatherList.length} nearby districts
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expect 10-20% price rise for tomatoes, leafy vegetables and drumstick
              </p>
            </div>
          </div>
        )}
        {hotCount > 2 && !loading && (
          <div className="max-w-2xl mx-auto mb-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Thermometer className="h-5 w-5 text-orange-500 shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-foreground">Heat wave across {hotCount} districts</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sell leafy vegetables quickly — spoilage risk is high</p>
            </div>
          </div>
        )}

        {/* Weather cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse"/>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {weatherList.map((w, i) => <WeatherCard key={w.district} w={w} index={i}/>)}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          🌤️ Live data from Open-Meteo API · Free &amp; no API key required
        </p>
      </div>
    </section>
  );
}
