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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      gcTime: 1000 * 60 * 30,
      retry: false,
      refetchOnMount: "always",
      networkMode: "offlineFirst",
      structuralSharing: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export function prefetchPageData(page: string) {
  const pageEndpoints: Record<string, string[]> = {
    "/": ["/api/dashboard-stats", "/api/settings"],
    "/stock": ["/api/products", "/api/variants", "/api/colors", "/api/stock-in/history", "/api/stock-out/history"],
    "/pos": ["/api/colors", "/api/settings", "/api/customers/suggestions"],
    "/sales": ["/api/sales", "/api/returns"],
    "/unpaid-bills": ["/api/sales", "/api/customers/suggestions"],
    "/reports": ["/api/sales", "/api/returns", "/api/payment-history"],
    "/returns": ["/api/returns", "/api/sales"],
    "/rates": ["/api/products", "/api/variants", "/api/colors"],
    "/audit": ["/api/settings"],
    "/settings": ["/api/settings"],
  };

  const endpoints = pageEndpoints[page] || [];
  
  endpoints.forEach((endpoint) => {
    const cached = queryClient.getQueryData([endpoint]);
    if (!cached) {
      queryClient.prefetchQuery({
        queryKey: [endpoint],
        staleTime: 60000,
      });
    }
  });
}
