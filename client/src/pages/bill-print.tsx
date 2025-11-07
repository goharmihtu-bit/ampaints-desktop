import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, MoreVertical, Edit, Plus, Trash2, Save, X } from "lucide-react";
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
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  // Get ALL colors without limiting
  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Complete Bill Delete Function - FIXED
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      setIsDeleting(true);
      
      // Get the sale details first to return stock
      const saleResponse = await fetch(`/api/sales/${saleId}`);
      if (!saleResponse.ok) throw new Error("Failed to fetch sale details");
      const saleData = await saleResponse.json();
      
      if (saleData.saleItems && saleData.saleItems.length > 0) {
        // Return stock for all items
        for (const item of saleData.saleItems) {
          const currentStock = item.color.stockQuantity || 0;
          const newStock = currentStock + item.quantity;
          
          // Update stock quantity
          await fetch(`/api/colors/${item.colorId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stockQuantity: newStock })
          });
        }
        
        // Delete all sale items
        for (const item of saleData.saleItems) {
          await fetch(`/api/sale-items/${item.id}`, {
            method: "DELETE"
          });
        }
      }
      
      // Delete the sale itself
      const deleteResponse = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE"
      });
      
      if (!deleteResponse.ok) throw new Error("Failed to delete sale");
      
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
      setIsDeleting(false);
    }
  };

  // Print Thermal Function with Auto-print Logic - FIXED
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
        console.log("Auto-print: Printing directly...");
        
        // Add print-specific styles
        const printStyle = document.createElement('style');
        printStyle.innerHTML = `
          @media print {
            @page { 
              size: 80mm auto;
              margin: 0;
            }
            body { 
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              font-family: 'Courier New', monospace !important;
              font-size: 11px !important;
              font-weight: bold !important;
              color: #000 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print { 
              display: none !important; 
            }
            * {
              color: #000 !important;
              font-weight: bold !important;
            }
          }
        `;
        document.head.appendChild(printStyle);
        
        // Trigger print
        setTimeout(() => {
          window.print();
          
          // Clean up
          setTimeout(() => {
            document.head.removeChild(printStyle);
            setIsPrinting(false);
            toast({ 
              title: "Receipt printed successfully",
              description: "Auto-print completed."
            });
          }, 100);
        }, 100);
        
      } else {
        // Show print dialog
        console.log("Auto-print disabled: Showing print dialog...");
        
        setTimeout(() => {
          window.print();
          setIsPrinting(false);
          toast({ 
            title: "Print dialog opened",
            description: "Please select your printer from the dialog."
          });
        }, 100);
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

  // Add Item Function
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

    fetch(`/api/sales/${saleId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        colorId: selectedColor.id,
        quantity: qty,
        rate: itemRate,
        subtotal: subtotal,
      })
    })
    .then(response => {
      if (!response.ok) throw new Error("Failed to add item");
      return response.json();
    })
    .then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Item added successfully" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    })
    .catch((error) => {
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
          await fetch(`/api/sale-items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quantity: newQuantity,
              rate: newRate,
              subtotal: newRate * newQuantity,
            })
          });
        }
      }

      if (hasChanges) {
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
      await fetch(`/api/sale-items/${itemId}`, {
        method: "DELETE"
      });
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

  // Show ALL colors without limiting
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;
    const q = searchQuery.toLowerCase();
    return colors.filter(c =>
      c.colorName.toLowerCase().includes(q) ||
      c.colorCode.toLowerCase().includes(q) ||
      c.variant.product.company.toLowerCase().includes(q) ||
      c.variant.product.productName.toLowerCase().includes(q) ||
      c.variant.packingSize.toLowerCase().includes(q)
    );
  }, [colors, searchQuery]);

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
              <h1 className="text-xl font-bold">INVOICE</h1>
              <p className="text-xs mt-1">Bill #: {sale.id.slice(0, 8).toUpperCase()}</p>
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
                <div className="overflow-x-auto">
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
                </div>
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
                  "✓ Auto-print enabled: Receipt will print directly" : 
                  "ℹ Auto-print disabled: Print dialog will open"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <div id="thermal-receipt">
        <ThermalReceipt sale={sale} receiptSettings={receiptSettings} />
      </div>

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
              <strong>Warning:</strong> All bill items will be deleted and stock quantities will be returned to inventory.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteSale}
              disabled={isDeleting}
            >
              {isDeleting ? (
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

      {/* Add Item Dialog - FIXED: Proper layout with Qty and Add Button */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Item to Bill</DialogTitle>
            <DialogDescription>
              Search and select a product to add to the bill. Showing {filteredColors.length} products.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
              <Input 
                placeholder="Search by color code, name, company, or product..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-9"
              />
            </div>
            
            {/* Products List */}
            <div className="flex-1 overflow-y-auto border rounded-md">
              {filteredColors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No products found matching your search" : "No products available"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredColors.map(c => (
                    <div
                      key={c.id}
                      className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}
                      onClick={() => setSelectedColor(c)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-semibold">
                            {c.variant.product.productName} - {c.colorName} {c.colorCode} - {c.variant.packingSize}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {c.variant.product.company} • Stock: {c.stockQuantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-lg">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                          <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                            {c.stockQuantity} in stock
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Input and Add Button - FIXED: Always visible when product selected */}
            {selectedColor && (
              <div className="border-t pt-4 space-y-4 bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="font-semibold">Quantity</Label>
                    <Input 
                      id="quantity"
                      type="number" 
                      min="1" 
                      value={quantity} 
                      onChange={e => setQuantity(e.target.value)} 
                      className="text-lg h-12 text-center"
                    />
                    <p className="text-xs text-muted-foreground">Zero stock allowed</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Subtotal</Label>
                    <div className="p-3 bg-background rounded-md text-center border">
                      <p className="font-mono font-bold text-lg text-green-600">
                        Rs. {Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0")).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={handleAddItem} 
                  className="w-full h-12 text-lg"
                  size="lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Item to Bill
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddItemDialogOpen(false);
              setSelectedColor(null);
              setQuantity("1");
              setSearchQuery("");
            }}>
              Close
            </Button>
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
            font-family: 'Courier New', monospace !important;
            font-size: 11px !important;
            font-weight: bold !important;
            color: #000 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, dialog, button, .print\\:hidden { 
            display: none !important; 
          }
          * {
            color: #000 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          table {
            font-weight: bold !important;
            border-collapse: collapse !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          #thermal-receipt {
            display: block !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
}