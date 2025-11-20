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
  const [customRate, setCustomRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItems, setEditingItems] = useState<{ [key: string]: { quantity: string; rate: string } }>({});
  
  // Load receipt settings from localStorage
  const [receiptSettings, setReceiptSettings] = useState({
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS",
    fontSize: "11px",
    itemFontSize: "12px",
    padding: "0 12px 12px 12px"
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
          padding: settings.padding ? `0 ${settings.padding}px 12px ${settings.padding}px` : "0 12px 12px 12px"
        });
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
      // Keep default settings if parsing fails
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

  // Delete Bill - IMPROVED VERSION
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      // First delete all sale items
      for (const item of sale?.saleItems || []) {
        await apiRequest("DELETE", `/api/sale-items/${item.id}`);
      }
      
      // Then delete the sale record
      await apiRequest("DELETE", `/api/sales/${saleId}`);
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sale-items"] });
      
      toast({ 
        title: "Bill completely deleted", 
        description: "All bill data has been removed successfully" 
      });
      
      // Redirect to POS with cache clearance
      setTimeout(() => {
        window.location.href = "/pos?refresh=" + Date.now();
      }, 500);
      
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast({ 
        title: "Failed to delete bill", 
        variant: "destructive",
        description: "Please try again" 
      });
    }
  };

  // Print Thermal
  const printThermal = () => {
    setTimeout(() => window.print(), 200);
  };

  // Add Item with Custom Rate
  const handleAddItem = () => {
    if (!selectedColor) return toast({ title: "Select product", variant: "destructive" });
    const qty = parseInt(quantity);
    if (qty < 1) return toast({ title: "Invalid quantity", variant: "destructive" });

    // Use custom rate if provided, otherwise use product's default rate
    const itemRate = customRate ? parseFloat(customRate) : parseFloat(selectedColor.variant.rate);
    
    if (isNaN(itemRate) || itemRate < 0) return toast({ title: "Invalid rate", variant: "destructive" });

    apiRequest("POST", `/api/sales/${saleId}/items`, {
      colorId: selectedColor.id,
      quantity: qty,
      rate: itemRate,
      subtotal: itemRate * qty,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: "Item added" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setCustomRate("");
      setSearchQuery("");
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
          await apiRequest("PATCH", `/api/sale-items/${item.id}`, {
            quantity: newQuantity,
            rate: newRate,
            subtotal: newRate * newQuantity,
          });
        }
      }

      if (hasChanges) {
        await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
        toast({ title: "All changes saved" });
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
      toast({ title: `${itemName} deleted` });

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

  // Smart Search with Exact Color Code Priority
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;

    const q = searchQuery.toLowerCase().trim();
    
    // First, find exact color code matches
    const exactColorCodeMatches = colors.filter(c => 
      c.colorCode.toLowerCase() === q
    );

    // Then find partial matches
    const partialMatches = colors.filter(c => 
      c.colorName.toLowerCase().includes(q) ||
      c.colorCode.toLowerCase().includes(q) ||
      c.variant.product.company.toLowerCase().includes(q) ||
      c.variant.product.productName.toLowerCase().includes(q) ||
      c.variant.packingSize.toLowerCase().includes(q)
    ).filter(item => !exactColorCodeMatches.includes(item));

    // Combine results: exact matches first, then partial matches
    return [...exactColorCodeMatches, ...partialMatches];
  }, [colors, searchQuery]);

  // Reset custom rate when selecting new color
  useEffect(() => {
    if (selectedColor) {
      setCustomRate(selectedColor.variant.rate);
    }
  }, [selectedColor]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB");

  // Show error if bill not found
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Bill Not Found</h1>
          <p className="text-muted-foreground">The bill you are looking for does not exist or has been deleted.</p>
          <Link href="/pos">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to POS
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full max-w-2xl mx-auto" /></div>;
  if (!sale) return <div className="p-6 text-center text-muted-foreground">Bill not found</div>;

  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
  const isPaid = sale.paymentStatus === "paid";

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Helper: Short Product Name for Receipt
  const getShortProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName}`;
  };

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Link href="/pos">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>

          <div className="flex gap-3">
            <Button onClick={printThermal} className="font-medium">
              <Receipt className="h-4 w-4 mr-2" />
              Print Receipt
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
                    <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
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
                <span>Items</span>
                {editMode && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Edit className="h-3 w-3" /> Edit Mode
                  </Badge>
                )}
              </h2>

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

            <div className="border-t pt-4 space-y-2 text-lg">
              <div className="flex justify-between font-bold">
                <span>Total : </span>
                <span>{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid : </span>
                <span>{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance : </span>
                  <span>{Math.round(outstanding)}</span>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <ThermalReceipt sale={sale} receiptSettings={receiptSettings} />

      {/* Delete Bill Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bill Completely?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
              <li>All items in this bill</li>
              <li>Bill payment information</li>
              <li>Complete sale record</li>
            </ul>
            <p className="text-sm font-medium text-red-600">
              This action cannot be undone and all data will be lost permanently.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Completely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <Input 
            placeholder="Search by color code, color name, product, company..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.map(c => (
              <Card
                key={c.id}
                className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "border-primary bg-accent" : ""}`}
                onClick={() => setSelectedColor(c)}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{c.variant.product.productName} - {c.colorName} {c.colorCode} - {c.variant.packingSize}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.variant.product.company} • {c.variant.product.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                    <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                      Stock: {c.stockQuantity}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedColor && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input 
                  id="quantity"
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">Zero stock allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">
                  Rate (Default: Rs. {Math.round(parseFloat(selectedColor.variant.rate))})
                </Label>
                <Input 
                  id="rate"
                  type="number" 
                  min="0"
                  step="0.01"
                  value={customRate} 
                  onChange={e => setCustomRate(e.target.value)} 
                  placeholder={`Enter custom rate (default: ${selectedColor.variant.rate})`}
                />
                <p className="text-xs text-muted-foreground">
                  You can change the rate from default price
                </p>
              </div>

              {customRate && customRate !== selectedColor.variant.rate && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800 font-medium">
                    Custom rate applied: Rs. {Math.round(parseFloat(customRate))} 
                    {parseFloat(customRate) > parseFloat(selectedColor.variant.rate) ? 
                      ` (+${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})` : 
                      ` (${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddItemDialogOpen(false);
              setSelectedColor(null);
              setCustomRate("");
              setSearchQuery("");
            }}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor}>
              Add Item
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