import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Search, RotateCcw, FileText, Package, Minus, Plus, Loader2 } from "lucide-react";
import type { SaleWithItems, ReturnWithItems, Color, Variant, Product } from "@shared/schema";

type ColorWithDetails = Color & {
  variant?: Variant & {
    product?: Product;
  };
};

type SaleItem = {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color?: ColorWithDetails;
};

export default function Returns() {
  const { toast } = useToast();
  const { formatDate } = useDateFormat();
  const [activeTab, setActiveTab] = useState("bill");
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnType, setReturnType] = useState<"full" | "partial">("full");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [restockItems, setRestockItems] = useState<Record<string, boolean>>({});

  const { data: returns = [], isLoading: returnsLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  });

  const { data: sales = [], isLoading: salesLoading, refetch: refetchSales } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales"],
    enabled: false,
  });

  const searchMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch(`/api/sales`);
      if (!response.ok) throw new Error("Failed to fetch sales");
      const allSales: SaleWithItems[] = await response.json();
      return allSales.filter(sale => 
        sale.customerPhone.includes(phone) || 
        sale.customerName.toLowerCase().includes(phone.toLowerCase())
      );
    },
    onSuccess: (data) => {
      if (data.length === 0) {
        toast({
          title: "No Sales Found",
          description: "No sales found for this search criteria",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to search sales",
        variant: "destructive",
      });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: { returnData: any; items: any[] }) => {
      const response = await apiRequest("POST", "/api/returns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setShowReturnDialog(false);
      setSelectedSale(null);
      setSelectedItems({});
      setRestockItems({});
      setReturnReason("");
      toast({
        title: "Return Processed",
        description: "Return has been successfully processed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process return",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchPhone.trim().length < 3) {
      toast({
        title: "Search Required",
        description: "Enter at least 3 characters to search",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchPhone.trim());
  };

  const handleSelectSale = (sale: SaleWithItems) => {
    setSelectedSale(sale);
    setShowReturnDialog(true);
    setReturnType("full");
    setSelectedItems({});
    setRestockItems({});
    setReturnReason("");
    
    if (sale.saleItems) {
      const items: Record<string, number> = {};
      const restock: Record<string, boolean> = {};
      sale.saleItems.forEach(item => {
        items[item.id] = item.quantity;
        restock[item.id] = true;
      });
      setSelectedItems(items);
      setRestockItems(restock);
    }
  };

  const handleItemQuantityChange = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || 0;
      const newQty = Math.max(0, Math.min(maxQty, current + delta));
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
    setReturnType("partial");
  };

  const handleToggleRestock = (itemId: string) => {
    setRestockItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSubmitReturn = () => {
    if (!selectedSale) return;

    const itemsToReturn = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => {
        const saleItem = selectedSale.saleItems?.find(i => i.id === itemId);
        if (!saleItem) return null;
        return {
          colorId: saleItem.colorId,
          saleItemId: saleItem.id,
          quantity,
          rate: parseFloat(saleItem.rate),
          subtotal: quantity * parseFloat(saleItem.rate),
          stockRestored: restockItems[itemId] ?? true,
        };
      })
      .filter(Boolean);

    if (itemsToReturn.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Select at least one item to return",
        variant: "destructive",
      });
      return;
    }

    const totalRefund = itemsToReturn.reduce((sum, item) => sum + (item?.subtotal || 0), 0);

    createReturnMutation.mutate({
      returnData: {
        saleId: selectedSale.id,
        customerName: selectedSale.customerName,
        customerPhone: selectedSale.customerPhone,
        returnType: returnType === "full" ? "full_bill" : "item",
        totalRefund,
        reason: returnReason || null,
        status: "completed",
      },
      items: itemsToReturn,
    });
  };

  const formatItemDetails = (item: SaleItem) => {
    if (!item.color) return `Item #${item.colorId}`;
    const color = item.color as ColorWithDetails;
    const variant = color.variant;
    const product = variant?.product;
    return `${product?.company || ""} ${product?.productName || ""} - ${variant?.packingSize || ""} - ${color.colorCode} ${color.colorName}`;
  };

  const searchResults = searchMutation.data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-returns-title">Returns Management</h1>
        <p className="text-muted-foreground">Process bill returns and item returns with stock restoration</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bill" data-testid="tab-bill-returns">
            <FileText className="w-4 h-4 mr-2" />
            Bill Returns
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-return-history">
            <RotateCcw className="w-4 h-4 mr-2" />
            Return History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bill" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Bill to Return</CardTitle>
              <CardDescription>Search by customer phone number or name to find the bill</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter customer phone or name..."
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-search-return"
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={searchMutation.isPending}
                  data-testid="button-search-return"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="ml-2">Search</span>
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Found Sales ({searchResults.length})</Label>
                  <ScrollArea className="h-[300px] rounded-md border">
                    <div className="p-2 space-y-2">
                      {searchResults.map((sale) => (
                        <Card 
                          key={sale.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => handleSelectSale(sale)}
                          data-testid={`card-sale-${sale.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium truncate">{sale.customerName}</span>
                                  <Badge variant="outline" className="shrink-0">{sale.customerPhone}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatDate(new Date(sale.createdAt))} - {sale.saleItems?.length || 0} items
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-medium">Rs. {parseFloat(sale.totalAmount).toLocaleString()}</div>
                                <Badge 
                                  variant={sale.paymentStatus === "paid" ? "default" : "secondary"}
                                  className="mt-1"
                                >
                                  {sale.paymentStatus}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Return History</CardTitle>
              <CardDescription>View all processed returns</CardDescription>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : returns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No returns processed yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {returns.map((ret) => (
                      <Card key={ret.id} data-testid={`card-return-${ret.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{ret.customerName}</span>
                                <Badge variant="outline">{ret.customerPhone}</Badge>
                                <Badge variant={ret.returnType === "full_bill" ? "destructive" : "secondary"}>
                                  {ret.returnType === "full_bill" ? "Full Bill" : "Items"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {formatDate(new Date(ret.createdAt))}
                                {ret.reason && ` - ${ret.reason}`}
                              </div>
                              <div className="text-sm mt-1">
                                {ret.returnItems?.length || 0} item(s) returned
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-medium text-destructive">
                                - Rs. {parseFloat(ret.totalRefund).toLocaleString()}
                              </div>
                              <Badge variant="default" className="mt-1">
                                {ret.status}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Select items to return and specify quantities
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedSale.customerName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedSale.customerPhone}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bill Date</Label>
                  <p className="font-medium">{formatDate(new Date(selectedSale.createdAt))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bill Total</Label>
                  <p className="font-medium">Rs. {parseFloat(selectedSale.totalAmount).toLocaleString()}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium mb-2 block">Items to Return</Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-2 space-y-2">
                    {selectedSale.saleItems?.map((item) => {
                      const returnQty = selectedItems[item.id] || 0;
                      const isReturning = returnQty > 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-md border ${isReturning ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{formatItemDetails(item)}</p>
                              <p className="text-xs text-muted-foreground">
                                Rate: Rs. {parseFloat(item.rate).toLocaleString()} x {item.quantity} = Rs. {parseFloat(item.subtotal).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button 
                                size="icon" 
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => handleItemQuantityChange(item.id, item.quantity, -1)}
                                disabled={returnQty === 0}
                                data-testid={`button-decrease-${item.id}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {returnQty}
                              </span>
                              <Button 
                                size="icon" 
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => handleItemQuantityChange(item.id, item.quantity, 1)}
                                disabled={returnQty >= item.quantity}
                                data-testid={`button-increase-${item.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {isReturning && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <Checkbox
                                id={`restock-${item.id}`}
                                checked={restockItems[item.id] ?? true}
                                onCheckedChange={() => handleToggleRestock(item.id)}
                              />
                              <Label htmlFor={`restock-${item.id}`} className="text-xs cursor-pointer">
                                <Package className="h-3 w-3 inline mr-1" />
                                Restore to stock ({returnQty} units)
                              </Label>
                              <span className="text-xs text-destructive ml-auto">
                                - Rs. {(returnQty * parseFloat(item.rate)).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <Label htmlFor="reason" className="text-sm font-medium">Return Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="mt-1"
                  data-testid="input-return-reason"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Total Refund Amount</p>
                  <p className="text-xl font-bold text-destructive">
                    Rs. {Object.entries(selectedItems)
                      .reduce((sum, [itemId, qty]) => {
                        const item = selectedSale.saleItems?.find(i => i.id === itemId);
                        return sum + (qty * parseFloat(item?.rate || "0"));
                      }, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <Badge variant={returnType === "full" ? "destructive" : "secondary"}>
                  {returnType === "full" ? "Full Bill Return" : "Partial Return"}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowReturnDialog(false)}
              data-testid="button-cancel-return"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSubmitReturn}
              disabled={createReturnMutation.isPending || Object.keys(selectedItems).length === 0}
              data-testid="button-confirm-return"
            >
              {createReturnMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Process Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
