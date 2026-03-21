import { useEffect } from "react";
import {
  useGetAlerts,
  useCreateAlert,
  useDeleteAlert,
  useUpdateAlert,
  useCheckAlerts,
  getGetAlertsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useAlerts() {
  const query = useGetAlerts();
  return {
    alerts: query.data || [],
    isLoading: query.isLoading,
  };
}

export function useAlertsMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSuccess = async (message: string) => {
    toast({ title: "Success", description: message });
    await queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
  };

  const handleError = (error: any) => {
    toast({
      title: "Error",
      description: error?.data?.error || error.message || "An unexpected error occurred",
      variant: "destructive",
    });
  };

  const createAlert = useCreateAlert({
    mutation: {
      onSuccess: () => handleSuccess("Alert created successfully."),
      onError: handleError,
    },
  });

  const deleteAlert = useDeleteAlert({
    mutation: {
      onSuccess: () => handleSuccess("Alert deleted."),
      onError: handleError,
    },
  });

  const resetAlert = useUpdateAlert({
    mutation: {
      onSuccess: () => handleSuccess("Alert reset successfully."),
      onError: handleError,
    },
  });

  return { createAlert, deleteAlert, resetAlert };
}

export function useAlertChecker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const checkMutation = useCheckAlerts({
    mutation: {
      onSuccess: (triggeredAlerts) => {
        if (triggeredAlerts && triggeredAlerts.length > 0) {
          triggeredAlerts.forEach((alert) => {
            const msg = `🔔 ${alert.symbol} hit ₹${alert.targetPrice}! Target was ₹${alert.targetPrice} (${alert.direction})`;
            toast({
              title: "Price Alert Triggered!",
              description: msg,
              duration: 10000,
            });
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Price Alert!", { body: msg });
            }
          });
          queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
        }
      },
    },
  });

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    // Check immediately on mount, then every hour
    checkMutation.mutate();
    
    const interval = setInterval(() => {
      checkMutation.mutate();
    }, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, []);
}
