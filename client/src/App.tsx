import { useState, useEffect, useCallback, Suspense, lazy, startTransition } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DateFormatProvider } from "@/hooks/use-date-format";
import { NavigationRefreshContext } from "@/hooks/use-navigation-refresh";
import { PageSkeleton } from "@/components/page-skeleton";
import { LicenseGuard } from "@/components/license-guard";
import ActivationScreen from "@/components/activation-screen";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const StockManagement = lazy(() => import("@/pages/stock-management"));
const POSSales = lazy(() => import("@/pages/pos-sales"));
const Sales = lazy(() => import("@/pages/sales"));
const UnpaidBills = lazy(() => import("@/pages/unpaid-bills"));
const CustomerStatement = lazy(() => import("@/pages/customer-statement"));
const Reports = lazy(() => import("@/pages/reports"));
const RateManagement = lazy(() => import("@/pages/rate-management"));
const BillPrint = lazy(() => import("@/pages/bill-print"));
const Returns = lazy(() => import("@/pages/returns"));
const Audit = lazy(() => import("@/pages/audit"));
const Settings = lazy(() => import("@/pages/settings"));

function Router() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/stock" component={StockManagement} />
        <Route path="/pos" component={POSSales} />
        <Route path="/sales" component={Sales} />
        <Route path="/unpaid-bills" component={UnpaidBills} />
        <Route path="/customer/:phone" component={CustomerStatement} />
        <Route path="/reports" component={Reports} />
        <Route path="/returns" component={Returns} />
        <Route path="/audit" component={Audit} />
        <Route path="/rates" component={RateManagement} />
        <Route path="/settings" component={Settings} />
        <Route path="/bill/:id" component={BillPrint} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [isCheckingActivation, setIsCheckingActivation] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    startTransition(() => {
      setRefreshKey(prev => prev + 1);
    });
  }, []);

  useEffect(() => {
    checkActivationStatus();
  }, []);

  async function checkActivationStatus() {
    try {
      if (window.electron?.getActivationStatus) {
        const status = await window.electron.getActivationStatus();
        setIsActivated(status);
      } else {
        const status = localStorage.getItem("paintpulse_activated") === "true";
        setIsActivated(status);
      }
    } catch (error) {
      console.error("Error checking activation:", error);
      setIsActivated(false);
    } finally {
      setIsCheckingActivation(false);
    }
  }

  const handleActivated = () => {
    setIsActivated(true);
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isCheckingActivation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ActivationScreen onActivated={handleActivated} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LicenseGuard>
          <DateFormatProvider>
            <NavigationRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
              <SidebarProvider style={style as React.CSSProperties}>
                <div className="flex h-screen w-full">
                  <AppSidebar />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <header className="flex items-center justify-between h-16 px-4 border-b border-border">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                    </header>
                    <main key={refreshKey} className="flex-1 overflow-auto">
                      <Router />
                    </main>
                  </div>
                </div>
              </SidebarProvider>
            </NavigationRefreshContext.Provider>
          </DateFormatProvider>
        </LicenseGuard>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
