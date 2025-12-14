import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
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
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

export default function POSSales() {
  const { formatDateShort } = useDateFormat();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

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
  const [selectedColor, setSelectedColor] =
    useState<ColorWithVariantAndProduct | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [confirmRate, setConfirmRate] = useState<number | "">("");

  // Multi-tab state
  const [posInstances, setPosInstances] = useState<number>(1);
  const [activeInstance, setActiveInstance] = useState<number>(1);

  const { data: colorsRaw = [], isLoading } =
    useQuery<ColorWithVariantAndProduct[]>({
      queryKey: ["/api/colors"],
      refetchOnWindowFocus: true,
    });

  const colors = useDeferredValue(colorsRaw);

  const { data: customerSuggestions = [] } = useQuery<CustomerSuggestion[]>({
    queryKey: ["/api/customers/suggestions"],
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

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sales", data);
      return res.json();
    },
    onSuccess: (sale) => {
      // Invalidate all related queries for auto-refresh across all pages
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

  // Refresh data function - invalidate all related queries
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

  // New POS instance function
  const openNewPOSInstance = () => {
    const newInstanceNumber = posInstances + 1;
    setPosInstances(newInstanceNumber);
    
    // Open in new tab with instance identifier
    const newTab = window.open(`/pos?instance=${newInstanceNumber}`, `pos-${newInstanceNumber}`);
    
    if (!newTab) {
      toast({
        title: "Popup blocked!",
        description: "Please allow popups for this site to open multiple POS instances",
        variant: "destructive"
      });
    } else {
      toast({
        title: "New POS Instance Opened",
        description: `POS Instance ${newInstanceNumber} opened in new tab`
      });
    }
  };

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
      // New shortcut for opening new POS instance
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewPOSInstance();
      }
      // Refresh shortcut
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refreshData();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, customerName, customerPhone, amountPaid, posInstances]);

  // FIXED: Consistent stock validation - allow adding but show clear warnings
  const addToCart = (
    color: ColorWithVariantAndProduct,
    qty = 1,
    rate?: number
  ) => {
    const effectiveRate = rate ?? parseFloat(getEffectiveRate(color));
    
    // Show warning for low stock but allow proceeding
    if (qty > color.stockQuantity) {
      toast({ 
        title: "⚠️ Low Stock Warning", 
        description: `Only ${color.stockQuantity} units available in stock. You can still proceed with the sale.`,
        variant: "default",
        duration: 4000
      });
    }

    // Show warning for out of stock but allow proceeding
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
        // Show warning for increased quantity exceeding stock
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
    
    // Show warnings but allow proceeding
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
          // Show warning for increased quantity exceeding stock
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

  const handleCompleteSale = (isPaid: boolean) => {
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

    // Check for low stock items and show consolidated warning
    const lowStockItems = cart.filter(item => item.quantity > item.color.stockQuantity);
    const outOfStockItems = cart.filter(item => item.color.stockQuantity === 0);
    
    if (lowStockItems.length > 0 || outOfStockItems.length > 0) {
      const lowStockNames = lowStockItems.map(item => item.color.colorName).join(', ');
      const outOfStockNames = outOfStockItems.map(item => item.color.colorName).join(', ');
      
      let warningMessage = "";
      if (outOfStockItems.length > 0 && lowStockItems.length > 0) {
        warningMessage = `Out of stock: ${outOfStockNames}. Low stock: ${lowStockNames}. You can still proceed with the sale.`;
      } else if (outOfStockItems.length > 0) {
        warningMessage = `Out of stock items: ${outOfStockNames}. You can still proceed with the sale.`;
      } else {
        warningMessage = `Low stock items: ${lowStockNames}. You can still proceed with the sale.`;
      }
      
      toast({
        title: "⚠️ Stock Check",
        description: warningMessage,
        variant: "default",
        duration: 6000,
      });
    }

    const paid = isPaid ? total : paidAmount;
    const paymentStatus =
      paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    createSaleMutation.mutate({
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
    });
  };

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
        {/* Minimal Header */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Point of Sale
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">F2</kbd>
            <span>Search</span>
            <span className="text-slate-300">|</span>
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">Ctrl+S</kbd>
            <span>Customer</span>
            <span className="text-slate-300">|</span>
            <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">Ctrl+N</kbd>
            <span>New Tab</span>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={refreshData}
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
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setCustomerSuggestionsOpen(true)}
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
                    {createSaleMutation.isPending ? "Processing..." : "Complete Sale (Ctrl+P)"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-slate-200 text-slate-700 font-semibold"
                    onClick={() => handleCompleteSale(false)}
                    disabled={createSaleMutation.isPending || cart.length === 0}
                  >
                    Create Bill (Ctrl+B)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Multi-tab Info Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Zap className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Multi-Tab POS</h3>
                </div>
                <p className="text-xs text-slate-600">
                  Press <kbd className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">Ctrl+N</kbd> to open new POS instances for different customers
                </p>
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
            {isLoading ? (
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
    </div>
  );
}
