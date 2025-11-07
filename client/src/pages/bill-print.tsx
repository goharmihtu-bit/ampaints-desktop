import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, MoreVertical, Edit, Plus, Trash2, Save, X, Printer } from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThermalReceipt from "@/components/thermal-receipt";

export default function BillPrint() {
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItems, setEditingItems] = useState<{ [key: string]: { quantity: string; rate: string } }>({});
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Load receipt settings from localStorage
  const [receiptSettings, setReceiptSettings] = useState({
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS",
    fontSize: "11px",
    itemFontSize: "12px",
    padding: "0 12px 12px 12px",
    autoprint: false
  });
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('posReceiptSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        setReceiptSettings({
          businessName: settings.businessName || "ALI MUHAMMAD PAINTS",
          address: settings.address || "Basti Malook, Multan. 0300-868-3395",
          dealerText: settings.dealerText || "AUTHORIZED DEALER:",
          dealerBrands: settings.dealerBrands || "ICI-DULUX • MOBI PAINTS • WESTER 77",
          thankYou: settings.thankYou || "THANKS FOR YOUR BUSINESS",
          fontSize: settings.fontSize ? `${settings.fontSize}px` : "11px",
          itemFontSize: settings.itemFontSize ? `${settings.itemFontSize}px` : "12px",
          padding: settings.padding ? `0 ${settings.padding}px 12px ${settings.padding}px` : "0 12px 12px 12px",
          autoprint: settings.autoprint || false
        });
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
    }
  }, []);

  const { data: sale, isLoading, error } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Debug logging
  useEffect(() => {
    if (sale) {
      console.log("Sale data:", sale);
      console.log("Sale items:", sale.saleItems);
    }
    if (error) {
      console.error("Error loading sale:", error);
    }
  }, [sale, error]);

  // Complete Bill Delete Function
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      setIsPrinting(true);
      
      // Delete all sale items first
      if (sale?.saleItems) {
        for (const item of sale.saleItems) {
          await apiRequest("DELETE", `/api/sale-items/${item.id}`);
        }
      }
      
      // Then delete the sale
      await apiRequest("DELETE", `/api/sales/${saleId}`);
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
      ]);
      
      toast({ 
        title: "Bill deleted successfully",
        description: "The bill and all its items have been permanently deleted."
      });
      
      setDeleteDialogOpen(false);
      
      // Redirect to sales page after successful deletion
      setTimeout(() => {
        window.location.href = "/sales";
      }, 1000);
      
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast({ 
        title: "Failed to delete bill", 
        description: "Please try again or check your connection.",
        variant: "destructive" 
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Print Thermal Function with Auto-print Logic
  const printThermal = () => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    
    try {
      // Check if auto-print is enabled in settings
      const savedSettings = localStorage.getItem('posReceiptSettings');
      let autoprintEnabled = false;
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        autoprintEnabled = settings.autoprint || false;
      }
      
      if (autoprintEnabled) {
        // Direct print logic
        console.log("Auto-print enabled, printing directly...");
        
        // Use browser's print functionality
        setTimeout(() => {
          window.print();
          setIsPrinting(false);
          toast({ 
            title: "Receipt sent to printer",
            description: "Auto-print completed successfully."
          });
        }, 500);
        
      } else {
        // Show print dialog
        console.log("Auto-print disabled, showing print dialog...");
        
        setTimeout(() => {
          window.print();
          setIsPrinting(false);
          toast({ 
            title: "Print dialog opened",
            description: "Please select your printer from the dialog."
          });
        }, 500);
      }
      
    } catch (error) {
      console.error("Print error:", error);
      toast({ 
        title: "Print failed", 
        description: "Please check your printer connection.",
        variant: "destructive" 
      });
      setIsPrinting(false);
    }
  };

  // Manual Print Dialog (for when auto-print is off)
  const openPrintDialog = () => {
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Add Item (Zero Stock Allowed)
  const handleAddItem = () => {
    if (!selectedColor) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    const itemRate = parseFloat(selectedColor.variant.rate);
    const subtotal = itemRate * qty;

    apiRequest("POST", `/api/sales/${saleId}/items`, {
      colorId: selectedColor.id,
      quantity: qty,
      rate: itemRate,
      subtotal: subtotal,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Item added successfully" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    }).catch((error) => {
      console.error("Error adding item:", error);
      toast({ title: "Failed to add item", variant: "destructive" });
    });
  };

  // Start Edit Mode
  const startEditMode = () => {
    if (!sale) return;

    const initialEditingState: { [key: string]: { quantity: string; rate: string } } = {};
    sale.saleItems.forEach(item => {
      initialEditingState[item.id] = {
        quantity: item.quantity.toString(),
        rate: item.rate.toString()
      };
    });

    setEditingItems(initialEditingState);
    setEditMode(true);
  };

  // Cancel Edit Mode
  const cancelEditMode = () => {
    setEditingItems({});
    setEditMode(false);
  };

  // Update Item Field
  const updateEditingItem = (itemId: string, field: 'quantity' | 'rate', value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Save All Changes
  const saveAllChanges = async () => {
    if (!sale) return;

    try {
      let hasChanges = false;
      const updates = [];

      // Update existing items
      for (const item of sale.saleItems) {
        const editingItem = editingItems[item.id];
        if (!editingItem) continue;

        const newQuantity = parseInt(editingItem.quantity);
        const newRate = parseFloat(editingItem.rate);

        if (isNaN(newQuantity) || newQuantity < 1) {
          toast({ title: `Invalid quantity for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        if (isNaN(newRate) || newRate < 0) {
          toast({ title: `Invalid rate for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        // Only update if changed
        if (newQuantity !== item.quantity || newRate !== parseFloat(item.rate)) {
          hasChanges = true;
          updates.push(
            apiRequest("PATCH", `/api/sale-items/${item.id}`, {
              quantity: newQuantity,
              rate: newRate,
              subtotal: newRate * newQuantity,
            })
          );
        }
      }

      if (hasChanges) {
        await Promise.all(updates);
        await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
        toast({ title: "All changes saved successfully" });
      } else {
        toast({ title: "No changes to save" });
      }

      setEditMode(false);
      setEditingItems({});
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  // Delete Individual Item
  const deleteItem = async (itemId: string, itemName: string) => {
    try {
      await apiRequest("DELETE", `/api/sale-items/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: `${itemName} deleted successfully` });

      // Remove from editing state if exists
      setEditingItems(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Failed to delete item", variant: "destructive" });
    }
  };

  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return colors
      .filter(c =>
        c.colorName.toLowerCase().includes(q) ||
        c.colorCode.toLowerCase().includes(q) ||
        c.variant.product.company.toLowerCase().includes(q) ||
        c.variant.product.productName.toLowerCase().includes(q) ||
        c.variant.packingSize.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [colors, searchQuery]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB");

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full max-w-2xl mx-auto" /></div>;
  if (!sale) return <div className="p-6 text-center text-muted-foreground">Bill not found</div>;

  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
  const isPaid = sale.paymentStatus === "paid";

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
    if (!item.color || !item.color.variant || !item.color.variant.product) {
      return "Product information not available";
    }
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Helper: Short Product Name for Receipt
  const getShortProductLine = (item: any) => {
    if (!item.color || !item.color.variant || !item.color.variant.product) {
      return "Product info missing";
    }
    return `${item.color.variant.product.productName} - ${item.color.colorName}`;
  };

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Link href="/pos">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to POS
            </Button>
          </Link>

          <div className="flex gap-3">
            <Button 
              onClick={printThermal} 
              className="font-medium"
              disabled={isPrinting}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {isPrinting ? "Printing..." : "Print Receipt"}
            </Button>

            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button variant="outline" onClick={cancelEditMode}>
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={saveAllChanges}>
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={startEditMode}>
                      <Edit className="h-4 w-4 mr-2" /> Edit Bill
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAddItemDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setDeleteDialogOpen(true)} 
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Bill
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Screen View */}
        <Card className="print:hidden">
          <CardContent className="p-8 space-y-6">
            <div className="text-center border-b pb-4">
              <p className="text-xs mt-1">Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <strong>{sale.customerName}</strong></div>
              <div><span className="text-muted-foreground">Phone:</span> <strong>{sale.customerPhone}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> <strong>{new Date(sale.createdAt).toLocaleDateString("en-GB")}</strong></div>
              <div><span className="text-muted-foreground">Time:</span> <strong>{new Date(sale.createdAt).toLocaleTimeString()}</strong></div>
            </div>

            <div className="border-t pt-4">
              <h2 className="font-semibold mb-3 flex justify-between items-center">
                <span>Items ({sale.saleItems?.length || 0})</span>
                {editMode && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Edit className="h-3 w-3" /> Edit Mode
                  </Badge>
                )}
              </h2>

              {(!sale.saleItems || sale.saleItems.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items in this bill
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left pb-2">Product</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Rate</th>
                      <th className="text-right pb-2">Amount</th>
                      {editMode && <th className="text-right pb-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sale.saleItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">
                          {getProductLine(item)}
                        </td>
                        <td className="py-3 text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              min="1"
                              value={editingItems[item.id]?.quantity || item.quantity}
                              onChange={(e) => updateEditingItem(item.id, 'quantity', e.target.value)}
                              className="w-20 text-right ml-auto"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingItems[item.id]?.rate || item.rate}
                              onChange={(e) => updateEditingItem(item.id, 'rate', e.target.value)}
                              className="w-24 text-right ml-auto"
                            />
                          ) : (
                            `Rs. ${Math.round(parseFloat(item.rate))}`
                          )}
                        </td>
                        <td className="py-3 text-right font-bold">
                          Rs. {Math.round(parseFloat(item.subtotal))}
                        </td>
                        {editMode && (
                          <td className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteItem(item.id, item.color.colorName)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t pt-4 space-y-2 text-lg">
              <div className="flex justify-between font-bold">
                <span>Total : </span>
                <span>Rs. {Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid : </span>
                <span>Rs. {Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance : </span>
                  <span>Rs. {Math.round(outstanding)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Status : </span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {sale.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="text-center border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {receiptSettings.autoprint ? 
                  "Auto-print is enabled. Receipt will print directly." : 
                  "Auto-print is disabled. Print dialog will open."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <ThermalReceipt sale={sale} receiptSettings={receiptSettings} />

      {/* Delete Bill Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Bill</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the bill for{" "}
              <strong>{sale?.customerName}</strong> and remove all associated items from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-4 rounded-md">
            <p className="text-sm text-destructive font-medium">
              <strong>Warning:</strong> All bill items will be deleted and stock quantities will be updated.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPrinting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteSale}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Trash2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Bill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Item to Bill</DialogTitle>
            <DialogDescription>
              Search and select a product to add to the bill
            </DialogDescription>
          </DialogHeader>
          <Input 
            placeholder="Search by color code, name, company, or product..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No products found matching your search" : "No products available"}
              </div>
            ) : (
              filteredColors.map(c => (
                <Card
                  key={c.id}
                  className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "border-primary bg-accent" : ""}`}
                  onClick={() => setSelectedColor(c)}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{c.variant.product.productName} - {c.colorName} {c.colorCode} - {c.variant.packingSize}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.variant.product.company} • Stock: {c.stockQuantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                      <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                        {c.stockQuantity} in stock
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {selectedColor && (
            <div className="space-y-3">
              <Label>Quantity</Label>
              <Input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">Zero stock allowed</p>
              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between font-mono">
                  <span>Subtotal:</span>
                  <span>Rs. {Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0"))}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS - 80MM THERMAL OPTIMIZED */}
      <style>{`
        @media print {
          @page { 
            size: 80mm auto;
            margin: 0;
          }
          html, body { 
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 11px;
            font-weight: bold;
            color: #000 !important;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow-x: hidden;
            border: none !important;
            outline: none !important;
          }
          .no-print, dialog, button { 
            display: none !important; 
          }
          * {
            color: #000 !important;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-sizing: border-box;
          }
          table {
            font-weight: bold;
            border-collapse: collapse;
            width: 100% !important;
            max-width: 100% !important;
          }
          h1, p, td, th, span, div {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        }
      `}</style>

    </>
  );
}