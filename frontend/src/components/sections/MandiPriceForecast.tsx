import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, MapPin, Calendar, ChevronLeft, ChevronRight, CloudRain, Sun, Thermometer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

const VEGETABLES = [
  {name:"Tomato",emoji:"🍅"},{name:"Onion",emoji:"🧅"},{name:"Potato",emoji:"🥔"},
  {name:"Brinjal",emoji:"🍆"},{name:"Cabbage",emoji:"🥬"},{name:"Cauliflower",emoji:"🥦"},
  {name:"Carrot",emoji:"🥕"},{name:"Beans",emoji:"🫘"},{name:"Capsicum",emoji:"🫑"},
  {name:"Lady Finger",emoji:"🌿"},{name:"Bitter Gourd",emoji:"🥒"},
  {name:"Drumstick",emoji:"🌿"},{name:"Pumpkin",emoji:"🎃"},
];

// Districts with their nearby group
const DISTRICT_GROUPS: Record<string, string[]> = {
  "Salem":       ["Salem","Erode","Namakkal","Dharmapuri","Krishnagiri"],
  "Coimbatore":  ["Coimbatore","Erode","Tiruppur","Namakkal","Dindigul"],
  "Madurai":     ["Madurai","Dindigul","Virudhunagar","Sivaganga","Theni"],
  "Chennai":     ["Chennai","Kancheepuram","Villupuram","Vellore","Cuddalore"],
  "Trichy":      ["Trichy","Karur","Thanjavur","Ariyalur","Pudukkottai"],
  "Erode":       ["Erode","Salem","Namakkal","Coimbatore","Karur"],
  "Namakkal":    ["Namakkal","Salem","Erode","Karur","Dharmapuri"],
  "Vellore":     ["Vellore","Tiruvannamalai","Dharmapuri","Krishnagiri","Villupuram"],
  "Thanjavur":   ["Thanjavur","Trichy","Tiruvarur","Nagapattinam","Pudukkottai"],
  "Tirunelveli": ["Tirunelveli","Thoothukudi","Virudhunagar","Ramanathapuram","Tenkasi"],
  "Villupuram":  ["Villupuram","Cuddalore","Kallakurichi","Tiruvannamalai","Vellore"],
  "Krishnagiri": ["Krishnagiri","Dharmapuri","Salem","Vellore","Tiruvannamalai"],
};

// Weather impact on price per commodity type
const WEATHER_IMPACT: Record<string, (rain: number, temp: number) => number> = {
  "Tomato":      (r, t) => r > 15 ? 1.15 : r > 5 ? 1.07 : t > 36 ? 1.05 : 1.0,
  "Onion":       (r, t) => r > 15 ? 1.05 : 1.0,
  "Potato":      (r, t) => t < 22 ? 0.97 : 1.0,
  "Brinjal":     (r, t) => r > 10 ? 1.10 : t > 36 ? 1.08 : 1.0,
  "Cabbage":     (r, t) => t > 34 ? 1.12 : t < 22 ? 0.95 : 1.0,
  "Cauliflower": (r, t) => t > 34 ? 1.15 : t < 22 ? 0.93 : 1.0,
  "Carrot":      (r, t) => t < 22 ? 0.95 : 1.0,
  "Beans":       (r, t) => r > 10 ? 1.08 : t > 36 ? 1.10 : 1.0,
  "Capsicum":    (r, t) => r > 10 ? 1.12 : t > 36 ? 1.08 : 1.0,
  "Lady Finger": (r, t) => r > 10 ? 1.08 : t > 36 ? 1.05 : 1.0,
  "Bitter Gourd":(r, t) => r > 15 ? 1.10 : 1.0,
  "Drumstick":   (r, t) => r > 15 ? 1.12 : 1.0,
  "Pumpkin":     (r, t) => 1.0,
};

interface WeatherDay { rain: number; temp: number; }
interface MandiPrediction {
  district: string;
  basePrice: number;
  days: { date: string; price: number; weatherFactor: number; rain: number; temp: number; }[];
}

