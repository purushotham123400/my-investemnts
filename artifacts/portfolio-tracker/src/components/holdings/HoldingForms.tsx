import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePortfolioMutations } from "@/hooks/use-portfolio";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Loader2, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Schema for adding brand new holding
const createSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").toUpperCase(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["stock", "crypto"]),
  quantity: z.coerce.number().positive("Must be positive"),
  buyPrice: z.coerce.number().positive("Must be positive"),
  note: z.string().optional()
});

export function AddHoldingDialog() {
  const [open, setOpen] = useState(false);
  const { createHolding } = usePortfolioMutations();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: "stock" }
  });

  const onSubmit = async (data: z.infer<typeof createSchema>) => {
    await createHolding.mutateAsync({ data });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) form.reset(); }}>
      <DialogTrigger asChild>
        <Button className="font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass-panel border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">New Investment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input placeholder="RELIANCE" {...form.register("symbol")} className="bg-background/50" />
              {form.formState.errors.symbol && <p className="text-xs text-destructive">{form.formState.errors.symbol.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select onValueChange={(val) => form.setValue("type", val as any)} defaultValue={form.getValues("type")}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Company / Asset Name</Label>
            <Input placeholder="Reliance Industries" {...form.register("name")} className="bg-background/50" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="any" placeholder="10" {...form.register("quantity")} className="bg-background/50" />
              {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Buy Price (₹)</Label>
              <Input type="number" step="any" placeholder="2500" {...form.register("buyPrice")} className="bg-background/50" />
              {form.formState.errors.buyPrice && <p className="text-xs text-destructive">{form.formState.errors.buyPrice.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Personal Note (Optional)</Label>
            <Textarea placeholder="Why did you buy this?" {...form.register("note")} className="resize-none bg-background/50" />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
              {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Investment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Dialog for Adding or Reducing shares of existing holding
interface TradeSharesDialogProps {
  holding: any;
  mode: "add" | "reduce";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tradeSchema = z.object({
  quantity: z.coerce.number().positive("Must be positive"),
  buyPrice: z.coerce.number().positive("Must be positive").optional(), // only required for add
});

export function TradeSharesDialog({ holding, mode, open, onOpenChange }: TradeSharesDialogProps) {
  const { updateHolding } = usePortfolioMutations();
  
  const form = useForm<z.infer<typeof tradeSchema>>({
    resolver: zodResolver(tradeSchema),
    defaultValues: { quantity: undefined, buyPrice: mode === 'add' ? holding.currentPrice : undefined }
  });

  const onSubmit = async (data: z.infer<typeof tradeSchema>) => {
    // Validate buyPrice manually if mode is add
    if (mode === 'add' && !data.buyPrice) {
      form.setError("buyPrice", { message: "Price required when adding" });
      return;
    }
    
    await updateHolding.mutateAsync({
      id: holding.id,
      data: {
        action: mode,
        quantity: data.quantity,
        buyPrice: mode === 'add' ? data.buyPrice : undefined
      }
    });
    onOpenChange(false);
    form.reset();
  };

  const isAdd = mode === 'add';

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if(!val) form.reset(); }}>
      <DialogContent className="sm:max-w-[400px] glass-panel border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center">
            {isAdd ? <Plus className="w-5 h-5 mr-2 text-green-500" /> : <Minus className="w-5 h-5 mr-2 text-destructive" />}
            {isAdd ? `Buy More ${holding.symbol}` : `Sell ${holding.symbol}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Quantity to {isAdd ? 'Buy' : 'Sell'}</Label>
            <Input type="number" step="any" placeholder="Shares" {...form.register("quantity")} className="bg-background/50" />
            {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
          </div>

          {isAdd && (
            <div className="space-y-2">
              <Label>Buy Price (₹) per share</Label>
              <Input type="number" step="any" placeholder="Current Price" {...form.register("buyPrice")} className="bg-background/50" />
              {form.formState.errors.buyPrice && <p className="text-xs text-destructive">{form.formState.errors.buyPrice.message}</p>}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant={isAdd ? "default" : "destructive"} disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm {isAdd ? 'Buy' : 'Sell'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
