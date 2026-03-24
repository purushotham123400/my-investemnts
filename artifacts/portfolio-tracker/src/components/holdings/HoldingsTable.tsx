import { useState, useEffect } from "react";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { usePortfolioMutations } from "@/hooks/use-portfolio";
import { useAlertsMutations } from "@/hooks/use-alerts";
import { Plus, Minus, Trash2, Coins, TrendingUp, TrendingDown, Bell, BellPlus, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeSharesDialog } from "./HoldingForms";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

function NoteInput({ holding }: { holding: any }) {
  const [note, setNote] = useState(holding.note || '');
  const { updateNote } = usePortfolioMutations();

  useEffect(() => { setNote(holding.note || ''); }, [holding.note]);

  const handleBlur = () => {
    if (note !== (holding.note || '')) {
      updateNote.mutate({ id: holding.id, data: { action: 'update_note', note } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <input
      value={note}
      onChange={e => setNote(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors w-full text-sm py-1 min-w-[150px] placeholder:text-muted-foreground/50"
      placeholder="Add note..."
    />
  );
}

const alertSchema = z.object({
  targetPrice: z.coerce.number().positive("Must be positive"),
  direction: z.enum(["above", "below"]),
});

function QuickAlertDialog({ holding, open, onOpenChange }: { holding: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { createAlert } = useAlertsMutations();
  const form = useForm<z.infer<typeof alertSchema>>({
    resolver: zodResolver(alertSchema),
    defaultValues: { direction: "above", targetPrice: holding?.currentPrice }
  });

  useEffect(() => {
    if (open && holding) {
      form.reset({ direction: "above", targetPrice: holding.currentPrice });
    }
  }, [open, holding, form]);

  const onSubmit = async (data: z.infer<typeof alertSchema>) => {
    await createAlert.mutateAsync({
      data: { symbol: holding.symbol, name: holding.name, targetPrice: data.targetPrice, direction: data.direction }
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[400px] glass-panel border-none shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center">
            <BellPlus className="w-5 h-5 mr-2 text-primary" />
            Alert for {holding?.symbol}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Target Price (₹)</Label>
            <Input type="number" step="any" {...form.register("targetPrice")} className="bg-background/50" />
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select onValueChange={(val) => form.setValue("direction", val as any)} defaultValue={form.getValues("direction")}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Goes Above (↑)</SelectItem>
                <SelectItem value="below">Drops Below (↓)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">Set Alert</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MobileTab = "overview" | "pl" | "today";

function MobileHoldingCard({ h, onTrade, onDelete, onAlert }: { h: any; onTrade: (h: any, mode: 'add' | 'reduce') => void; onDelete: (id: number) => void; onAlert: (h: any) => void }) {
  const [tab, setTab] = useState<MobileTab>("overview");
  const isProfit = h.profitLoss >= 0;
  const isTodayProfit = (h.todayPL ?? 0) >= 0;
  const hasTodayPL = h.todayPL !== null;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-card-border">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-lg">{h.symbol}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-none",
              h.type === 'stock' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400")}>
              {h.type}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{h.name}</div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onAlert(h)}><Bell className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onTrade(h, 'add')}><Plus className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-400 hover:bg-amber-500/10" onClick={() => onTrade(h, 'reduce')}><Minus className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(h.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 mb-3">
        {(["overview", "pl", "today"] as MobileTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 text-[11px] py-1 rounded-md font-medium transition-all",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-card-border/30")}>
            {t === "overview" ? "Overview" : t === "pl" ? "P&L" : "Today"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Current Price</div>
            <div className="font-bold">{formatINR(h.currentPrice)}</div>
            <div className={cn("text-[10px]", h.changePercent >= 0 ? "text-green-400" : "text-destructive")}>
              {h.changePercent >= 0 ? "+" : ""}{h.changePercent?.toFixed(2)}%
            </div>
          </div>
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Quantity</div>
            <div className="font-bold">{h.quantity}</div>
            <div className="text-[10px] text-muted-foreground">shares</div>
          </div>
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Avg Buy</div>
            <div className="font-bold">{formatINR(h.avgBuyPrice)}</div>
          </div>
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Current Value</div>
            <div className="font-bold">{formatINR(h.currentValue)}</div>
          </div>
        </div>
      )}

      {tab === "pl" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className={cn("rounded-lg p-2 col-span-2", isProfit ? "bg-emerald-500/10" : "bg-red-500/10")}>
            <div className="text-[10px] text-muted-foreground mb-0.5">Total P&L</div>
            <div className={cn("font-bold text-lg flex items-center gap-1", isProfit ? "text-emerald-400" : "text-destructive")}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isProfit ? "+" : ""}{formatINR(h.profitLoss)}
            </div>
            <div className={cn("text-xs font-medium", isProfit ? "text-emerald-400/80" : "text-destructive/80")}>
              {formatPercent(h.profitLossPercent)}
            </div>
          </div>
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Invested</div>
            <div className="font-bold">{formatINR(h.totalInvested)}</div>
          </div>
          <div className="bg-background/30 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Current</div>
            <div className="font-bold">{formatINR(h.currentValue)}</div>
          </div>
        </div>
      )}

      {tab === "today" && (
        <div className="grid grid-cols-1 gap-3 text-sm">
          {hasTodayPL ? (
            <div className={cn("rounded-lg p-3", isTodayProfit ? "bg-emerald-500/10" : "bg-red-500/10")}>
              <div className="text-[10px] text-muted-foreground mb-1">Today's P&L</div>
              <div className={cn("font-bold text-xl flex items-center gap-1", isTodayProfit ? "text-emerald-400" : "text-destructive")}>
                {isTodayProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isTodayProfit ? "+" : ""}{formatINR(h.todayPL)}
              </div>
              {h.todayPLPercent !== null && (
                <div className={cn("text-xs font-medium mt-0.5", isTodayProfit ? "text-emerald-400/80" : "text-destructive/80")}>
                  {formatPercent(h.todayPLPercent)}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-background/30 rounded-lg p-4 text-center">
              <Flame className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Today's P&L will be available after day-end prices are saved (23:59 IST)</p>
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="mt-3 bg-black/20 rounded p-2">
        <NoteInput holding={h} />
      </div>
    </div>
  );
}

interface HoldingsTableProps {
  holdings: any[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [tradeState, setTradeState] = useState<{ holding: any | null, mode: 'add' | 'reduce' }>({ holding: null, mode: 'add' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [alertHolding, setAlertHolding] = useState<any | null>(null);

  const { deleteHolding } = usePortfolioMutations();

  if (holdings.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center border-dashed">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
          <Coins className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-display mb-2">No investments yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6 text-sm">Your portfolio is empty. Add your first stock or crypto asset to start tracking your wealth.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {holdings.map((h) => (
          <MobileHoldingCard
            key={h.id}
            h={h}
            onTrade={(holding, mode) => setTradeState({ holding, mode })}
            onDelete={(id) => setDeleteId(id)}
            onAlert={(holding) => setAlertHolding(holding)}
          />
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden border border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-card-border/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-card-border">
                <th className="p-4 rounded-tl-2xl">Asset</th>
                <th className="p-4">Current Price / Qty</th>
                <th className="p-4 text-right">Avg Buy Price</th>
                <th className="p-4 text-right">Invested</th>
                <th className="p-4 text-right">Current Val</th>
                <th className="p-4 text-right">Total P&L</th>
                <th className="p-4 text-right">Today's P&L</th>
                <th className="p-4 w-[18%]">Notes</th>
                <th className="p-4 text-center rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50 text-sm">
              {holdings.map((h) => {
                const isProfit = h.profitLoss >= 0;
                const isTodayProfit = (h.todayPL ?? 0) >= 0;
                return (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center space-x-2">
                            <span>{h.symbol}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-none bg-opacity-20",
                              h.type === 'stock' ? "bg-blue-500 text-blue-400" : "bg-orange-500 text-orange-400")}>
                              {h.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{h.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{formatINR(h.currentPrice)}</div>
                      <div className={cn("text-xs", h.changePercent >= 0 ? "text-green-400" : "text-destructive")}>
                        {h.changePercent >= 0 ? "+" : ""}{h.changePercent?.toFixed(2)}% · {h.quantity} shares
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium">{formatINR(h.avgBuyPrice)}</td>
                    <td className="p-4 text-right">{formatINR(h.totalInvested)}</td>
                    <td className="p-4 text-right">
                      <div className="font-medium">{formatINR(h.currentValue)}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className={cn("font-bold flex items-center justify-end space-x-1", isProfit ? "text-green-500" : "text-destructive")}>
                        {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{isProfit ? "+" : ""}{formatINR(h.profitLoss)}</span>
                      </div>
                      <div className={cn("text-xs", isProfit ? "text-green-500/80" : "text-destructive/80")}>{formatPercent(h.profitLossPercent)}</div>
                    </td>
                    <td className="p-4 text-right">
                      {h.todayPL !== null ? (
                        <>
                          <div className={cn("font-bold flex items-center justify-end space-x-1", isTodayProfit ? "text-green-500" : "text-destructive")}>
                            {isTodayProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{isTodayProfit ? "+" : ""}{formatINR(h.todayPL)}</span>
                          </div>
                          {h.todayPLPercent !== null && (
                            <div className={cn("text-xs", isTodayProfit ? "text-green-500/80" : "text-destructive/80")}>{formatPercent(h.todayPLPercent)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">–</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="bg-black/20 rounded p-1"><NoteInput holding={h} /></div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-9 w-9 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => setTradeState({ holding: h, mode: 'add' })}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" onClick={() => setTradeState({ holding: h, mode: 'reduce' })}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-card-border/50" onClick={() => setAlertHolding(h)}>
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => setDeleteId(h.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {tradeState.holding && (
        <TradeSharesDialog
          holding={tradeState.holding}
          mode={tradeState.mode}
          open={!!tradeState.holding}
          onOpenChange={(open) => !open && setTradeState({ holding: null, mode: 'add' })}
        />
      )}

      <QuickAlertDialog
        holding={alertHolding}
        open={!!alertHolding}
        onOpenChange={(open) => !open && setAlertHolding(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md glass-panel border-none shadow-2xl rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Bin?</AlertDialogTitle>
            <AlertDialogDescription>
              This holding will be moved to the Bin. You can restore it from there, or permanently delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="bg-background/50 hover:bg-background border-none w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground w-full sm:w-auto"
              onClick={() => {
                if (deleteId) deleteHolding.mutate({ id: deleteId });
                setDeleteId(null);
              }}
            >
              Move to Bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
