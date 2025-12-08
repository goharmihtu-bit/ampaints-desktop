import { startTransition } from "react";
import { LayoutDashboard, Package, ShoppingCart, Receipt, CreditCard, TrendingUp, Settings, BarChart3, RotateCcw, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useNavigationRefresh } from "@/hooks/use-navigation-refresh";
import { prefetchPageData } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import type { Settings as UISettings } from "@shared/schema";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Stock",
    url: "/stock",
    icon: Package,
  },
  {
    title: "POS",
    url: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "Sales",
    url: "/sales",
    icon: Receipt,
  },
  {
    title: "Unpaid",
    url: "/unpaid-bills",
    icon: CreditCard,
  },
  {
    title: "Returns",
    url: "/returns",
    icon: RotateCcw,
  },
];

const analyticsItems = [
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Audit",
    url: "/audit",
    icon: ShieldCheck,
  },
];

const settingsItems = [
  {
    title: "Rates",
    url: "/rates",
    icon: TrendingUp,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { triggerRefresh } = useNavigationRefresh();

  const { data: settings } = useQuery<UISettings>({
    queryKey: ["/api/settings"],
  });

  const storeName = settings?.storeName ?? "PaintPulse";
  const storeInitial = storeName.charAt(0).toUpperCase();

  const handleNavClick = (url: string, e: React.MouseEvent) => {
    if (location === url) {
      e.preventDefault();
      startTransition(() => {
        triggerRefresh();
      });
    }
  };

  const handleMouseEnter = (url: string) => {
    prefetchPageData(url);
  };

  const renderMenuItem = (item: { title: string; url: string; icon: any }) => {
    const isActive = location === item.url;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          asChild 
          data-active={isActive}
          className={`
            relative group transition-all duration-200
            ${isActive 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }
          `}
        >
          <Link 
            href={item.url} 
            data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={(e) => handleNavClick(item.url, e)}
            onMouseEnter={() => handleMouseEnter(item.url)}
          >
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
              }
            `}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-sm">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <SidebarHeader className="px-4 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-lg font-bold text-white">{storeInitial}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">{storeName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-500">Paint Store POS</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 scrollbar-hide">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainMenuItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {analyticsItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <div className="text-[10px] text-slate-400 dark:text-slate-600 text-center">
          v5.1.7
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
