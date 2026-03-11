import { Cloud, Droplets, Wind, Sun, Thermometer, CloudRain, MapPin } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const weatherData = [
  { city: "Delhi", temp: 18, humidity: 65, wind: 12, condition: "Partly Cloudy", impact: "Favorable for storage" },
  { city: "Mumbai", temp: 28, humidity: 78, wind: 8, condition: "Humid", impact: "Risk of spoilage - sell quickly" },
  { city: "Chennai", temp: 30, humidity: 72, wind: 15, condition: "Sunny", impact: "Good transport conditions" },
  { city: "Kolkata", temp: 22, humidity: 70, wind: 10, condition: "Clear", impact: "Ideal market conditions" },
];

const weatherImpacts = [
  { commodity: "Tomato", impact: "Heavy rains expected - prices may rise 15-20%", trend: "up" as const },
  { commodity: "Onion", impact: "Dry conditions - stable storage, steady prices", trend: "neutral" as const },
  { commodity: "Potato", impact: "Cool weather extending shelf life", trend: "down" as const },
  { commodity: "Green Chili", impact: "Heat wave - faster spoilage expected", trend: "up" as const },
];

function WeatherCard({ city, temp, humidity, wind, condition, impact, index }: typeof weatherData[0] & { index: number }) {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <div
      ref={ref}
      className={cn(
        "group card-interactive p-5 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lg",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{city}</h3>
          <p className="text-sm text-muted-foreground">{condition}</p>
        </div>
        <div className="p-2 rounded-lg bg-accent/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
          {condition.includes("Rain") ? (
            <CloudRain className="h-6 w-6 text-accent-foreground" />
          ) : condition.includes("Cloud") ? (
            <Cloud className="h-6 w-6 text-accent-foreground" />
          ) : (
            <Sun className="h-6 w-6 text-accent-foreground" />
          )}
        </div>
      </div>
      
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">{temp}°</span>
        <span className="text-sm text-muted-foreground">C</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Droplets className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">{humidity}%</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Wind className="h-4 w-4 text-secondary" />
          <span className="text-muted-foreground">{wind} km/h</span>
        </div>
      </div>
      
      <div className="pt-3 border-t border-border group-hover:border-primary/20 transition-colors">
        <p className="text-xs text-muted-foreground">{impact}</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent via-primary to-secondary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
    </div>
  );
}

export function WeatherSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section id="weather" className="py-16">
      <div className="container px-4">
        <div
          ref={headerRef}
          className={cn(
            "section-header transition-all duration-700",
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="badge-accent mb-4">
            <Cloud className="h-4 w-4" />
            Weather Impact
          </div>
          <h2 className="section-title">Weather & Price Forecast</h2>
          <p className="section-description">
            See how weather conditions affect commodity prices across major markets
          </p>
          <div className="flex justify-center items-center gap-2 mt-4">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Live data from major Indian cities</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {weatherData.map((weather, i) => (
            <WeatherCard key={weather.city} {...weather} index={i} />
          ))}
        </div>

        <div className="max-w-3xl mx-auto">
          <h3 className="font-semibold text-lg text-foreground mb-4 text-center">Weather-Based Price Alerts</h3>
          <div className="space-y-3">
            {weatherImpacts.map((item, i) => {
              const trendStyles = {
                up: { bg: "bg-price-up/10", text: "text-price-up", label: "↑ Rising" },
                down: { bg: "bg-price-down/10", text: "text-price-down", label: "↓ Falling" },
                neutral: { bg: "bg-price-neutral/10", text: "text-price-neutral", label: "→ Stable" },
              }[item.trend];

              return (
                <div
                  key={item.commodity}
                  className="group card-interactive p-4 flex items-center gap-4 hover:-translate-x-1 transition-all duration-300"
                >
                  <div className={cn("p-2 rounded-lg group-hover:scale-110 transition-transform", trendStyles.bg)}>
                    <Thermometer className={cn("h-5 w-5", trendStyles.text)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">{item.commodity}</p>
                    <p className="text-sm text-muted-foreground">{item.impact}</p>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full text-xs font-medium", trendStyles.bg, trendStyles.text)}>
                    {trendStyles.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
