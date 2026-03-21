import { motion } from "framer-motion";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { Wallet, PieChart, TrendingUp, TrendingDown, Layers } from "lucide-react";

interface SummaryCardsProps {
  totals: {
    totalInvested: number;
    currentValue: number;
    profitLoss: number;
    profitLossPercent: number;
    holdingCount: number;
  };
  isLoading: boolean;
}

export function SummaryCards({ totals, isLoading }: SummaryCardsProps) {
  const isPositive = totals.profitLoss >= 0;

  const cards = [
    {
      title: "Current Value",
      value: formatINR(totals.currentValue),
      icon: <PieChart className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
      highlight: false
    },
    {
      title: "Total Invested",
      value: formatINR(totals.totalInvested),
      icon: <Wallet className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />,
      highlight: false
    },
    {
      title: "Total P&L",
      value: `${totals.profitLoss >= 0 ? '+' : ''}${formatINR(totals.profitLoss)}`,
      subValue: formatPercent(totals.profitLossPercent),
      icon: isPositive ? <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-destructive" />,
      highlight: true,
      positive: isPositive
    },
    {
      title: "Holdings",
      value: totals.holdingCount.toString(),
      icon: <Layers className="w-4 h-4 md:w-5 md:h-5 text-accent" />,
      highlight: false
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel p-4 md:p-6 rounded-2xl animate-pulse">
            <div className="h-3 md:h-4 w-20 md:w-24 bg-muted rounded mb-3 md:mb-4"></div>
            <div className="h-6 md:h-8 w-24 md:w-32 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          className={cn(
            "glass-panel p-4 md:p-6 rounded-2xl relative overflow-hidden group",
            card.highlight && (card.positive ? "ring-1 ring-green-500/30" : "ring-1 ring-destructive/30")
          )}
        >
          {/* Subtle gradient glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2 md:mb-4">
              <p className="text-xs md:text-sm font-medium text-muted-foreground">{card.title}</p>
              <div className="p-1.5 md:p-2 bg-card-border/50 rounded-lg md:rounded-xl">{card.icon}</div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-baseline space-y-1 md:space-y-0 md:space-x-2">
              <h3 className={cn(
                "text-lg sm:text-xl md:text-3xl font-display truncate",
                card.highlight ? (card.positive ? "text-green-500" : "text-destructive") : "text-foreground"
              )}>
                {card.value}
              </h3>
              {card.subValue && (
                <span className={cn(
                  "text-[10px] md:text-sm font-medium px-1.5 md:px-2 py-0.5 rounded w-fit",
                  card.positive ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"
                )}>
                  {card.subValue}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
