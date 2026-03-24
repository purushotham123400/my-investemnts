import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Trash, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatINR, cn } from "@/lib/utils";
import { getGetHoldingsQueryKey, getGetPortfolioHistoryQueryKey } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function useBin() {
  return useQuery<any[]>({
    queryKey: ["bin"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/bin`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 0,
  });
}

export function BinPanel() {
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: binItems = [], refetch } = useBin();

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE()}/api/bin/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Restored", description: "Holding restored to your portfolio." });
      refetch();
      queryClient.invalidateQueries({ queryKey: getGetHoldingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPortfolioHistoryQueryKey() });
    },
    onError: () => toast({ title: "Error", description: "Failed to restore holding.", variant: "destructive" }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE()}/api/bin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Holding permanently deleted." });
      refetch();
    },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-card-border bg-card hover:bg-card/80">
            <Trash2 className="w-4 h-4" />
            Bin {binItems.length > 0 && <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-0.5">{binItems.length}</span>}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg bg-background border-card-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Trash className="w-5 h-5 text-destructive" /> Deleted Holdings</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
            {binItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Trash2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">Bin is empty</p>
              </div>
            ) : binItems.map((item) => {
              const invested = item.quantity * item.avgBuyPrice;
              return (
                <div key={item.id} className="bg-card border border-card-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-foreground">{item.symbol}</div>
                      <div className="text-xs text-muted-foreground">{item.name}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => restoreMutation.mutate(item.id)} disabled={restoreMutation.isPending}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(item.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><span className="block text-foreground font-medium">{item.quantity}</span>shares</div>
                    <div><span className="block text-foreground font-medium">{formatINR(item.avgBuyPrice)}</span>avg price</div>
                    <div><span className="block text-foreground font-medium">{formatINR(invested)}</span>invested</div>
                  </div>
                  {item.note && <p className="mt-2 text-xs text-muted-foreground border-t border-card-border pt-2">{item.note}</p>}
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    Deleted: {new Date(item.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md glass-panel border-none shadow-2xl rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The holding and all its data will be gone forever.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="bg-background/50 border-none w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
              onClick={() => { if (confirmDeleteId) permanentDeleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}>
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
