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
  const [editingItems, setEditingItems] = useState<{ [key: number]: { quantity: string; rate: string } }>({});
  
  // Load receipt settings from localStorage
  const [receiptSettings, setReceiptSettings] = useState({
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS"
  });
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('posReceiptSettings');
      if (saved) {
        setReceiptSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
      // Keep default settings if parsing fails
    }
  }, []);

  const { data: sale, isLoading } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Delete Bill
  const deleteSale = async () => {
    if (!saleId) return;
    for (const item of sale?.saleItems || []) {
      await apiRequest("DELETE", `/api/sale-items/${item.id}`);
    }
    await apiRequest("DELETE", `/api/sales/${saleId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    toast({ title: "Bill deleted" });
    window.location.href = "/pos";
  };

  // Print Thermal
  const printThermal = () => {
    setTimeout(() => window.print(), 200);
  };

  // Add Item (Zero Stock Allowed)
  const handleAddItem = () => {
    if (!selectedColor) return toast({ title: "Select product", variant: "destructive" });
    const qty = parseInt(quantity);
    if (qty < 1) return toast({ title: "Invalid quantity", variant: "destructive" });

    const itemRate = parseFloat(selectedColor.variant.rate);
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
      setSearchQuery("");
    });
  };

  // Start Edit Mode
  const startEditMode = () => {
    if (!sale) return;

    const initialEditingState: { [key: number]: { quantity: string; rate: string } } = {};
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
  const updateEditingItem = (itemId: number, field: 'quantity' | 'rate', value: string) => {
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
  const deleteItem = async (itemId: number, itemName: string) => {
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

  // Helper: One Line Product Name (UPDATED TO INCLUDE PRODUCT NAME BEFORE COLOR CODE)
  const getProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Helper: Short Product Name for Receipt (UPDATED TO INCLUDE PRODUCT NAME)
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

            {!isPaid && (
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
            )}
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
              <div><span className="text-muted-foreground">Date:</span> <strong>{formatDate(sale.createdAt)}</strong></div>
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

      {/* PRINT ONLY: Thermal Receipt - UPDATED WITH PRODUCT NAME AND LARGER FONT FOR TOTALS */}
      <div className="hidden print:block font-mono text-xs leading-tight">
        <div className="w-[80mm] mx-auto bg-white" style={{padding: '8px 12px 12px 12px'}}>
          <div className="text-center">
            <h1 className="font-bold text-lg" style={{fontSize: '18px', fontWeight: 'bold', color: 'black'}}>{receiptSettings.businessName}</h1>
            <p style={{color: 'black', fontWeight: 'bold'}}>{receiptSettings.address}</p>
          </div>

          <div className="my-3 border-t border-dotted border-black pt-2" style={{color: 'black'}}>
            <p className="mt-2" style={{fontWeight: 'bold'}}>Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
            <p style={{fontWeight: 'bold'}}>{formatDate(sale.createdAt)} {new Date(sale.createdAt).toLocaleTimeString()}</p>
            <p style={{fontWeight: 'bold'}}>Customer: {sale.customerName}</p>
            <p style={{fontWeight: 'bold'}}>Phone: {sale.customerPhone}</p>
          </div>

          <table className="w-full border-collapse text-sm" style={{color: 'black', fontWeight: 'bold'}}>
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1 pr-1">Item</th>
                <th className="text-right py-1 px-2" style={{minWidth: '32px'}}>Qty</th>
                <th className="text-right py-1 px-2" style={{minWidth: '45px'}}>Price</th>
                <th className="text-right py-1 pl-2" style={{minWidth: '50px'}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.saleItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-200 last:border-none">
                  <td className="py-1 pr-1 align-top">
                    <div className="font-medium text-gray-900" style={{color: 'black', fontWeight: 'bold'}}>
                      {/* UPDATED: Show product name before color name */}
                      {item.color.variant.product.productName} - {item.color.colorName}
                    </div>
                    <div className="text-gray-500 text-xs" style={{color: 'black', fontWeight: 'bold'}}>
                      {item.color.colorCode} • {item.color.variant.packingSize}
                    </div>
                  </td>
                  <td className="text-right py-1 px-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '32px'}}>{item.quantity}</td>
                  <td className="text-right py-1 px-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '45px'}}>
                    {Math.round(parseFloat(item.rate))}
                  </td>
                  <td className="text-right font-semibold py-1 pl-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '50px'}}>
                    {Math.round(parseFloat(item.subtotal))}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Footer totals */}
            <tfoot>
              <tr className="border-t border-black font-semibold">
                <td className="py-2 text-left" style={{color: 'black', fontWeight: 'bold'}}>
                  {sale.saleItems.length} Item{sale.saleItems.length > 1 ? "s" : ""}
                </td>
                <td className="text-right py-2" style={{color: 'black', fontWeight: 'bold'}}>
                  {sale.saleItems.reduce((sum, i) => sum + i.quantity, 0)}
                </td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* UPDATED: Larger font size for totals */}
          <div style={{color: 'black', fontWeight: 'bold'}}>
            <div className="flex flex-col items-end text-right space-y-2 mt-3">
              <div className="flex justify-between w-48" style={{fontSize: '13px', fontWeight: 'bold'}}>
                <span className="font-bold w-24 text-right">Total:</span>
                <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between w-48" style={{fontSize: '13px', fontWeight: 'bold'}}>
                <span className="w-24 text-right">Paid:</span>
                <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {outstanding > 0 && (
                <div className="flex justify-between w-48 font-bold" style={{fontSize: '13px', fontWeight: 'bold'}}>
                  <span className="w-24 text-right">Balance:</span>
                  <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>{Math.round(outstanding)}</span>
                </div>
              )}
            </div>
          </div>

          {/* UPDATED FOOTER - Increased font size and bold ICI-DULUX */}
          <div className="text-center mt-4 border-t border-black pt-2" style={{color: 'black'}}>
            <p className="text-[11px] mt-1 font-bold uppercase" style={{fontSize: '11px', fontWeight: 'bold'}}>
              {receiptSettings.dealerText}
            </p>
            <p className="text-[12px] font-bold" style={{fontSize: '12px', fontWeight: 'bold'}}>
              {receiptSettings.dealerBrands}
            </p>
            <p className="text-[12px] mt-3 font-bold" style={{fontSize: '12px', fontWeight: 'bold', marginTop: '8px'}}>
              {receiptSettings.thankYou}
            </p>
          </div>
        </div>
      </div>

      {/* Delete Bill Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Bill?</DialogTitle></DialogHeader>
          <p>This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.map(c => (
              <Card
                key={c.id}
                className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "border-primary bg-accent" : ""}`}
                onClick={() => setSelectedColor(c)}
              >
                <div className="flex justify-between">
                  <div>
                    {/* UPDATED: Show product name before color name */}
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
            <div className="space-y-3">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
              <p className="text-xs text-muted-foreground">Zero stock allowed</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS - UPDATED FOR BETTER QUALITY */}
      <style jsx>{`
        @media print {
          @page { 
            size: 82mm auto;
            margin: 0; /* 🔥 No top/bottom/left/right margin */
          }
          body { 
            margin: 0;
            padding: 0; /* 🔥 No top padding either */
            font-family: 'Consolas', 'Lucida Console', 'Courier New', monospace;
            transform: scale(0.8);
            transform-origin: top left;
            width: 125%;
            font-size: 11px;
            font-weight: bold;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, dialog, button { 
            display: none !important; 
          }
          * {
            color: black !important;
            font-weight: bold;
          }
          table {
            font-weight: bold;
          }
        }
      `}</style>

    </>
  );
}
