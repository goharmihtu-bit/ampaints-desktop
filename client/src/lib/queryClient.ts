// queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// ✅ MAIN FIX: Disable ALL automatic refetching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // ✅ No refetch on reconnect
      refetchOnMount: false, // ✅ NO automatic refetch when component mounts
      staleTime: Infinity, // ✅ Data never becomes stale
      gcTime: 1000 * 60 * 60 * 24, // ✅ 24 hours cache
      retry: false,
      networkMode: "online", // ✅ Only fetch when online
      structuralSharing: true,
      // ✅ IMPORTANT: Prevent background updates
      enabled: true,
    },
    mutations: {
      retry: false,
      // ✅ No optimistic updates that might trigger refetch
      onSettled: () => {
        // Don't invalidate queries automatically
      },
    },
  },
});

// ✅ COMPLETELY DISABLE prefetching
export function prefetchPageData(page: string) {
  // DO NOTHING - No automatic prefetching
  // Silently ignore prefetch requests to prevent unnecessary reloads
}