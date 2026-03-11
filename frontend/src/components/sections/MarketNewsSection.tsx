import { useState, useEffect } from "react";
import { Newspaper, Clock, ExternalLink, TrendingUp, Leaf, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useRealtimeNews } from "@/hooks/useRealtimeData";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const fallbackNews = [
  { id: "1", title: "Tomato Prices Surge Due to Unseasonal Rains in Karnataka", content: "Heavy rains have damaged crops in major tomato-producing regions, leading to a 25% price increase in wholesale markets.", category: "price_alert", source: "AgriNews", published_at: new Date().toISOString(), image_url: null },
  { id: "2", title: "Government Announces MSP Increase for Rabi Crops", content: "The Ministry of Agriculture has announced a 7% increase in minimum support prices for wheat and other rabi crops for the upcoming season.", category: "policy", source: "Economic Times", published_at: new Date(Date.now() - 3600000).toISOString(), image_url: null },
  { id: "3", title: "Onion Export Ban Extended for Three More Months", content: "To stabilize domestic prices, the government has decided to extend the onion export ban until the next harvest season.", category: "policy", source: "Business Standard", published_at: new Date(Date.now() - 7200000).toISOString(), image_url: null },
  { id: "4", title: "New Cold Storage Facilities in Punjab to Reduce Wastage", content: "A new cold storage network is being established to help farmers store produce and reduce post-harvest losses by 30%.", category: "infrastructure", source: "The Hindu", published_at: new Date(Date.now() - 10800000).toISOString(), image_url: null },
];

function getCategoryIcon(category: string | null) {
  switch (category) {
    case "price_alert": return <TrendingUp className="h-4 w-4" />;
    case "policy": return <AlertCircle className="h-4 w-4" />;
    case "infrastructure": return <Leaf className="h-4 w-4" />;
    default: return <Newspaper className="h-4 w-4" />;
  }
}

function getCategoryColor(category: string | null) {
  switch (category) {
    case "price_alert": return "bg-price-up/10 text-price-up";
    case "policy": return "bg-secondary/10 text-secondary";
    case "infrastructure": return "bg-primary/10 text-primary";
    default: return "bg-muted text-muted-foreground";
  }
}

function NewsCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className={`card-interactive p-5 ${large ? "md:col-span-2" : ""}`}>
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-5 w-16 rounded mb-2" />
          <Skeleton className={`h-6 ${large ? "w-3/4" : "w-full"} mb-2`} />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function NewsCard({ item, index, isLarge }: { item: typeof fallbackNews[0]; index: number; isLarge: boolean }) {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <article
      ref={ref}
      className={cn(
        "group card-interactive p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg",
        isLarge && "md:col-span-2",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className={cn("p-2 rounded-lg group-hover:scale-110 transition-transform duration-300", getCategoryColor(item.category))}>
          {getCategoryIcon(item.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getCategoryColor(item.category))}>
              {item.category?.replace("_", " ") || "General"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
            </span>
          </div>
          <h3 className={cn("font-semibold text-foreground mb-2 group-hover:text-primary transition-colors", isLarge && "text-lg")}>
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.content}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{item.source}</span>
            <button className="text-xs text-primary font-medium flex items-center gap-1 hover:underline group-hover:translate-x-1 transition-transform">
              Read more <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
    </article>
  );
}

export function MarketNewsSection() {
  const { lastUpdate } = useRealtimeNews();
  const [countdown, setCountdown] = useState(30);
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  const { data: news, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["market_news"],
    queryFn: async () => {
      const { data, error } = await supabase.from("market_news").select("*").order("published_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data && data.length > 0 ? data : fallbackNews;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setInterval(() => setCountdown((p) => p <= 1 ? 30 : p - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { if (isFetching) setCountdown(30); }, [isFetching]);

  const displayNews = news || fallbackNews;

  return (
    <section id="news" className="py-16">
      <div className="container px-4">
        <div
          ref={headerRef}
          className={cn(
            "section-header transition-all duration-700",
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="badge-secondary mb-4">
            <Newspaper className="h-4 w-4" />
            Market News
          </div>
          <h2 className="section-title">Latest Agricultural News</h2>
          <p className="section-description">Stay updated with market trends, policy changes, and agricultural developments</p>
          <div className="flex justify-center items-center gap-4 mt-4">
            <LiveIndicator lastUpdate={lastUpdate} />
            <span className="text-xs text-muted-foreground tabular-nums">Refreshing in {countdown}s</span>
            <button onClick={() => refetch()} className="p-2 hover:bg-muted rounded-full transition-colors" disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <NewsCardSkeleton large />
            {[...Array(3)].map((_, i) => <NewsCardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {displayNews.map((item, index) => (
              <NewsCard key={item.id} item={item} index={index} isLarge={index === 0} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
