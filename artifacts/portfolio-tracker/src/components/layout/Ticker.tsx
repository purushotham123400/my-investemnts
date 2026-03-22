import { useRef, useEffect, useState } from "react";
import { useGetMarketPrices } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatINR, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";

export function Ticker() {
  const queryClient = useQueryClient();
  const { data: marketPrices, isLoading } = useGetMarketPrices({
    query: { refetchInterval: 3600000 }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const isPaused = useRef(false);
  const scrollPos = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !marketPrices) return;
    const speed = 0.6;
    const tick = () => {
      if (!isPaused.current && el) {
        scrollPos.current += speed;
        if (scrollPos.current >= el.scrollWidth / 2) scrollPos.current = 0;
        el.scrollLeft = scrollPos.current;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [marketPrices]);

  const pause = () => { isPaused.current = true; };
  const resume = () => {
    const el = scrollRef.current;
    if (el) scrollPos.current = el.scrollLeft;
    isPaused.current = false;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="h-10 w-full bg-card border-b border-border flex items-center px-4 overflow-hidden relative z-50">
        <div className="flex space-x-8 animate-pulse opacity-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <div className="h-4 w-16 bg-muted rounded"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!marketPrices) return null;

  const prices = Object.entries(marketPrices)
    .filter(([key]) => key !== 'lastUpdated')
    .map(([_, value]) => value as any);

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-card/95 backdrop-blur z-50 border-b border-border flex items-center text-sm font-medium">
      <div className="flex-shrink-0 w-10 flex items-center justify-center">
        <Activity className="w-4 h-4 text-primary" />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
      >
        <div className="flex whitespace-nowrap select-none">
          {[...prices, ...prices].map((p, i) => {
            const isPositive = p.change >= 0;
            return (
              <div key={i} className="flex items-center space-x-3 px-6 border-r border-border/50 shrink-0">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="text-foreground">{formatINR(p.price)}</span>
                <span className={cn(
                  "flex items-center space-x-1 text-xs px-1.5 py-0.5 rounded",
                  isPositive ? "text-green-400 bg-green-400/10" : "text-destructive bg-destructive/10"
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{Math.abs(p.changePercent).toFixed(2)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
        title="Refresh all prices"
      >
        <RefreshCw className={cn("w-4 h-4 text-primary", isRefreshing && "animate-spin")} />
      </button>
    </div>
  );
}
