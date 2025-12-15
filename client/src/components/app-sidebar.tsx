import { startTransition, useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Receipt, 
  CreditCard, 
  Settings, 
  BarChart3, 
  RotateCcw, 
  ShieldCheck, 
  ChevronRight,
  ArrowUpCircle, 
  History,
  Sparkles
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useNavigationRefresh } from "@/hooks/use-navigation-refresh";
import { prefetchPageData } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Settings as UISettings } from "@shared/schema";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  badge?: string;
  subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { 
    title: "Stock", 
    url: "/stock", 
    icon: Package,
    subItems: [
      { title: "Stock In", url: "/stock/in", icon: ArrowUpCircle },
      { title: "History", url: "/stock/history", icon: History },
    ],
  },
  { title: "POS", url: "/pos", icon: ShoppingCart },
  { title: "Sales", url: "/sales", icon: Receipt },
  { title: "Unpaid", url: "/unpaid-bills", icon: CreditCard },
  { 
    title: "Returns", 
    url: "/returns", 
    icon: RotateCcw,
    subItems: [
      { title: "History", url: "/returns/history", icon: History },
    ],
  },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Admin", url: "/admin", icon: ShieldCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { triggerRefresh } = useNavigationRefresh();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem('admin_unlocked') === '1' } catch { return false }
  })
  const [showAdminPinDialog, setShowAdminPinDialog] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState(["", "", "", ""])
  const [adminPinError, setAdminPinError] = useState("")
  const [isVerifyingAdminPin, setIsVerifyingAdminPin] = useState(false)

  const { data: settings } = useQuery<UISettings>({
    queryKey: ["/api/settings"],
  });

  const storeName = settings?.storeName ?? "PaintPulse";
  const storeInitial = storeName.charAt(0).toUpperCase();

  const handleNavClick = (url: string, e: React.MouseEvent) => {
    if (url === '/admin') {
      if (!isAdminUnlocked) {
        e.preventDefault()
        setShowAdminPinDialog(true)
        return
      }
    }
    // Always trigger a fresh page reload on every sidebar click
    e.preventDefault();
    startTransition(() => {
      triggerRefresh();
      // Navigate to the URL after triggering refresh
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  const handleMouseEnter = (url: string) => {
    prefetchPageData(url);
  };

  const handleAdminPinInput = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...adminPinInput]
    newPin[index] = value
    setAdminPinInput(newPin)
    setAdminPinError("")
    if (value && index < 3) {
      const next = document.querySelector(`[data-testid=\"input-admin-pin-${index + 1}\"]`) as HTMLInputElement
      next?.focus()
    }
    if (newPin.every(d => d !== "") && index === 3) {
      verifyAdminPin(newPin.join(''))
    }
  }

  const verifyAdminPin = async (pin: string) => {
    setIsVerifyingAdminPin(true)
    try {
      const res = await fetch('/api/license/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ masterPin: pin }) })
      if (!res.ok) throw new Error('Invalid PIN')
      setIsAdminUnlocked(true)
      try { sessionStorage.setItem('admin_unlocked', '1') } catch {}
      setShowAdminPinDialog(false)
      setAdminPinInput(["", "", "", ""])
      // navigate to admin
      const a = document.createElement('a')
      a.href = '/admin'
      a.click()
    } catch (err: any) {
      setAdminPinError('Invalid PIN. Please try again.')
      setAdminPinInput(["", "", "", ""])
      const first = document.querySelector('[data-testid="input-admin-pin-0"]') as HTMLInputElement
      first?.focus()
    } finally {
      setIsVerifyingAdminPin(false)
    }
  }

  const isChildActive = (item: MenuItem): boolean => {
    if (item.subItems) {
      return item.subItems.some(sub => location === sub.url);
    }
    return false;
  };

  useEffect(() => {
    menuItems.forEach(item => {
      if (item.subItems) {
        const shouldExpand = location === item.url || isChildActive(item);
        if (shouldExpand && !openMenus[item.title]) {
          setOpenMenus(prev => ({ ...prev, [item.title]: true }));
        }
      }
    });
  }, [location]);

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const isActive = location === item.url;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isParentActive = isActive || isChildActive(item);
    const isOpen = openMenus[item.title] ?? false;

    if (hasSubItems) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className={`
                  group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isParentActive 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }
                `}
                data-testid={`button-${item.title.toLowerCase()}`}
              >
                <div className={`
                  flex items-center justify-center w-9 h-9 rounded-lg transition-all
                  ${isParentActive 
                    ? 'bg-white/20' 
                    : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  }
                `}>
                  <item.icon className={`h-[18px] w-[18px] ${isParentActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${isParentActive ? 'text-white/70' : 'text-slate-400'}`} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <SidebarMenuSub className="ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <Link 
                      href={item.url}
                      onClick={(e) => handleNavClick(item.url, e)}
                      onMouseEnter={() => handleMouseEnter(item.url)}
                      data-testid={`link-${item.title.toLowerCase()}-manage`}
                    >
                      <Package className="h-4 w-4" />
                      <span>Manage</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {item.subItems?.map(subItem => {
                  const isSubActive = location === subItem.url;
                  return (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        asChild
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                          ${isSubActive 
                            ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800/50'
                          }
                        `}
                      >
                        <Link 
                          href={subItem.url}
                          onClick={(e) => handleNavClick(subItem.url, e)}
                          onMouseEnter={() => handleMouseEnter(subItem.url)}
                          data-testid={`link-${subItem.title.toLowerCase()}`}
                        >
                          <subItem.icon className="h-4 w-4" />
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <Link
            href={item.url}
            onClick={(e) => handleNavClick(item.url, e)}
            onMouseEnter={() => handleMouseEnter(item.url)}
            data-testid={`link-${item.title.toLowerCase()}`}
            className={`
              group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }
            `}
          >
            <div className={`
              flex items-center justify-center w-9 h-9 rounded-lg transition-all
              ${isActive 
                ? 'bg-white/20' 
                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
              }
            `}>
              <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            </div>
            <span className="text-sm font-medium">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Premium Header */}
      <SidebarHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-lg font-bold text-white">{storeInitial}</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <Sparkles className="h-2 w-2 text-white" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{storeName}</span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Paint Store POS</span>
          </div>
        </div>
      </SidebarHeader>
      
      {/* Menu Content */}
      <SidebarContent className="p-3">
        {/* Admin PIN dialog */}
        <div>
          {/* Simple modal dialog built inline to avoid extra exports */}
          {showAdminPinDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white dark:bg-slate-900 p-6 rounded shadow-lg w-[420px]">
                <h3 className="text-lg font-semibold">Enter Admin PIN</h3>
                <p className="text-sm text-muted-foreground mt-1">Enter the 4-digit master PIN to access Admin tools.</p>
                <div className="mt-4 flex gap-2">
                  {adminPinInput.map((v, i) => (
                    <input key={i} data-testid={`input-admin-pin-${i}`} value={v} onChange={(e) => handleAdminPinInput(i, e.target.value)} className="w-12 h-12 text-center text-xl rounded border" type="password" maxLength={1} />
                  ))}
                </div>
                {adminPinError && <p className="text-sm text-red-600 mt-2">{adminPinError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn" onClick={() => { setShowAdminPinDialog(false); setAdminPinInput(["", "", "", ""]) }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <SidebarMenu className="space-y-1">
          {menuItems.map((item, index) => renderMenuItem(item, index))}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">System Active</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">v5.1.7</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
