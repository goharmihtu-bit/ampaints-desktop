import { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package2,
  User,
  Phone,
  Calendar,
  Zap,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ColorWithVariantAndProduct, Sale, Settings } from "@shared/schema";
import { getEffectiveRate } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface CartItem {
  colorId: string;
  color: ColorWithVariantAndProduct;
  quantity: number;
  rate: number;
}

interface CustomerSuggestion {
  customerName: string;
  customerPhone: string;
  lastSaleDate: string;
  totalSpent: number;
  transactionCount: number;
}

interface PendingSale {
  id: string;
  offlineId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  itemsCount: number;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
  syncedSaleId?: string;
}

// Offline storage utilities
class OfflineStorage {
  private dbName = 'paintpulse-pos';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to localStorage');
        resolve(false);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        resolve(false);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create pending sales store
        if (!db.objectStoreNames.contains('pendingSales')) {
          const store = db.createObjectStore('pendingSales', { keyPath: 'offlineId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        
        // Create cart store
        if (!db.objectStoreNames.contains('cart')) {
          db.createObjectStore('cart', { keyPath: 'colorId' });
        }
        
        // Create customer store
        if (!db.objectStoreNames.contains('customer')) {
          db.createObjectStore('customer', { keyPath: 'id' });
        }
      };
    });
  }

  async savePendingSale(sale: any): Promise<string> {
    if (!this.db) {
      // Fallback to localStorage
      const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pendingSales = JSON.parse(localStorage.getItem('pendingSales') || '[]');
      pendingSales.push({ ...sale, offlineId });
      localStorage.setItem('pendingSales', JSON.stringify(pendingSales));
      return offlineId;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSales'], 'readwrite');
      const store = transaction.objectStore('pendingSales');
      const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pendingSale = {
        ...sale,
        offlineId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        attempts: 0
      };

      const request = store.add(pendingSale);

      request.onsuccess = () => resolve(offlineId);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSales(): Promise<PendingSale[]> {
    if (!this.db) {
      const sales = JSON.parse(localStorage.getItem('pendingSales') || '[]');
      return sales;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSales'], 'readonly');
      const store = transaction.objectStore('pendingSales');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingSale(offlineId: string): Promise<void> {
    if (!this.db) {
      const sales = JSON.parse(localStorage.getItem('pendingSales') || '[]');
      const filtered = sales.filter((s: any) => s.offlineId !== offlineId);
      localStorage.setItem('pendingSales', JSON.stringify(filtered));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSales'], 'readwrite');
      const store = transaction.objectStore('pendingSales');
      const request = store.delete(offlineId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveCart(cart: CartItem[]): Promise<void> {
    if (!this.db) {
      localStorage.setItem('pos_cart', JSON.stringify(cart));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cart'], 'readwrite');
      const store = transaction.objectStore('cart');
      
      // Clear existing cart
      store.clear();
      
      // Add all items
      cart.forEach(item => {
        store.add(item);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadCart(): Promise<CartItem[]> {
    if (!this.db) {
      return JSON.parse(localStorage.getItem('pos_cart') || '[]');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cart'], 'readonly');
      const store = transaction.objectStore('cart');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCustomer(customer: { name: string; phone: string }): Promise<void> {
    if (!this.db) {
      localStorage.setItem('pos_customer', JSON.stringify(customer));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['customer'], 'readwrite');
      const store = transaction.objectStore('customer');
      store.put({ id: 'current', ...customer });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadCustomer(): Promise<{ name: string; phone: string } | null> {
    if (!this.db) {
      const customer = localStorage.getItem('pos_customer');
      return customer ? JSON.parse(customer) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['customer'], 'readonly');
      const store = transaction.objectStore('customer');
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
}

export default function POSSales() {
  const { formatDateShort } = useDateFormat();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineStorage, setOfflineStorage] = useState<OfflineStorage | null>(null);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPendingSales, setShowPendingSales] = useState(false);

  // POS state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const productsContainerRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [confirmRate, setConfirmRate] = useState<number | "">("");

  // Initialize offline storage
  useEffect(() => {
    const initOfflineStorage = async () => {
      const storage = new OfflineStorage();
      const success = await storage.init();
      if (success) {
        setOfflineStorage(storage);
        
        // Load saved data
        const savedCart = await storage.loadCart();
        if (savedCart.length > 0) {
          setCart(savedCart);
        }
        
        const savedCustomer = await storage.loadCustomer();
        if (savedCustomer) {
          setCustomerName(savedCustomer.name);
          setCustomerPhone(savedCustomer.phone);
        }
        
        // Load pending sales
        const pending = await storage.getPendingSales();
        setPendingSales(pending);
      }
    };
    
    initOfflineStorage();
    
    // Online/offline event listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save cart and customer to offline storage when they change
  useEffect(() => {
    if (offlineStorage) {
      offlineStorage.saveCart(cart);
    }
  }, [cart, offlineStorage]);

  useEffect(() => {
    if (offlineStorage && customerName && customerPhone) {
      offlineStorage.saveCustomer({ name: customerName, phone: customerPhone });
    }
  }, [customerName, customerPhone, offlineStorage]);

  const { data: colorsRaw = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    refetchOnWindowFocus: true,
    enabled: isOnline, // Only fetch when online
  });

  const colors = useDeferredValue(colorsRaw);

  const { data: customerSuggestions = [] } = useQuery<CustomerSuggestion[]>({
    queryKey: ["/api/customers/suggestions"],
    enabled: isOnline,
  });

  // Check connectivity periodically
  useQuery({
    queryKey: ["/api/pos/connectivity"],
    refetchInterval: 30000, // Check every 30 seconds
    enabled: true,
    onSuccess: () => setIsOnline(true),
    onError: () => setIsOnline(false),
  });

  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;
    const q = searchQuery.toUpperCase().trim();
    
    const results = colors.filter(
      (c) =>
        c.colorCode.toUpperCase().includes(q) ||
        c.colorName.toLowerCase().includes(q.toLowerCase()) ||
        c.variant.product.productName.toLowerCase().includes(q.toLowerCase()) ||
        c.variant.product.company.toLowerCase().includes(q.toLowerCase())
    );
    
    return results.sort((a, b) => {
      const aCodeUpper = a.colorCode.toUpperCase();
      const bCodeUpper = b.colorCode.toUpperCase();
      
      const aExact = aCodeUpper === q ? 0 : aCodeUpper.startsWith(q) ? 1 : 2;
      const bExact = bCodeUpper === q ? 0 : bCodeUpper.startsWith(q) ? 1 : 2;
      
      return aExact - bExact;
    });
  }, [colors, searchQuery]);

  const enableGST = false;
  const subtotal = cart.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax = enableGST ? subtotal * 0.18 : 0;
  const total = subtotal + tax;

  const paidAmount = parseFloat(amountPaid || "0");
  const remainingBalance = total - paidAmount;

  // Sync pending sales when back online
  const syncPendingSales = useCallback(async () => {
    if (!isOnline || !pendingSales.length) return;
    
    setIsSyncing(true);
    try {
      const offlineIds = pendingSales.map(s => s.offlineId);
      
      const res = await apiRequest("POST", "/api/pos/sync-pending", { offlineIds });
      const result = await res.json();
      
      if (result.success) {
        // Remove synced sales from local storage
        for (const item of result.results) {
          if (item.success && offlineStorage) {
            await offlineStorage.deletePendingSale(item.offlineId);
          }
        }
        
        // Update local state
        const updatedPending = await offlineStorage?.getPendingSales() || [];
        setPendingSales(updatedPending);
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${result.results.filter((r: any) => r.success).length} sales`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync pending sales",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingSales, offlineStorage, toast]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingSales.length > 0) {
      syncPendingSales();
    }
  }, [isOnline, pendingSales.length, syncPendingSales]);

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sales", data);
      return res.json();
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      
      toast({ title: "Sale completed successfully" });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setAmountPaid("");
      setLocation(`/bill/${sale.id}`);
    },
    onError: (error: Error) => {
      console.error("Create sale error:", error);
      toast({ title: "Failed to create sale", variant: "destructive" });
    },
  });

  // Offline sale creation
  const createOfflineSale = async (saleData: any): Promise<string> => {
    if (!offlineStorage) {
      throw new Error("Offline storage not available");
    }
    
    const offlineId = await offlineStorage.savePendingSale({
      ...saleData,
      customerName,
      customerPhone,
      totalAmount: total,
      amountPaid: paidAmount,
      paymentStatus: paidAmount >= total ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
      items: cart.map((it) => ({
        colorId: it.colorId,
        color: {
          id: it.color.id,
          colorCode: it.color.colorCode,
          colorName: it.color.colorName,
          variant: {
            product: {
              company: it.color.variant.product.company,
              productName: it.color.variant.product.productName,
            },
            packingSize: it.color.variant.packingSize,
          },
        },
        quantity: it.quantity,
        rate: it.rate,
        subtotal: it.quantity * it.rate,
      })),
    });
    
    const pending = await offlineStorage.getPendingSales();
    setPendingSales(pending);
    
    return offlineId;
  };

  const handleCompleteSale = async (isPaid: boolean) => {
    if (!customerName || !customerPhone) {
      toast({
        title: "Please enter customer name and phone",
        variant: "destructive",
      });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }

    const paid = isPaid ? total : paidAmount;
    const paymentStatus = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    const saleData = {
      customerName,
      customerPhone,
      totalAmount: total,
      amountPaid: paid,
      paymentStatus,
      items: cart.map((it) => ({
        colorId: it.colorId,
        quantity: it.quantity,
        rate: it.rate,
        subtotal: it.quantity * it.rate,
      })),
    };

    if (!isOnline) {
      // Store offline
      try {
        const offlineId = await createOfflineSale(saleData);
        
        toast({
          title: "Sale Saved Offline",
          description: `Sale stored locally (ID: ${offlineId.substring(0, 8)}). Will sync when back online.`,
          variant: "default",
          duration: 5000,
        });
        
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setAmountPaid("");
        
        // Show pending sales dialog
        setShowPendingSales(true);
      } catch (error) {
        toast({
          title: "Failed to save offline sale",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } else {
      // Process online
      createSaleMutation.mutate(saleData);
    }
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers/suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
    toast({ title: "Data refreshed" });
  };

  const addToCart = (color: ColorWithVariantAndProduct, qty = 1, rate?: number) => {
    const effectiveRate = rate ?? parseFloat(getEffectiveRate(color));
    
    if (qty > color.stockQuantity) {
      toast({ 
        title: "⚠️ Low Stock Warning", 
        description: `Only ${color.stockQuantity} units available in stock. You can still proceed with the sale.`,
        variant: "default",
        duration: 4000
      });
    }

    if (color.stockQuantity === 0) {
      toast({ 
        title: "⚠️ Out of Stock", 
        description: `This item is out of stock. You can still proceed with the sale.`,
        variant: "default",
        duration: 4000
      });
    }

    setCart((prev) => {
      const existing = prev.find((p) => p.colorId === color.id);
      if (existing) {
        const newQuantity = existing.quantity + qty;
        if (newQuantity > color.stockQuantity) {
          toast({ 
            title: "⚠️ Low Stock Warning", 
            description: `Only ${color.stockQuantity} units available in stock. You can still proceed with the sale.`,
            variant: "default",
            duration: 4000
          });
        }
        return prev.map((p) =>
          p.colorId === color.id
            ? { ...p, quantity: newQuantity, rate: effectiveRate }
            : p
        );
      }
      return [
        ...prev,
        { colorId: color.id, color, quantity: qty, rate: effectiveRate },
      ];
    });
    toast({ title: `${qty} x ${color.colorName} added to cart` });
  };

  const openConfirmFor = (color: ColorWithVariantAndProduct) => {
    setSelectedColor(color);
    setConfirmQty(1);
    setConfirmRate(Number(getEffectiveRate(color)) || "");
    setConfirmOpen(true);
  };

  const confirmAdd = () => {
    if (!selectedColor) return;
    const qty = Math.max(1, Math.floor(confirmQty));
    
    if (qty > selectedColor.stockQuantity) {
      toast({ 
        title: "⚠️ Low Stock Warning", 
        description: `Only ${selectedColor.stockQuantity} units available in stock. You can still proceed with the sale.`,
        variant: "default",
        duration: 4000
      });
    }

    if (selectedColor.stockQuantity === 0) {
      toast({ 
        title: "⚠️ Out of Stock", 
        description: `This item is out of stock. You can still proceed with the sale.`,
        variant: "default",
        duration: 4000
      });
    }

    const r = Number(confirmRate) || parseFloat(getEffectiveRate(selectedColor));
    addToCart(selectedColor, qty, r);
    setConfirmOpen(false);
    setSelectedColor(null);
    setConfirmQty(1);
    setConfirmRate("");
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.colorId === id) {
          const newQuantity = Math.max(1, it.quantity + delta);
          if (newQuantity > it.color.stockQuantity) {
            toast({ 
              title: "⚠️ Low Stock Warning", 
              description: `Only ${it.color.stockQuantity} units available in stock. You can still proceed with the sale.`,
              variant: "default",
              duration: 4000
            });
          }
          return { ...it, quantity: newQuantity };
        }
        return it;
      })
    );
  };

  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((it) => it.colorId !== id));

  const selectCustomer = (customer: CustomerSuggestion) => {
    setCustomerName(customer.customerName);
    setCustomerPhone(customer.customerPhone);
    setCustomerSuggestionsOpen(false);
  };

  const StockQuantity = ({ stock, required = 0 }: { stock: number; required?: number }) => {
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 10;
    const hasInsufficientStock = required > stock;

    if (isOutOfStock) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 text-xs px-2 py-0.5 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Out of Stock
        </Badge>
      );
    } else if (hasInsufficientStock) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Low: {stock} (Need: {required})
        </Badge>
      );
    } else if (isLowStock) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 border-amber-200">
          Low: {stock}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 text-xs px-2 py-0.5 border-emerald-200 font-mono tabular-nums">
          {stock}
        </Badge>
      );
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setConfirmOpen(false);
        setCustomerSuggestionsOpen(false);
        setShowPendingSales(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleCompleteSale(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleCompleteSale(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setCustomerSuggestionsOpen(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        if (pendingSales.length > 0 && isOnline) {
          syncPendingSales();
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refreshData();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, customerName, customerPhone, amountPaid, pendingSales, isOnline]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmAdd();
      }
      if (e.key === "Escape") {
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, confirmQty, confirmRate, selectedColor]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with offline indicator */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Point of Sale
            </h1>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isOnline ? "default" : "destructive"}
                className={isOnline 
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                  : "bg-red-100 text-red-700 border-red-200"
                }
              >
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>
              {pendingSales.length > 0 && (
                <Badge 
                  variant="outline" 
                  className="bg-amber-50 text-amber-600 border-amber-200 cursor-pointer"
                  onClick={() => setShowPendingSales(true)}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {pendingSales.length} pending
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">F2</kbd>
            <span>Search</span>
            <span className="text-slate-300">|</span>
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">Ctrl+S</kbd>
            <span>Customer</span>
            <span className="text-slate-300">|</span>
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">Ctrl+U</kbd>
            <span>Sync</span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Section */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-lg border-slate-100 bg-white overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white pb-4">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    Shopping Cart
                    <Badge className="bg-white/20 text-white border-0 font-mono tabular-nums">
                      {cart.length} items
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    {pendingSales.length > 0 && isOnline && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={syncPendingSales}
                        disabled={isSyncing}
                        className="bg-white/10 text-white border-white/20"
                      >
                        {isSyncing ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Sync Pending
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={refreshData}
                      disabled={!isOnline}
                      className="bg-white/10 text-white border-white/20"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearchOpen(true);
                        setTimeout(() => searchInputRef.current?.focus(), 60);
                      }}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Search Products (F2)
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="py-16 text-center bg-gradient-to-b from-slate-50 to-white">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Package2 className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-400">Your cart is empty</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Press F2 or click "Search Products" to add items
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-100">
                    {cart.map((it) => (
                      <div
                        key={it.colorId}
                        className="p-5 hover:bg-slate-50/50 transition-colors duration-200"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-slate-900 truncate">
                                  {it.color.variant.product.company}
                                </div>
                                <div className="text-sm text-slate-500 truncate mt-0.5">
                                  {it.color.variant.product.productName}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                                  Rs. {Math.round(it.quantity * it.rate).toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-400 font-mono tabular-nums">
                                  @ Rs. {Math.round(it.rate)} each
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-mono px-2.5 py-1 border-0">
                                {it.color.colorCode}
                              </Badge>
                              <Badge variant="outline" className="text-xs px-2 py-1 border-slate-200 text-slate-600 bg-slate-50">
                                {it.color.variant.packingSize}
                              </Badge>
                              <span className="text-sm text-slate-600">
                                {it.color.colorName}
                              </span>
                              <StockQuantity stock={it.color.stockQuantity} required={it.quantity} />
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(it.colorId, -1)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <div className="w-10 text-center text-sm font-semibold text-slate-900 font-mono tabular-nums">
                                {it.quantity}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(it.colorId, 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500"
                              onClick={() => removeFromCart(it.colorId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Customer Details */}
          <div className="space-y-5">
            <Card className="sticky top-6 shadow-lg border-slate-100 bg-white overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Customer Name</Label>
                  <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="pr-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Type or select customer"
                          disabled={!isOnline && customerSuggestions.length === 0}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setCustomerSuggestionsOpen(true)}
                          disabled={!isOnline && customerSuggestions.length === 0}
                        >
                          <User className="h-4 w-4 text-slate-400" />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-0 border-slate-200 shadow-xl z-50 max-h-96 overflow-y-auto bg-white" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search customers..." 
                          className="border-0"
                          disabled={!isOnline}
                        />
                        <CommandList className="max-h-80">
                          <CommandEmpty className="py-8 text-center text-slate-400">
                            <User className="mx-auto h-8 w-8 mb-2 opacity-40" />
                            <p>No customers found</p>
                          </CommandEmpty>
                          <CommandGroup>
                            {customerSuggestions.map((customer) => (
                              <CommandItem
                                key={customer.customerPhone}
                                value={`${customer.customerName} ${customer.customerPhone}`}
                                onSelect={() => selectCustomer(customer)}
                                className="flex flex-col items-start gap-2 py-3 px-4 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-slate-900">{customer.customerName}</span>
                                  <Badge variant="outline" className="ml-auto text-xs bg-slate-50 border-slate-200">
                                    {customer.transactionCount || 1} orders
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 w-full pl-6">
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {customer.customerPhone}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateShort(customer.lastSaleDate)}
                                  </div>
                                  <div className="text-emerald-600 font-semibold font-mono tabular-nums">
                                    Rs. {Math.round(customer.totalSpent).toLocaleString()}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <div className="border-t border-slate-100 p-2 text-xs text-slate-400 text-center">
                            {customerSuggestions.length} customers found
                          </div>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Amount Paid (optional)</Label>
                  <Input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
                    placeholder="0"
                  />
                </div>

                {/* Order Summary */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-700 font-mono tabular-nums">Rs. {Math.round(subtotal).toLocaleString()}</span>
                  </div>
                  {enableGST && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">GST (18%)</span>
                      <span className="font-medium text-slate-700 font-mono tabular-nums">Rs. {Math.round(tax).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-slate-100">
                    <span className="text-base font-semibold text-slate-900">Total</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-mono tabular-nums">
                      Rs. {Math.round(total).toLocaleString()}
                    </span>
                  </div>

                  {paidAmount > 0 && (
                    <div className="flex justify-between text-sm pt-2 p-3 rounded-lg bg-slate-50">
                      <span className="text-slate-600 font-medium">
                        {remainingBalance < 0 ? "Credit (Overpaid)" : "Balance Due"}
                      </span>
                      <span className={`font-bold font-mono tabular-nums ${remainingBalance > 0 ? "text-amber-600" : remainingBalance < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                        {remainingBalance < 0 ? `Rs. ${Math.round(Math.abs(remainingBalance)).toLocaleString()}` : `Rs. ${Math.round(remainingBalance).toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  <Button
                    className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold shadow-lg"
                    onClick={() => handleCompleteSale(true)}
                    disabled={createSaleMutation.isPending || cart.length === 0}
                  >
                    {!isOnline ? "Save Offline (Ctrl+P)" : 
                     createSaleMutation.isPending ? "Processing..." : "Complete Sale (Ctrl+P)"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-slate-200 text-slate-700 font-semibold"
                    onClick={() => handleCompleteSale(false)}
                    disabled={createSaleMutation.isPending || cart.length === 0}
                  >
                    {!isOnline ? "Save Bill Offline" : "Create Bill (Ctrl+B)"}
                  </Button>
                </div>
                
                {/* Offline Notice */}
                {!isOnline && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                    <p className="text-amber-700 flex items-center gap-1.5">
                      <WifiOff className="h-3.5 w-3.5" />
                      Working offline. Sales will be saved locally and synced when connection is restored.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Offline Info Card */}
            <Card className={`border ${isOnline ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {isOnline ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {isOnline ? 'Online Mode' : 'Offline Mode'}
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  {isOnline 
                    ? 'All sales are processed immediately. Press Ctrl+R to refresh data.'
                    : 'Sales are saved locally. Press Ctrl+U when back online to sync pending sales.'}
                </p>
                {pendingSales.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Pending sales:</span>
                      <span className="font-semibold">{pendingSales.length}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={() => setShowPendingSales(true)}
                    >
                      View Details
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 border-slate-200 shadow-2xl overflow-hidden">
          <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              Search Products
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Search by color code, color name, product name, or company
            </DialogDescription>
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="pl-12 h-12 text-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                autoFocus
              />
            </div>
          </DialogHeader>
          <div 
            ref={productsContainerRef}
            className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50/50 to-white"
          >
            {isLoading && isOnline ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="border-slate-100 shadow-sm bg-white">
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-3" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-10 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !isOnline ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <WifiOff className="h-10 w-10 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Offline Mode</h3>
                <p className="text-slate-500">Product search not available offline</p>
                <p className="text-sm text-slate-400 mt-2">
                  You can still add items you know from memory by searching
                </p>
              </div>
            ) : filteredColors.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Package2 className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No products found</h3>
                <p className="text-slate-500">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredColors.map((color) => (
                  <ProductCard
                    key={color.id}
                    color={color}
                    onAddToCart={addToCart}
                    onClick={openConfirmFor}
                    settings={settings}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md border-slate-200 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Add to Cart
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Set quantity and rate for {selectedColor?.colorName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedColor && (
              <div className="space-y-3 p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg border border-slate-200 shadow-sm" 
                       style={{ backgroundColor: selectedColor.colorCode }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {selectedColor.variant.product.company}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {selectedColor.variant.product.productName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{selectedColor.colorName}</span>
                  <StockQuantity stock={selectedColor.stockQuantity} />
                </div>
                {selectedColor.stockQuantity === 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                    <p className="text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Out of stock - you can still add to sale
                    </p>
                  </div>
                )}
                {selectedColor.stockQuantity > 0 && selectedColor.stockQuantity < 10 && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                    <p className="text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Low stock: Only {selectedColor.stockQuantity} units available
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={confirmQty}
                  onChange={(e) => setConfirmQty(parseInt(e.target.value) || 1)}
                  className="text-center text-base font-semibold border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Rate (Rs.)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={confirmRate}
                  onChange={(e) => setConfirmRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="text-center text-base font-semibold border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-200"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md"
              onClick={confirmAdd}
            >
              Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Sales Dialog */}
      <Dialog open={showPendingSales} onOpenChange={setShowPendingSales}>
        <DialogContent className="sm:max-w-2xl border-slate-200 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pending Sales ({pendingSales.length})
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Sales saved offline waiting to be synced
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {pendingSales.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-slate-700 font-medium">No pending sales</p>
                <p className="text-slate-500 text-sm mt-1">All sales are synchronized</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-600">
                    {isOnline 
                      ? 'Ready to sync' 
                      : 'Connect to internet to sync'}
                  </span>
                  {isOnline && (
                    <Button
                      size="sm"
                      onClick={syncPendingSales}
                      disabled={isSyncing || pendingSales.length === 0}
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Sync All
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">All ({pendingSales.length})</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="failed">Failed</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="space-y-3">
                    {pendingSales.map((sale) => (
                      <PendingSaleItem key={sale.offlineId} sale={sale} />
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="pending" className="space-y-3">
                    {pendingSales.filter(s => s.status === 'pending').map((sale) => (
                      <PendingSaleItem key={sale.offlineId} sale={sale} />
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="failed" className="space-y-3">
                    {pendingSales.filter(s => s.status === 'failed').map((sale) => (
                      <PendingSaleItem key={sale.offlineId} sale={sale} />
                    ))}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1 border-slate-200"
              onClick={() => setShowPendingSales(false)}
            >
              Close
            </Button>
            {isOnline && pendingSales.length > 0 && (
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                onClick={syncPendingSales}
                disabled={isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for individual pending sale item
function PendingSaleItem({ sale }: { sale: PendingSale }) {
  const { toast } = useToast();
  
  const handleDelete = async () => {
    // In a real app, you would delete from offline storage
    toast({
      title: "Delete functionality",
      description: "This would delete the pending sale from local storage",
      variant: "default",
    });
  };
  
  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1 rounded ${sale.status === 'pending' ? 'bg-amber-100' : sale.status === 'failed' ? 'bg-red-100' : 'bg-emerald-100'}`}>
              {sale.status === 'pending' ? (
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              ) : sale.status === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </div>
            <span className="text-sm font-medium text-slate-900 capitalize">{sale.status}</span>
            <Badge variant="outline" className="text-xs bg-slate-50">
              {sale.offlineId.substring(0, 8)}...
            </Badge>
          </div>
          
          <div className="text-sm text-slate-700 mb-1">
            <span className="font-medium">{sale.customerName}</span>
            <span className="text-slate-400 mx-2">•</span>
            <span>{sale.customerPhone}</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div>
              <span className="font-medium">Items:</span> {sale.itemsCount || 1}
            </div>
            <div className="text-emerald-600 font-semibold font-mono tabular-nums">
              Rs. {Math.round(sale.totalAmount).toLocaleString()}
            </div>
          </div>
          
          {sale.lastError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs">
              <p className="text-red-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {sale.lastError}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}