import { useGetMarketPrices } from "@workspace/api-client-react";
import { formatINR, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

export function Ticker() {
  const { data: marketPrices, isLoading } = useGetMarketPrices({
    query: { refetchInterval: 3600000 } // 1 hour
  });

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

  // Extract all prices excluding the lastUpdated key
  const prices = Object.entries(marketPrices)
    .filter(([key]) => key !== 'lastUpdated')
    .map(([_, value]) => value as any);

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-card/95 backdrop-blur z-50 border-b border-border flex items-center overflow-hidden text-sm font-medium">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card to-transparent z-10 flex items-center justify-center">
        <Activity className="w-4 h-4 text-primary ml-2" />
      </div>
      
      <div className="flex whitespace-nowrap animate-marquee">
        {/* Render twice for seamless looping */}
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
  );
}
