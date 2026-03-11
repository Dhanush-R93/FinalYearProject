import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, BarChart3, Shield, Leaf, ChevronDown, Sparkles } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";

function FloatingParticle({ className, speed = 1 }: { className: string; speed?: number }) {
  return <div className={`absolute rounded-full opacity-20 animate-float ${className}`} />;
}

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

export function HeroSection() {
  const scrollY = useParallax();

  const scrollToSection = () => {
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Parallax background layers */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.12),transparent_50%)]"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.1),transparent_50%)]"
          style={{ transform: `translateY(${scrollY * 0.25}px)` }}
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.06),transparent_60%)]"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        />
        {/* Moving orbs */}
        <div
          className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl top-[10%] left-[5%]"
          style={{ transform: `translate(${scrollY * 0.05}px, ${scrollY * 0.2}px)` }}
        />
        <div
          className="absolute w-72 h-72 rounded-full bg-accent/8 blur-3xl top-[30%] right-[10%]"
          style={{ transform: `translate(${scrollY * -0.08}px, ${scrollY * 0.15}px)` }}
        />
        <div
          className="absolute w-64 h-64 rounded-full bg-secondary/5 blur-3xl bottom-[20%] left-[40%]"
          style={{ transform: `translate(${scrollY * 0.03}px, ${scrollY * 0.3}px)` }}
        />
      </div>

      {/* Grid pattern with parallax */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_40%,black,transparent)]"
        style={{ transform: `translateY(${scrollY * 0.05}px)` }}
      />

      {/* Floating particles with parallax */}
      <div style={{ transform: `translateY(${scrollY * 0.3}px)` }}>
        <FloatingParticle className="w-3 h-3 bg-primary top-[20%] left-[15%] animation-delay-0" />
        <FloatingParticle className="w-2 h-2 bg-secondary top-[30%] right-[20%] animation-delay-1000" />
      </div>
      <div style={{ transform: `translateY(${scrollY * 0.2}px)` }}>
        <FloatingParticle className="w-4 h-4 bg-accent top-[60%] left-[10%] animation-delay-2000" />
        <FloatingParticle className="w-2 h-2 bg-primary top-[70%] right-[15%] animation-delay-500" />
      </div>
      <div style={{ transform: `translateY(${scrollY * 0.4}px)` }}>
        <FloatingParticle className="w-3 h-3 bg-secondary top-[45%] left-[80%] animation-delay-1500" />
        <FloatingParticle className="w-2 h-2 bg-accent top-[15%] left-[60%] animation-delay-1000" />
      </div>

      {/* Geometric decorations */}
      <div
        className="absolute top-[15%] right-[8%] w-20 h-20 border border-primary/10 rounded-2xl rotate-12 hidden lg:block"
        style={{ transform: `rotate(${12 + scrollY * 0.03}deg) translateY(${scrollY * 0.1}px)` }}
      />
      <div
        className="absolute bottom-[25%] left-[5%] w-16 h-16 border border-accent/15 rounded-full hidden lg:block"
        style={{ transform: `translateY(${scrollY * 0.2}px) scale(${1 + scrollY * 0.0003})` }}
      />

      <div
        className="container relative z-10 px-4 py-16"
        style={{ transform: `translateY(${scrollY * -0.1}px)`, opacity: Math.max(0, 1 - scrollY * 0.001) }}
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="badge-primary mb-8 animate-fade-in backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Agricultural Analytics</span>
          </div>

          {/* Main Heading */}
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

          {/* Subheading */}
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-slide-up leading-relaxed" style={{ animationDelay: "0.1s" }}>
            Make informed decisions with advanced price forecasting.
            Track real-time mandi prices, get accurate predictions, and maximize your profits.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="btn-primary group px-10 py-6 text-base rounded-xl shadow-lg hover:shadow-xl relative overflow-hidden" onClick={scrollToSection}>
              <span className="relative z-10 flex items-center">
                View Live Prices
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
            <Button variant="outline" size="lg" className="btn-outline px-10 py-6 text-base rounded-xl group" asChild>
              <a href="#predictions">
                See Predictions
                <TrendingUp className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
              </a>
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <CountUpStat value="95%" suffix="+" label="Prediction Accuracy" icon={TrendingUp} colorClass="bg-primary/10 text-primary" />
            <CountUpStat value="50" suffix="+" label="Mandis Covered" icon={BarChart3} colorClass="bg-secondary/10 text-secondary" />
            <CountUpStat value="Real-time" label="Market Updates" icon={Shield} colorClass="bg-accent/20 text-accent-foreground" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToSection}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors animate-bounce-gentle"
        style={{ opacity: Math.max(0, 1 - scrollY * 0.005) }}
      >
        <span className="text-xs font-medium">Scroll Down</span>
        <ChevronDown className="h-5 w-5" />
      </button>
    </section>
  );
}
