// use-navigation-refresh.ts
import { createContext, useContext } from "react";

interface NavigationRefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

export const NavigationRefreshContext = createContext<NavigationRefreshContextType>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export function useNavigationRefresh() {
  return useContext(NavigationRefreshContext);
}