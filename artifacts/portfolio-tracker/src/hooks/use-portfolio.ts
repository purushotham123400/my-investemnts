import { useMemo } from "react";
import {
  useGetHoldings,
  useGetHoldingPrices,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
  useRecordPortfolioSnapshot,
  getGetHoldingsQueryKey,
  getGetHoldingPricesQueryKey,
  getGetPortfolioHistoryQueryKey,
  getHoldings,
  getHoldingPrices
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDayPrices } from "@/hooks/use-day-prices";

export function usePortfolio() {
  const holdingsQuery = useGetHoldings();
  const pricesQuery = useGetHoldingPrices({
    query: { refetchInterval: 1000 * 60 * 15 } // every 15 min
  });
  const { data: dayPricesMap = {} } = useDayPrices();

  const rawHoldings = holdingsQuery.data || [];
  const rawPrices = pricesQuery.data || [];

  const holdings = useMemo(() => {
    return rawHoldings.map(h => {
      const priceData = rawPrices.find(p => p.symbol === h.symbol) || { price: h.avgBuyPrice, change: 0, changePercent: 0 };
      const currentPrice = priceData.price;
      const totalInvested = h.quantity * h.avgBuyPrice;
      const currentValue = h.quantity * currentPrice;
      const profitLoss = currentValue - totalInvested;
      const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

      // Today's P/L: (current price - yesterday close price) * quantity
      const dayPriceEntry = dayPricesMap[h.symbol.toUpperCase()];
      const dayOpenPrice = dayPriceEntry?.price ?? null;
      const todayPL = dayOpenPrice !== null ? (currentPrice - dayOpenPrice) * h.quantity : null;
      const todayPLPercent = dayOpenPrice !== null && dayOpenPrice > 0 ? ((currentPrice - dayOpenPrice) / dayOpenPrice) * 100 : null;

      return {
        ...h,
        currentPrice,
        totalInvested,
        currentValue,
        profitLoss,
        profitLossPercent,
        change: priceData.change,
        changePercent: priceData.changePercent,
        todayPL,
        todayPLPercent,
      };
    });
  }, [rawHoldings, rawPrices, dayPricesMap]);

  const totals = useMemo(() => {
    let totalInvested = 0;
    let currentValue = 0;
    let todayPLSum = 0;
    let hasTodayPL = false;

    holdings.forEach(h => {
      totalInvested += h.totalInvested;
      currentValue += h.currentValue;
      if (h.todayPL !== null) {
        todayPLSum += h.todayPL;
        hasTodayPL = true;
      }
    });

    const profitLoss = currentValue - totalInvested;
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
    const todayPLTotal = hasTodayPL ? todayPLSum : null;
    const prevTotalValue = hasTodayPL ? (currentValue - todayPLSum) : currentValue;
    const todayPLPercent = hasTodayPL && prevTotalValue > 0 ? (todayPLSum / prevTotalValue) * 100 : null;

    return {
      totalInvested,
      currentValue,
      profitLoss,
      profitLossPercent,
      holdingCount: holdings.length,
      todayPLTotal,
      todayPLPercent,
    };
  }, [holdings]);

  return {
    holdings,
    totals,
    isLoading: holdingsQuery.isLoading || pricesQuery.isLoading,
    isError: holdingsQuery.isError || pricesQuery.isError,
  };
}

export function usePortfolioMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const recordSnapshot = useRecordPortfolioSnapshot();

  const captureSnapshot = async () => {
    try {
      const [freshHoldings, freshPrices] = await Promise.all([
        getHoldings(),
        getHoldingPrices()
      ]);

      let totalInv = 0;
      let currVal = 0;

      freshHoldings.forEach(h => {
        const p = freshPrices.find(x => x.symbol === h.symbol)?.price ?? h.avgBuyPrice;
        totalInv += (h.quantity * h.avgBuyPrice);
        currVal += (h.quantity * p);
      });

      await recordSnapshot.mutateAsync({
        data: {
          totalInvested: totalInv,
          totalValue: currVal,
          profitLoss: currVal - totalInv
        }
      });

      await queryClient.invalidateQueries({ queryKey: getGetPortfolioHistoryQueryKey() });
    } catch (error) {
      console.error("Failed to capture automatic snapshot", error);
    }
  };

  const handleSuccess = async (message: string) => {
    toast({ title: "Success", description: message });
    await queryClient.invalidateQueries({ queryKey: getGetHoldingsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetHoldingPricesQueryKey() });
    await captureSnapshot();
  };

  const handleError = (error: any) => {
    toast({
      title: "Error",
      description: error?.data?.error || error.message || "An unexpected error occurred",
      variant: "destructive"
    });
  };

  const createHolding = useCreateHolding({
    mutation: {
      onSuccess: () => handleSuccess("Holding added successfully."),
      onError: handleError
    }
  });

  const updateHolding = useUpdateHolding({
    mutation: {
      onSuccess: () => handleSuccess("Holding updated successfully."),
      onError: handleError
    }
  });

  const deleteHolding = useDeleteHolding({
    mutation: {
      onSuccess: () => handleSuccess("Holding moved to bin."),
      onError: handleError
    }
  });

  const updateNote = useUpdateHolding({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetHoldingsQueryKey() });
      },
      onError: handleError
    }
  });

  return { createHolding, updateHolding, deleteHolding, updateNote };
}
