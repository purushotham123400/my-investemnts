import { useState, useEffect } from "react";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { usePortfolioMutations } from "@/hooks/use-portfolio";
import { Plus, Minus, Trash2, Coins, TrendingUp, TrendingDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeSharesDialog } from "./HoldingForms";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Inline Editable Note Component
function NoteInput({ holding }: { holding: any }) {
  const [note, setNote] = useState(holding.note || '');
  const { updateNote } = usePortfolioMutations();

  // Sync state if prop changes
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

interface HoldingsTableProps {
  holdings: any[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [tradeState, setTradeState] = useState<{ holding: any | null, mode: 'add' | 'reduce' }>({ holding: null, mode: 'add' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const { deleteHolding } = usePortfolioMutations();

  if (holdings.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center border-dashed">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
          <Coins className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-display mb-2">No investments yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6">Your portfolio is empty. Add your first stock or crypto asset to start tracking your wealth.</p>
        {/* The AddHoldingDialog button resides in the Header usually, so we rely on the user to use it. */}
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-card-border">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-card-border/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-card-border">
              <th className="p-4 rounded-tl-2xl">Asset</th>
              <th className="p-4">Price & Qty</th>
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
                  <td className="p-4 text-right font-medium">{formatINR(h.currentValue)}</td>
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
                    <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {tradeState.holding && (
        <TradeSharesDialog 
          holding={tradeState.holding} 
          mode={tradeState.mode} 
          open={!!tradeState.holding} 
          onOpenChange={(open) => !open && setTradeState({ holding: null, mode: 'add' })}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="glass-panel border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holding</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this holding? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background/50 hover:bg-background border-none">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
    </div>
  );
}
