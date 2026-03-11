import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  lastUpdate?: Date | null;
  className?: string;
}

export function LiveIndicator({ lastUpdate, className }: LiveIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-price-up opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-price-up"></span>
      </span>
      <span className="text-xs text-muted-foreground">
        Live {lastUpdate ? `• Updated ${formatTimeAgo(lastUpdate)}` : ""}
      </span>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
