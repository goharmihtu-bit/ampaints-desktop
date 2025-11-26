import { LayoutDashboard, Package, ShoppingCart, Receipt, CreditCard, TrendingUp, Settings, BarChart3, RotateCcw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useNavigationRefresh } from "@/hooks/use-navigation-refresh";
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
} from "@/components/ui/sidebar";
import type { Settings as UISettings } from "@shared/schema";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Stock Management",
    url: "/stock",
    icon: Package,
  },
  {
    title: "POS Sales",
    url: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "Sales",
    url: "/sales",
    icon: Receipt,
  },
  {
    title: "Unpaid Bills",
    url: "/unpaid-bills",
    icon: CreditCard,
  },
  {
    title: "Returns",
    url: "/returns",
    icon: RotateCcw,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Rate Management",
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
      triggerRefresh();
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="text-lg font-bold text-primary-foreground">{storeInitial}</span>
          </div>
          <span className="text-lg font-semibold">{storeName}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link 
                        href={item.url} 
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={(e) => handleNavClick(item.url, e)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
