import { useState, useEffect } from "react";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { usePortfolioMutations } from "@/hooks/use-portfolio";
import { useAlertsMutations } from "@/hooks/use-alerts";
import { Plus, Minus, Trash2, Coins, TrendingUp, TrendingDown, Bell, BellPlus } from "lucide-react";
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
      data: {
        symbol: holding.symbol,
        name: holding.name,
        targetPrice: data.targetPrice,
        direction: data.direction
      }
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
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Goes Above (↑)</SelectItem>
                <SelectItem value="below">Drops Below (↓)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
              Set Alert
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
      {/* Desktop Table View */}
      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden border border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-card-border/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-card-border">
                <th className="p-4 rounded-tl-2xl">Asset</th>
                <th className="p-4">Current Price / Qty</th>
                <th className="p-4 text-right">Avg Buy Price</th>
                <th className="p-4 text-right">Invested</th>
                <th className="p-4 text-right">Current Val</th>
                <th className="p-4 text-right">P&L</th>
                <th className="p-4 w-[20%]">Notes</th>
                <th className="p-4 text-center rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50 text-sm">
              {holdings.map((h) => {
                const isProfit = h.profitLoss >= 0;
                return (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center space-x-2">
                            <span>{h.symbol}</span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-1.5 py-0 border-none bg-opacity-20",
                              h.type === 'stock' ? "bg-blue-500 text-blue-400" : "bg-orange-500 text-orange-400"
                            )}>
                              {h.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{h.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{formatINR(h.currentPrice)}</div>
                      <div className="text-xs text-muted-foreground">{h.quantity} shares</div>
                    </td>
                    <td className="p-4 text-right font-medium">{formatINR(h.avgBuyPrice)}</td>
                    <td className="p-4 text-right">{formatINR(h.totalInvested)}</td>
                    <td className="p-4 text-right">
                      <div className="font-medium">{formatINR(h.currentValue)}</div>
                      <div className="text-xs text-muted-foreground">@{formatINR(h.currentPrice)}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className={cn("font-bold flex items-center justify-end space-x-1", isProfit ? "text-green-500" : "text-destructive")}>
                        {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{formatINR(h.profitLoss)}</span>
                      </div>
                      <div className={cn("text-xs", isProfit ? "text-green-500/80" : "text-destructive/80")}>
                        {formatPercent(h.profitLossPercent)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="bg-black/20 rounded p-1">
                        <NoteInput holding={h} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" title="Alert" onClick={() => setAlertHolding(h)}>
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-400/10" title="Buy More" onClick={() => setTradeState({ holding: h, mode: 'add' })}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10" title="Sell" onClick={() => setTradeState({ holding: h, mode: 'reduce' })}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete Holding" onClick={() => setDeleteId(h.id)}>
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {holdings.map((h) => {
          const isProfit = h.profitLoss >= 0;
          return (
            <div key={h.id} className="glass-panel p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-lg flex items-center space-x-2">
                    <span>{h.symbol}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0 border-none bg-opacity-20",
                      h.type === 'stock' ? "bg-blue-500 text-blue-400" : "bg-orange-500 text-orange-400"
                    )}>
                      {h.type}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{h.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatINR(h.currentPrice)}</div>
                  <div className="text-sm text-muted-foreground">{h.quantity} shares</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-3 rounded-lg">
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider mb-0.5">Invested</div>
                  <div>{formatINR(h.totalInvested)} <div className="text-[10px] text-muted-foreground">@{formatINR(h.avgBuyPrice)}</div></div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider mb-0.5">Current Val</div>
                  <div className="font-medium text-base">{formatINR(h.currentValue)}</div>
                  <div className="text-[10px] text-muted-foreground">@{formatINR(h.currentPrice)}</div>
                </div>
                <div className="col-span-2 pt-2 mt-1 border-t border-border/50 flex justify-between items-center">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider">P&L</div>
                  <div className="text-right">
                    <div className={cn("font-bold flex items-center justify-end space-x-1", isProfit ? "text-green-500" : "text-destructive")}>
                      {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{formatINR(h.profitLoss)}</span>
                      <span className="text-xs opacity-80 ml-1 bg-background/50 px-1.5 py-0.5 rounded">({formatPercent(h.profitLossPercent)})</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 rounded p-2 border border-border/30">
                <NoteInput holding={h} />
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <Button size="sm" variant="ghost" className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 h-9" onClick={() => setAlertHolding(h)}>
                  <Bell className="w-4 h-4 mr-1.5" /> Alert
                </Button>
                <div className="flex space-x-2">
                  <Button size="icon" variant="ghost" className="h-9 w-9 bg-green-400/10 text-green-400 hover:bg-green-400/20" onClick={() => setTradeState({ holding: h, mode: 'add' })}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20" onClick={() => setTradeState({ holding: h, mode: 'reduce' })}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => setDeleteId(h.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
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
            <AlertDialogTitle>Delete Holding</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this holding? This action cannot be undone.
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
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
