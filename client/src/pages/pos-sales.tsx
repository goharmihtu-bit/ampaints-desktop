import { useEffect, useMemo, useRef, useState } from "react";
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

  const { data: colors = [], isLoading } =
    useQuery<ColorWithVariantAndProduct[]>({
      queryKey: ["/api/colors"],
    });

  // FIXED: Show ALL customer suggestions without limit
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
  const remainingBalance = Math.max(0, total - paidAmount);

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sales", data);
      return res.json();
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/suggestions"] });
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

  // Refresh data function
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers/suggestions"] });
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
        <Badge variant="outline" className="bg-red-50 text-red-700 text-xs px-2 py-1">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Out of Stock
        </Badge>
      );
    } else if (hasInsufficientStock) {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs px-2 py-1">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Low: {stock} (Need: {required})
        </Badge>
      );
    } else if (isLowStock) {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs px-2 py-1">
          Low: {stock}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs px-2 py-1">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Clean without search bar */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            POS Sales
          </h1>
          <p className="text-sm text-gray-600 mb-4 flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              Use <kbd className="bg-white border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-mono">F2</kbd> to search products
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4 text-blue-500" />
              <kbd className="bg-white border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-mono">Ctrl+S</kbd> for customer suggestions
            </span>
            <span className="flex items-center gap-1">
              <Plus className="h-4 w-4 text-green-500" />
              <kbd className="bg-white border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-mono">Ctrl+N</kbd> for new POS instance
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              <kbd className="bg-white border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-mono">Ctrl+R</kbd> to refresh data
            </span>
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart - Search Button Inside Cart */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg border-b-0 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                    <ShoppingCart className="h-6 w-6" /> 
                    Shopping Cart ({cart.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={refreshData}
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearchOpen(true);
                        setTimeout(() => searchInputRef.current?.focus(), 60);
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Search Products (F2)
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-white rounded-b-lg">
                {cart.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 bg-gradient-to-b from-white to-gray-50 rounded-b-lg">
                    <Package2 className="mx-auto mb-4 h-16 w-16 opacity-30" />
                    <p className="text-lg font-medium text-gray-400">Your cart is empty</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Click "Search Products" to add items
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-gray-100">
                    {cart.map((it) => (
                      <div
                        key={it.colorId}
                        className="p-5 hover:bg-gray-50 transition-colors duration-200"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-gray-900 truncate">
                                  {it.color.variant.product.company}
                                </div>
                                <div className="text-sm text-gray-600 truncate mt-1">
                                  {it.color.variant.product.productName}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-blue-600">
                                  Rs. {Math.round(it.quantity * it.rate)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Rs. {Math.round(it.rate)} each
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-1">
                                {it.color.colorCode}
                              </Badge>
                              <Badge variant="outline" className="text-xs px-2 py-1 border-gray-300">
                                {it.color.variant.packingSize}
                              </Badge>
                              <div className="text-sm text-gray-700">
                                {it.color.colorName}
                              </div>
                              <StockQuantity stock={it.color.stockQuantity} required={it.quantity} />
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white"
                                onClick={() => updateQuantity(it.colorId, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <div className="w-8 text-center text-sm font-medium">
                                {it.quantity}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white"
                                onClick={() => updateQuantity(it.colorId, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
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

          {/* Right Side */}
          <div className="space-y-6">
            <Card className="sticky top-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-gray-900">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Name</Label>
                  <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="h-11 pr-12 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Type or select customer"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-11 px-3 hover:bg-gray-100"
                          onClick={() => setCustomerSuggestionsOpen(true)}
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    {/* FIXED: Show ALL customer suggestions without limit */}
                    <PopoverContent className="w-96 p-0 border-gray-300 shadow-xl z-50 max-h-96 overflow-y-auto" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search customers..." 
                          className="h-11 border-0 focus:ring-0"
                        />
                        <CommandList className="max-h-80">
                          <CommandEmpty className="py-8 text-center text-gray-500">
                            <User className="mx-auto h-8 w-8 mb-2 opacity-40" />
                            <p>No customers found</p>
                          </CommandEmpty>
                          <CommandGroup>
                            {customerSuggestions.map((customer) => (
                              <CommandItem
                                key={customer.customerPhone}
                                value={`${customer.customerName} ${customer.customerPhone}`}
                                onSelect={() => selectCustomer(customer)}
                                className="flex flex-col items-start gap-2 py-3 px-4 cursor-pointer aria-selected:bg-gray-50"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <User className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium text-gray-900">{customer.customerName}</span>
                                  <Badge variant="outline" className="ml-auto text-xs">
                                    {customer.transactionCount || 1} trans
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500 w-full pl-6">
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {customer.customerPhone}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(customer.lastSaleDate).toLocaleDateString()}
                                  </div>
                                  <div className="text-green-600 font-medium">
                                    Rs. {Math.round(customer.totalSpent).toLocaleString()}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {/* Show total count */}
                          <div className="border-t p-2 text-xs text-gray-500 text-center">
                            {customerSuggestions.length} customers found
                          </div>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Phone</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-11 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Amount Paid (optional)</Label>
                  <Input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-11 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">Rs. {Math.round(subtotal)}</span>
                  </div>
                  {enableGST && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>GST (18%)</span>
                      <span className="font-medium">Rs. {Math.round(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Total</span>
                    <span className="text-blue-600">
                      Rs. {Math.round(total)}
                    </span>
                  </div>

                  {paidAmount > 0 && (
                    <div className="flex justify-between text-sm font-medium pt-2">
                      <span className="text-gray-700">Remaining</span>
                      <span className={remainingBalance > 0 ? "text-orange-600" : "text-green-600"}>
                        Rs. {Math.round(remainingBalance)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-semibold shadow-lg transition-all duration-200"
                    onClick={() => handleCompleteSale(true)}
                    disabled={createSaleMutation.isPending || cart.length === 0}
                  >
                    {createSaleMutation.isPending ? "Processing..." : "Complete Sale (Ctrl+P)"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-semibold transition-all duration-200"
                    onClick={() => handleCompleteSale(false)}
                    disabled={createSaleMutation.isPending || cart.length === 0}
                  >
                    Create Bill (Ctrl+B)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Multi-tab Info Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-medium text-blue-900">Multi-Tab POS</h3>
                </div>
                <p className="text-xs text-blue-700">
                  Use <kbd className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-xs">Ctrl+N</kbd> to open new POS instances for different customers
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 border-0 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Search className="h-5 w-5 text-gray-600" />
              Search Products
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Search by color code, color name, product name, or company
            </DialogDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="pl-10 h-12 text-lg border-2 border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-500"
                autoFocus
              />
            </div>
          </DialogHeader>
          <div 
            ref={productsContainerRef}
            className="flex-1 overflow-y-auto p-6 bg-gray-50"
          >
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="border-0 shadow-sm bg-white">
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
                <Package2 className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
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
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add to Cart
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Set quantity and rate for {selectedColor?.colorName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedColor && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-gray-300" 
                       style={{ backgroundColor: selectedColor.colorCode }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {selectedColor.variant.product.company}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {selectedColor.variant.product.productName}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  {selectedColor.colorName}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Stock:</span>
                  <span className="font-medium">
                    <StockQuantity stock={selectedColor.stockQuantity} />
                  </span>
                </div>
                {selectedColor.stockQuantity === 0 && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                    <p className="text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      This item is out of stock, but you can still add it to the sale.
                    </p>
                  </div>
                )}
                {selectedColor.stockQuantity > 0 && selectedColor.stockQuantity < 10 && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <p className="text-yellow-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Low stock: Only {selectedColor.stockQuantity} units available.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={confirmQty}
                  onChange={(e) => setConfirmQty(parseInt(e.target.value) || 1)}
                  className="h-10 text-center text-base font-medium border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-500"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Rate (Rs.)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={confirmRate}
                  onChange={(e) => setConfirmRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="h-10 text-center text-base font-medium border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 border-gray-300 hover:bg-gray-50"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 bg-gray-900 hover:bg-gray-800 text-white font-medium"
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