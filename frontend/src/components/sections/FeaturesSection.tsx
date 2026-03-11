import { Brain, TrendingUp, MessageSquare, Shield, Zap, Globe } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Brain,
    title: "LSTM Deep Learning",
    description: "Advanced neural networks trained on years of historical price data for accurate predictions.",
    color: "bg-primary/10 text-primary",
    hoverBorder: "hover:border-primary/40",
  },
  {
    icon: TrendingUp,
    title: "Real-time Analytics",
    description: "Live market data integration with instant price updates from major agricultural markets.",
    color: "bg-secondary/10 text-secondary",
    hoverBorder: "hover:border-secondary/40",
  },
  {
    icon: MessageSquare,
    title: "AI Chatbot",
    description: "Natural language interface for easy access to market insights and recommendations.",
    color: "bg-primary/10 text-primary",
    hoverBorder: "hover:border-primary/40",
  },
  {
    icon: Shield,
    title: "Fair Trade Support",
    description: "Reduce middlemen exploitation and ensure fair pricing for farmers and consumers.",
    color: "bg-accent/20 text-accent-foreground",
    hoverBorder: "hover:border-accent/40",
  },
  {
    icon: Zap,
    title: "Instant Predictions",
    description: "Get price forecasts in seconds with confidence intervals and trend analysis.",
    color: "bg-secondary/10 text-secondary",
    hoverBorder: "hover:border-secondary/40",
  },
  {
    icon: Globe,
    title: "Multilingual Support",
    description: "Available in multiple regional languages for wider accessibility across farming communities.",
    color: "bg-primary/10 text-primary",
    hoverBorder: "hover:border-primary/40",
  },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative card-interactive p-6 overflow-hidden transition-all duration-500",
        feature.hoverBorder,
        "hover:shadow-lg hover:-translate-y-1",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-secondary/0 group-hover:from-primary/[0.03] group-hover:to-secondary/[0.03] transition-all duration-500" />
      
      <div className="relative z-10">
        <div className={cn(
          "inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-all duration-300",
          "group-hover:scale-110 group-hover:shadow-md",
          feature.color
        )}>
          <feature.icon className="h-7 w-7" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
          {feature.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {feature.description}
        </p>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
    </div>
  );
}

export function FeaturesSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section className="py-20 bg-muted/30 overflow-hidden">
      <div className="container px-4">
        {/* Section Header */}
        <div
          ref={headerRef}
          className={cn(
            "section-header transition-all duration-700",
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="badge-primary mb-4">
            <Zap className="h-4 w-4" />
            Platform Features
          </div>
          <h2 className="section-title">Why Choose AgriPrice</h2>
          <p className="section-description">
            Advanced technology stack combining AI, real-time data, and intuitive design
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
