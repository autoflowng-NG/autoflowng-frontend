import { QueryClient } from "@tanstack/react-query";

function isRetryable(error: any) {
  if (error?.status >= 400 && error?.status < 500) return false;
  if (error?.status === 401 || error?.status === 403) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60 * 1000,
      gcTime:               10 * 60 * 1000,
      retry:                (failureCount, error) => {
        if (!isRetryable(error)) return false;
        return failureCount < 3;
      },
      retryDelay:           (attempt) => Math.min(1000 * Math.pow(2, attempt), 10_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect:   "always",
    },
    mutations: {
      retry:      (failureCount, error) => {
        if (!isRetryable(error)) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5_000),
    },
  },
});

export const queryKeys = {
  user:          ["user"] as const,
  userStats:     ["user", "stats"] as const,
  analytics:     (range: string) => ["analytics", range] as const,
  analyticsWF:   (days: number) => ["analytics", "workflows", days] as const,
  analyticsAI:   (days: number) => ["analytics", "ai", days] as const,
  workflows:     ["workflows"] as const,
  workflow:      (id: string) => ["workflows", id] as const,
  workflowRuns:  (id: string) => ["workflows", id, "runs"] as const,
  workflowRun:   (id: string, runId: string) => ["workflows", id, "runs", runId] as const,
  automations:   ["automations"] as const,
  automationLogs:(id: string) => ["automations", id, "logs"] as const,
  tasks:         ["automations", "tasks"] as const,
  aiSessions:    ["ai", "sessions"] as const,
  aiHistory:     (session: string) => ["ai", "history", session] as const,
  aiStatus:      ["ai", "status"] as const,
  connections:   ["connections"] as const,
  payments:      ["payments"] as const,
  paymentConfig: ["payments", "config"] as const,
  referrals:     ["referrals"] as const,
  referralStats: ["referrals", "stats"] as const,
  affiliateMe:   ["affiliates", "me"] as const,
  recentRuns:    ["runs", "recent"] as const,
  adminOverview: ["admin", "overview"] as const,
  adminUsers:    (params: any) => ["admin", "users", params] as const,
  adminSystem:   ["admin", "system"] as const,
};

export const invalidate = {
  user:        () => queryClient.invalidateQueries({ queryKey: queryKeys.user }),
  analytics:   () => queryClient.invalidateQueries({ queryKey: ["analytics"] }),
  workflows:   () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  workflow:    (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.workflow(id) }),
  automations: () => queryClient.invalidateQueries({ queryKey: queryKeys.automations }),
  connections: () => queryClient.invalidateQueries({ queryKey: queryKeys.connections }),
  payments:    () => queryClient.invalidateQueries({ queryKey: queryKeys.payments }),
  referrals:   () => queryClient.invalidateQueries({ queryKey: queryKeys.referrals }),
  affiliates:  () => queryClient.invalidateQueries({ queryKey: queryKeys.affiliateMe }),
  all:         () => queryClient.invalidateQueries(),
};
