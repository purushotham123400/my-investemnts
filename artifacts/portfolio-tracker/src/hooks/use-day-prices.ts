import { useQuery } from "@tanstack/react-query";

export function useDayPrices() {
  return useQuery<Record<string, { price: number; date: string }>>({
    queryKey: ["day-prices"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/day-prices`);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60,
  });
}
