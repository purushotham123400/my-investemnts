import { useState } from "react";
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
    todayPLTotal: number | null;
    todayPLPercent: number | null;
  };
  isLoading: boolean;
}

export function SummaryCards({ totals, isLoading }: SummaryCardsProps) {
  const [showTodayPL, setShowTodayPL] = useState(false);
  const isPositive = totals.profitLoss >= 0;

  const hasTodayPL = totals.todayPLTotal !== null;
  const todayPL = totals.todayPLTotal ?? 0;
  const todayPLPercent = totals.todayPLPercent ?? 0;
  const isTodayPositive = todayPL >= 0;

  const plValue = showTodayPL
    ? (hasTodayPL ? `${todayPL >= 0 ? "+" : ""}${formatINR(todayPL)}` : "–")
    : `${totals.profitLoss >= 0 ? "+" : ""}${formatINR(totals.profitLoss)}`;
  const plPercent = showTodayPL
    ? (hasTodayPL ? formatPercent(todayPLPercent) : null)
    : formatPercent(totals.profitLossPercent);
  const plPositive = showTodayPL ? isTodayPositive : isPositive;

  const cards = [
    { title: "Current Value", value: formatINR(totals.currentValue), icon: <Wallet size={16} />, highlight: false, positive: undefined as boolean | undefined, subValue: undefined as string | undefined, onClick: undefined as (() => void) | undefined, hint: undefined as string | undefined },
    { title: "Total Invested", value: formatINR(totals.totalInvested), icon: <PieChart size={16} />, highlight: false, positive: undefined, subValue: undefined, onClick: undefined, hint: undefined },
    {
      title: showTodayPL ? "Today's P&L" : "Total P&L",
      value: plValue,
      subValue: plPercent ?? undefined,
      icon: plPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
      highlight: true, positive: plPositive,
      onClick: () => setShowTodayPL((p) => !p),
      hint: showTodayPL ? "Tap for Total P&L" : "Tap for Today's P&L",
    },
    { title: "Holdings", value: totals.holdingCount.toString(), icon: <Layers size={16} />, highlight: false, positive: undefined, subValue: undefined, onClick: undefined, hint: undefined },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-card rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, i) => (
        <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
          onClick={card.onClick}
          className={cn(
            "relative overflow-hidden rounded-2xl p-4 md:p-5 flex flex-col gap-2 border border-card-border bg-card",
            card.highlight && card.positive && "border-emerald-500/30 bg-emerald-500/5",
            card.highlight && !card.positive && "border-red-500/30 bg-red-500/5",
            card.onClick && "cursor-pointer select-none active:scale-95 transition-transform"
          )}
        >
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: card.highlight ? (card.positive ? "radial-gradient(circle at 50% 0%,rgba(16,185,129,0.08),transparent 70%)" : "radial-gradient(circle at 50% 0%,rgba(239,68,68,0.08),transparent 70%)") : "radial-gradient(circle at 50% 0%,rgba(99,102,241,0.06),transparent 70%)" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{card.title}</span>
            <span className={cn("p-1.5 rounded-lg", card.highlight && card.positive ? "text-emerald-400 bg-emerald-500/10" : card.highlight && !card.positive ? "text-red-400 bg-red-500/10" : "text-muted-foreground bg-muted/30")}>{card.icon}</span>
          </div>
          <h3 className={cn("text-lg md:text-xl font-bold tracking-tight", card.highlight && card.positive ? "text-emerald-400" : card.highlight && !card.positive ? "text-red-400" : "text-foreground")}>{card.value}</h3>
          {card.subValue && <span className={cn("text-xs font-medium", card.positive ? "text-emerald-400/80" : "text-red-400/80")}>{card.subValue}</span>}
          {card.hint && <span className="text-[10px] text-muted-foreground/50 mt-auto">{card.hint}</span>}
        </motion.div>
      ))}
    </div>
  );
}
