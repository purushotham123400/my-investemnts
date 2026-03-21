import { useState } from "react";
import { useAlerts, useAlertsMutations } from "@/hooks/use-alerts";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Bell, BellRing, Trash2, RefreshCw, PlusCircle, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

const alertSchema = z.object({
  symbol: z.string().min(1, "Required").toUpperCase(),
  name: z.string().min(1, "Required"),
  targetPrice: z.coerce.number().positive("Must be positive"),
  direction: z.enum(["above", "below"]),
});

export function AlertsPanel() {
  const { alerts, isLoading } = useAlerts();
  const { createAlert, deleteAlert, resetAlert } = useAlertsMutations();
  const [isAdding, setIsAdding] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof alertSchema>>({
    resolver: zodResolver(alertSchema),
    defaultValues: { direction: "above" },
  });

  const activeCount = alerts.filter(a => a.isActive && !a.isTriggered).length;
  const triggeredCount = alerts.filter(a => a.isTriggered).length;

  const onSubmit = async (data: z.infer<typeof alertSchema>) => {
    await createAlert.mutateAsync({ data });
    setIsAdding(false);
    form.reset();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground z-50 transition-transform hover:scale-105">
          <div className="relative">
            {triggeredCount > 0 ? <BellRing className="w-6 h-6 animate-pulse" /> : <Bell className="w-6 h-6" />}
            {(activeCount > 0 || triggeredCount > 0) && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {activeCount + triggeredCount}
              </span>
            )}
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md border-l-card-border/50 glass-panel bg-background/95 p-0 flex flex-col">
        <div className="p-6 pb-2 border-b border-border/50">
          <SheetHeader>
            <SheetTitle className="text-2xl font-display flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Price Alerts
            </SheetTitle>
            <SheetDescription>Get notified when assets hit your target price.</SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p>No active alerts.</p>
              <p className="text-sm">Create one to get notified of price movements.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className={cn(
                  "p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden",
                  alert.isTriggered ? "bg-green-500/10 border-green-500/30" : "bg-card/50 border-border/50 hover:border-primary/30 transition-colors"
                )}>
                  {alert.isTriggered && (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        {alert.symbol}
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", 
                          alert.direction === 'above' ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-destructive border-destructive/30 bg-destructive/10"
                        )}>
                          {alert.direction === 'above' ? <ArrowUp className="w-3 h-3 mr-1 inline" /> : <ArrowDown className="w-3 h-3 mr-1 inline" />}
                          {alert.direction} {formatINR(alert.targetPrice)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{alert.name}</div>
                    </div>
                    <div>
                      {alert.isTriggered ? (
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-none">Triggered</Badge>
                      ) : alert.isActive ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <div className="text-[10px] text-muted-foreground/60">
                      Added {new Date(alert.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      {alert.isTriggered && (
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-background/50" onClick={() => resetAlert.mutate({ id: alert.id, data: { isActive: true, isTriggered: false } })}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Reset
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteAlert.mutate({ id: alert.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-border/50 bg-card/30">
          {isAdding ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 bg-background/80 p-4 rounded-xl border border-border shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">New Alert</h4>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Symbol</Label>
                  <Input {...form.register("symbol")} placeholder="BTC" className="h-8 text-sm bg-background/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Price (₹)</Label>
                  <Input type="number" step="any" {...form.register("targetPrice")} placeholder="50000" className="h-8 text-sm bg-background/50" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Asset Name</Label>
                <Input {...form.register("name")} placeholder="Bitcoin" className="h-8 text-sm bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condition</Label>
                <Select onValueChange={(val) => form.setValue("direction", val as any)} defaultValue={form.getValues("direction")}>
                  <SelectTrigger className="h-8 text-sm bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Goes Above (↑)</SelectItem>
                    <SelectItem value="below">Drops Below (↓)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full h-8 mt-2" disabled={form.formState.isSubmitting}>
                Create Alert
              </Button>
            </form>
          ) : (
            <Button className="w-full shadow-md" variant="outline" onClick={() => setIsAdding(true)}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add New Alert
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
