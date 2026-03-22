import { useState } from "react";
import { useGetPortfolioHistory } from "@workspace/api-client-react";
import { formatINR, formatCompactINR } from "@/lib/utils";
import { format } from "date-fns";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Range = "7d" | "1m" | "3m" | "6m" | "1y" | "all";
const RANGES: { label: string; value: Range }[] = [
  { label: "7D", value: "7d" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

const COLORS = [
  "hsl(var(--chart-1))", 
  "hsl(var(--chart-2))", 
  "hsl(var(--chart-3))", 
  "hsl(var(--chart-4))", 
  "hsl(var(--chart-5))"
];

// Custom Tooltip for Line Chart
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border p-3 md:p-4 rounded-xl shadow-2xl">
        <p className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3">
          {format(new Date(label), "MMM dd, yyyy")}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4 md:space-x-6 mb-1">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs md:text-sm font-medium text-foreground">{entry.name}</span>
            </div>
            <span className="text-xs md:text-sm font-bold">{formatINR(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function PerformanceChart() {
  const [range, setRange] = useState<Range>("1m");
  const { data: history = [], isLoading } = useGetPortfolioHistory({ range });

  return (
    <div className="glass-panel rounded-2xl p-4 md:p-6 flex flex-col h-[350px] md:h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-lg font-display text-foreground">Performance</h3>
          <p className="text-xs md:text-sm text-muted-foreground">Portfolio value over time</p>
        </div>
        
        <div className="flex flex-wrap bg-card-border/50 p-1 rounded-lg gap-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-md transition-all flex-1 sm:flex-none",
                range === r.value 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground hover:bg-card-border"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        ) : history.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No history data available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(tick) => format(new Date(tick), "MMM dd")}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis 
                tickFormatter={(tick) => formatCompactINR(tick)}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area 
                type="monotone" 
                dataKey="totalValue" 
                name="Current Value"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                activeDot={{ r: 4 }}
              />
              <Area 
                type="monotone" 
                dataKey="totalInvested" 
                name="Total Invested"
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="none" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

interface AllocationChartProps {
  holdings: any[];
}

export function AllocationChart({ holdings }: AllocationChartProps) {
  // Aggregate data for pie chart
  const data = holdings
    .filter(h => h.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5) // Top 5
    .map(h => ({ name: h.symbol, value: h.currentValue }));

  // Add "Others" if needed
  if (holdings.length > 5) {
    const othersValue = holdings
      .slice(5)
      .reduce((sum, h) => sum + h.currentValue, 0);
    if (othersValue > 0) {
      data.push({ name: "Others", value: othersValue });
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-4 md:p-6 flex flex-col h-[350px] md:h-[400px]">
      <div className="mb-2">
        <h3 className="text-lg font-display text-foreground">Allocation</h3>
        <p className="text-xs md:text-sm text-muted-foreground">Assets by current value</p>
      </div>
      
      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-muted-foreground text-sm">No holdings yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                label={({ percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""}
                labelLine={true}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatINR(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span className="text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