async function fetchWeather10Days(lat: number, lng: number): Promise<WeatherDay[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_max&timezone=Asia%2FKolkata&forecast_days=10`;
    const r = await fetch(url);
    const d = await r.json();
    const rain = d.daily?.precipitation_sum || [];
    const temp = d.daily?.temperature_2m_max || [];
    return rain.map((r: number, i: number) => ({ rain: r || 0, temp: temp[i] || 30 }));
  } catch { return Array(10).fill({ rain: 0, temp: 30 }); }
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Salem":[11.65,78.16],"Erode":[11.34,77.72],"Namakkal":[11.22,78.17],
  "Dharmapuri":[12.13,78.16],"Krishnagiri":[12.52,78.21],"Coimbatore":[11.01,76.96],
  "Tiruppur":[11.10,77.34],"Dindigul":[10.36,77.98],"Madurai":[9.92,78.12],
  "Virudhunagar":[9.58,77.96],"Sivaganga":[9.84,78.48],"Theni":[10.01,77.48],
  "Chennai":[13.08,80.27],"Kancheepuram":[12.83,79.70],"Villupuram":[11.94,79.49],
  "Vellore":[12.92,79.13],"Cuddalore":[11.75,79.77],"Trichy":[10.79,78.70],
  "Karur":[10.96,78.08],"Thanjavur":[10.79,79.14],"Ariyalur":[11.13,79.08],
  "Pudukkottai":[10.37,78.82],"Tiruvarur":[10.77,79.64],"Nagapattinam":[10.76,79.84],
  "Tirunelveli":[8.72,77.69],"Thoothukudi":[8.79,78.13],"Ramanathapuram":[9.37,78.83],
  "Tenkasi":[8.96,77.32],"Tiruvannamalai":[12.23,79.07],"Kallakurichi":[11.74,78.96],
};

export function MandiPriceForecast() {
  const [selectedVeg, setSelectedVeg] = useState("Tomato");
  const [selectedGroup, setSelectedGroup] = useState("Salem");
  const [predictions, setPredictions] = useState<MandiPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDay, setCurrentDay] = useState(0); // for pagination
  const [viewMode, setViewMode] = useState<"table"|"cards">("table");

  useEffect(() => {
    const saved = localStorage.getItem("agri_loc_v4");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.district && DISTRICT_GROUPS[parsed.district]) {
          setSelectedGroup(parsed.district);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    generateForecast(selectedVeg, selectedGroup);
    setCurrentDay(0);
  }, [selectedVeg, selectedGroup]);

  const generateForecast = async (veg: string, groupKey: string) => {
    setLoading(true);
    const districts = DISTRICT_GROUPS[groupKey] || DISTRICT_GROUPS["Salem"];

    try {
      // Get commodity id
      const { data: comm } = await supabase
        .from("commodities").select("id").eq("name", veg).single();
      if (!comm) { setLoading(false); return; }

      // Get base prices per district from DB
      const fromDate = new Date(Date.now() - 14*86400000).toISOString().split("T")[0];
      const { data: priceRows } = await supabase
        .from("price_data")
        .select("price, mandi_location, recorded_at")
        .eq("commodity_id", comm.id)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: false });

      // Get base price per district (latest available)
      const districtPrices: Record<string, number> = {};
      for (const district of districts) {
        const match = (priceRows || []).find(r =>
          r.mandi_location?.toLowerCase().includes(district.toLowerCase())
        );
        districtPrices[district] = match ? Number(match.price) : 0;
      }

      // Fill missing with average or base
      const validPrices = Object.values(districtPrices).filter(p => p > 0);
      const avgPrice = validPrices.length > 0
        ? validPrices.reduce((a,b) => a+b, 0) / validPrices.length
        : { Tomato:40, Onion:28, Potato:22, Brinjal:35, Cabbage:20, Cauliflower:42,
            Carrot:38, Beans:65, Capsicum:60, "Lady Finger":45, "Bitter Gourd":50,
            Drumstick:55, Pumpkin:25 }[veg] || 35;

      for (const d of districts) {
        if (!districtPrices[d] || districtPrices[d] === 0) districtPrices[d] = avgPrice;
      }

      // Fetch 10-day weather for each district in parallel
      const weatherByDistrict: Record<string, WeatherDay[]> = {};
      await Promise.all(districts.map(async (district) => {
        const coords = DISTRICT_COORDS[district];
        if (coords) {
          weatherByDistrict[district] = await fetchWeather10Days(coords[0], coords[1]);
        } else {
          weatherByDistrict[district] = Array(10).fill({ rain: 0, temp: 30 });
        }
      }));

      // Generate 10-day predictions using weather
      const impactFn = WEATHER_IMPACT[veg] || (() => 1.0);
      const today = new Date();

      const result: MandiPrediction[] = districts.map(district => {
        const base = districtPrices[district];
        const weather = weatherByDistrict[district] || [];
        let price = base;

        const days = Array(10).fill(0).map((_, i) => {
          const w = weather[i] || { rain: 0, temp: 30 };
          const factor = impactFn(w.rain, w.temp);
          // Small trend component
          const trend = 1 + (Math.random() * 0.02 - 0.01) * (i + 1);
          price = Math.max(price * factor * trend, base * 0.7);
          price = Math.min(price, base * 1.5);
          return {
            date: format(addDays(today, i+1), "dd MMM"),
            price: Math.round(price * 100) / 100,
            weatherFactor: factor,
            rain: w.rain,
            temp: Math.round(w.temp),
          };
        });

        return { district, basePrice: base, days };
      });

      setPredictions(result);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const days10 = Array(10).fill(0).map((_, i) =>
    format(addDays(new Date(), i+1), "dd MMM EEE")
  );

  const emoji = VEGETABLES.find(v => v.name === selectedVeg)?.emoji || "🥬";
  const DAYS_PER_PAGE = 5;
  const totalPages = Math.ceil(10 / DAYS_PER_PAGE);
  const visibleDays = Array.from({ length: DAYS_PER_PAGE }, (_, i) => currentDay * DAYS_PER_PAGE + i).filter(i => i < 10);

  return (
    <section className="py-16 bg-muted/10">
      <div className="container px-4">

        {/* Header */}
        <div className="section-header">
          <div className="badge-secondary mb-4">
            <Calendar className="h-4 w-4"/>10-Day Mandi Price Forecast
          </div>
          <h2 className="section-title">Future Prices Across Mandis</h2>
          <p className="section-description">
            AI predictions for all districts — adjusted for live weather conditions
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {/* District group */}
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-medium text-foreground outline-none focus:border-primary/50 cursor-pointer">
            {Object.keys(DISTRICT_GROUPS).map(d => (
              <option key={d} value={d}>{d} + nearby</option>
            ))}
          </select>

          {/* Refresh */}
          <button onClick={() => generateForecast(selectedVeg, selectedGroup)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2 rounded-xl transition-all hover:border-primary/30">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")}/>
            Refresh
          </button>

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border border-border">
            {(["table","cards"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={cn("px-4 py-2 text-sm font-medium capitalize transition-all",
                  viewMode===m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Vegetable pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {VEGETABLES.map(v => (
            <button key={v.name} onClick={() => setSelectedVeg(v.name)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                selectedVeg===v.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40")}>
              <span>{v.emoji}</span>{v.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_,i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse"/>)}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">📊</p>
            <p>Select a vegetable and district group to see forecasts</p>
          </div>
        ) : viewMode === "table" ? (
          /* ── TABLE VIEW ── */
          <div className="card-elevated rounded-2xl overflow-hidden">
            {/* Day pagination header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <span>{emoji}</span>
                {selectedVeg} — {selectedGroup} &amp; nearby ({predictions.length} districts)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Days {currentDay*DAYS_PER_PAGE+1}–{Math.min((currentDay+1)*DAYS_PER_PAGE, 10)} of 10
                </span>
                <button onClick={() => setCurrentDay(p => Math.max(0, p-1))} disabled={currentDay===0}
                  className="p-1.5 rounded-lg border border-border hover:border-primary/40 disabled:opacity-30 transition-all">
                  <ChevronLeft className="h-4 w-4"/>
                </button>
                <button onClick={() => setCurrentDay(p => Math.min(totalPages-1, p+1))} disabled={currentDay===totalPages-1}
                  className="p-1.5 rounded-lg border border-border hover:border-primary/40 disabled:opacity-30 transition-all">
                  <ChevronRight className="h-4 w-4"/>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase">District</th>
                    <th className="text-center px-2 py-3 font-semibold text-muted-foreground text-xs uppercase">Now</th>
                    {visibleDays.map(i => (
                      <th key={i} className="text-center px-3 py-3 min-w-[90px]">
                        <div className="font-semibold text-xs text-foreground">{days10[i].split(" ")[0]} {days10[i].split(" ")[1]}</div>
                        <div className="text-xs text-muted-foreground">{days10[i].split(" ")[2]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((mandi, rowIdx) => (
                    <tr key={mandi.district}
                      className={cn("border-b border-muted/50 hover:bg-muted/20 transition-all",
                        rowIdx === 0 && "bg-primary/5")}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0"/>
                          <span className="font-semibold text-foreground">{mandi.district}</span>
                          {rowIdx === 0 && <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">Your area</span>}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className="font-bold text-foreground">₹{mandi.basePrice.toFixed(0)}</span>
                      </td>
                      {visibleDays.map(i => {
                        const day = mandi.days[i];
                        const diff = day.price - mandi.basePrice;
                        const pct = ((diff / mandi.basePrice) * 100);
                        const isRain = day.rain > 5;
                        const isHot = day.temp > 35;
                        return (
                          <td key={i} className="px-3 py-3 text-center">
                            <div className={cn("font-bold",
                              diff > 2 ? "text-red-500" : diff < -2 ? "text-green-600" : "text-foreground")}>
                              ₹{day.price.toFixed(0)}
                            </div>
                            <div className={cn("text-xs",
                              diff > 0 ? "text-red-400" : diff < 0 ? "text-green-500" : "text-muted-foreground")}>
                              {diff > 0 ? "▲" : diff < 0 ? "▼" : "—"}{Math.abs(pct).toFixed(1)}%
                            </div>
                            <div className="flex justify-center gap-0.5 mt-0.5">
                              {isRain && <CloudRain className="h-2.5 w-2.5 text-blue-400"/>}
                              {isHot && <Sun className="h-2.5 w-2.5 text-orange-400"/>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border bg-muted/10 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><span className="text-red-400 font-bold">▲</span> Price rising</div>
              <div className="flex items-center gap-1"><span className="text-green-500 font-bold">▼</span> Price falling</div>
              <div className="flex items-center gap-1"><CloudRain className="h-3 w-3 text-blue-400"/> Rain impact</div>
              <div className="flex items-center gap-1"><Sun className="h-3 w-3 text-orange-400"/> Heat impact</div>
              <span className="ml-auto">📊 Weather-adjusted AI forecast · Open-Meteo</span>
            </div>
          </div>
        ) : (
          /* ── CARDS VIEW ── */
          <div className="space-y-6">
            {predictions.map((mandi, idx) => (
              <div key={mandi.district} className={cn("card-elevated rounded-2xl overflow-hidden",
                idx===0 && "border-primary/30")}>
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
                  <MapPin className="h-4 w-4 text-primary"/>
                  <span className="font-bold text-foreground">{mandi.district}</span>
                  {idx===0 && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Your area</span>}
                  <span className="ml-auto text-sm text-muted-foreground">Base ₹{mandi.basePrice.toFixed(0)}/kg</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 divide-x divide-border">
                  {mandi.days.map((day, i) => {
                    const diff = day.price - mandi.basePrice;
                    const isRain = day.rain > 5;
                    const isHot = day.temp > 35;
                    return (
                      <div key={i} className={cn("p-3 text-center",
                        i===0 && "bg-primary/5")}>
                        <div className="text-xs text-muted-foreground mb-1">{day.date}</div>
                        <div className={cn("font-black text-sm",
                          diff > 2 ? "text-red-500" : diff < -2 ? "text-green-600" : "text-foreground")}>
                          ₹{day.price.toFixed(0)}
                        </div>
                        <div className={cn("text-xs",
                          diff > 0 ? "text-red-400" : diff < 0 ? "text-green-500" : "text-muted-foreground")}>
                          {diff > 0 ? "▲" : diff < 0 ? "▼" : "="}{Math.abs(diff).toFixed(0)}
                        </div>
                        <div className="flex justify-center gap-0.5 mt-1">
                          {isRain && <CloudRain className="h-3 w-3 text-blue-400"/>}
                          {isHot && <Sun className="h-3 w-3 text-orange-400"/>}
                          {!isRain && !isHot && <span className="h-3"/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          🌤️ Prices adjusted for live 10-day weather forecast from Open-Meteo · Historical prices from Agmarknet
        </p>
      </div>
    </section>
  );
}
