import { useState } from "react";
import { useGetPortfolioHistory } from "@workspace/api-client-react";
import { formatINR, formatCompactINR } from "@/lib/utils";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Range = "7d" | "1m" | "3m" | "6m" | "1y" | "all";
const RANGES: { label: string; value: Range }[] = [
  { label: "7D", value: "7d" }, { label: "1M", value: "1m" }, { label: "3M", value: "3m" },
  { label: "6M", value: "6m" }, { label: "1Y", value: "1y" }, { label: "All", value: "all" },
];
const COLORS = ["hsl(var(--chart-1))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))","hsl(var(--chart-5))"];

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-2">{format(new Date(label), "MMM dd, yyyy")}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-xs" style={{ color: entry.color }}>{entry.name}</span>
              <span className="text-xs font-bold">{formatINR(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

interface PerformanceChartProps { todayValue?: number; todayInvested?: number; }

export function PerformanceChart({ todayValue, todayInvested }: PerformanceChartProps) {
  const [range, setRange] = useState<Range>("1m");
  const { data: history = [], isLoading } = useGetPortfolioHistory({ range });

  const todayDate = new Date().toISOString().split("T")[0];
  // Always override today's point with live values so chart updates immediately
  // when holdings are added or deleted (don't rely on stale DB snapshot)
  const historyWithoutToday = history.filter((h) => h.date !== todayDate);
  const chartData = todayValue !== undefined && todayInvested !== undefined
    ? [...historyWithoutToday, { id: 0, date: todayDate, totalValue: todayValue, totalInvested: todayInvested, profitLoss: todayValue - todayInvested, createdAt: new Date().toISOString() }]
    : history;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Performance</h3>
          <p className="text-xs text-muted-foreground">Portfolio value over time</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={cn("px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-md transition-all flex-1 sm:flex-none",
                range === r.value ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-card-border")}
            >{r.label}</button>
          ))}
        </div>
      </div>
      <div className="h-48 md:h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-xs text-muted-foreground">No history data available for this range</p></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tickFormatter={(tick) => format(new Date(tick), "MMM dd")} stroke="hsl(var(--muted-foreground))" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tickFormatter={(tick) => formatCompactINR(tick)} stroke="hsl(var(--muted-foreground))" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area type="monotone" dataKey="totalValue" name="Current Value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#colorValue)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="totalInvested" name="Invested" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#colorInvested)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

interface AllocationChartProps { holdings: any[]; }

export function AllocationChart({ holdings }: AllocationChartProps) {
  const data = holdings.filter((h) => h.currentValue > 0).sort((a, b) => b.currentValue - a.currentValue).slice(0, 5).map((h) => ({ name: h.symbol, value: h.currentValue }));
  if (holdings.length > 5) {
    const othersValue = holdings.slice(5).reduce((sum: number, h: any) => sum + h.currentValue, 0);
    if (othersValue > 0) data.push({ name: "Others", value: othersValue });
  }
  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 md:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Allocation</h3>
        <p className="text-xs text-muted-foreground">Assets by current value</p>
      </div>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center"><p className="text-xs text-muted-foreground">No holdings yet</p></div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" labelLine={false}
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                if (percent < 0.08) return null;
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
              }}
            >
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: any) => formatINR(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
            <Legend formatter={(value) => value} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
