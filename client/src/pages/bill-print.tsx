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

  // ✅ FIXED: COMPLETE BILL DELETE FUNCTION
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      console.log("Deleting sale:", saleId);
      
      // Use the new sale delete endpoint that handles everything
      const response = await apiRequest("DELETE", `/api/sales/${saleId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sale");
      }
      
      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/suggestions"] });
      
      toast({ 
        title: "✅ Bill completely deleted", 
        description: "All items, payments, and records removed successfully" 
      });
      
      // Redirect to POS
      setTimeout(() => {
        window.location.href = "/pos";
      }, 1000);
      
    } catch (error: any) {
      console.error("Error deleting bill:", error);
      toast({ 
        title: "❌ Failed to delete bill", 
        description: error.message || "Please try again or check console for errors",
        variant: "destructive" 
      });
    }
  };

  // ✅ DIRECT PRINT FUNCTION (without print dialog)
  const printThermalDirect = () => {
    try {
      // Create a hidden iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const thermalContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt</title>
          <style>
            @media print {
              @page { 
                size: 80mm auto;
                margin: 0;
                padding: 0;
              }
              body { 
                margin: 0 !important;
                padding: 0 !important;
                width: 80mm !important;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                font-weight: bold;
                color: #000 !important;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-weight: bold;
                color: #000 !important;
              }
              .receipt-container {
                width: 80mm;
                padding: 8px 12px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                margin-bottom: 8px;
                border-bottom: 1px dashed #000;
                padding-bottom: 8px;
              }
              .business-name {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 2px;
              }
              .address {
                font-size: 10px;
                margin-bottom: 4px;
              }
              .dealer-info {
                font-size: 9px;
                margin-bottom: 4px;
              }
              .customer-info {
                margin: 8px 0;
                padding: 4px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
              }
              .items-table th {
                text-align: left;
                padding: 2px 0;
                border-bottom: 1px solid #000;
              }
              .items-table td {
                padding: 3px 0;
                vertical-align: top;
              }
              .item-name {
                font-size: 10px;
                line-height: 1.2;
              }
              .item-qty, .item-rate, .item-total {
                text-align: right;
                white-space: nowrap;
              }
              .totals {
                margin: 8px 0;
                padding: 8px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
              }
              .footer {
                text-align: center;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px dashed #000;
              }
              .thank-you {
                font-size: 10px;
                margin-top: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="business-name">${receiptSettings.businessName}</div>
              <div class="address">${receiptSettings.address}</div>
              <div class="dealer-info">${receiptSettings.dealerText}</div>
              <div class="dealer-info">${receiptSettings.dealerBrands}</div>
            </div>
            
            <div class="customer-info">
              <div><strong>Customer:</strong> ${sale?.customerName || ''}</div>
              <div><strong>Phone:</strong> ${sale?.customerPhone || ''}</div>
              <div><strong>Date:</strong> ${sale ? new Date(sale.createdAt).toLocaleDateString('en-GB') : ''}</div>
              <div><strong>Time:</strong> ${sale ? new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
              <div><strong>Bill No:</strong> ${sale?.id.slice(0, 8).toUpperCase() || ''}</div>
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="item-qty">Qty</th>
                  <th class="item-rate">Rate</th>
                  <th class="item-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale?.saleItems.map(item => `
                  <tr>
                    <td class="item-name">
                      ${item.color.variant.product.productName} - ${item.color.colorName}
                    </td>
                    <td class="item-qty">${item.quantity}</td>
                    <td class="item-rate">${Math.round(parseFloat(item.rate))}</td>
                    <td class="item-total">${Math.round(parseFloat(item.subtotal))}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>
            
            <div class="totals">
              <div class="total-row">
                <span>Sub Total:</span>
                <span>${sale ? Math.round(parseFloat(sale.totalAmount)) : 0}</span>
              </div>
              <div class="total-row">
                <span>Paid Amount:</span>
                <span>${sale ? Math.round(parseFloat(sale.amountPaid)) : 0}</span>
              </div>
              ${sale && parseFloat(sale.amountPaid) < parseFloat(sale.totalAmount) ? `
                <div class="total-row">
                  <span>Balance Due:</span>
                  <span>${Math.round(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid))}</span>
                </div>
              ` : ''}
              <div class="total-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #000;">
                <strong>Status:</strong>
                <strong>${sale?.paymentStatus.toUpperCase() || ''}</strong>
              </div>
            </div>
            
            <div class="footer">
              <div class="thank-you">${receiptSettings.thankYou}</div>
            </div>
          </div>
          
          <script>
            // Auto-print and close
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 100);
              }, 500);
            };
            
            // Fallback for browsers that block window.close()
            window.onafterprint = function() {
              setTimeout(function() {
                window.close();
              }, 100);
            };
          </script>
        </body>
        </html>
      `;

      const printDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (printDoc) {
        printDoc.open();
        printDoc.write(thermalContent);
        printDoc.close();
        
        // Fallback: If direct print doesn't work, show regular print dialog
        setTimeout(() => {
          if (!printFrame.contentWindow?.closed) {
            printFrame.contentWindow?.print();
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Direct print failed, falling back to regular print:", error);
      // Fallback to regular print
      window.print();
    }
  };

  // ✅ FIXED: ADD ITEM FUNCTION (with proper error handling)
  const handleAddItem = async () => {
    if (!selectedColor) {
      toast({ title: "❌ Please select a product", variant: "destructive" });
      return;
    }
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      toast({ title: "❌ Invalid quantity", variant: "destructive" });
      return;
    }

    try {
      const itemRate = parseFloat(selectedColor.variant.rate);
      const response = await apiRequest("POST", `/api/sales/${saleId}/items`, {
        colorId: selectedColor.id,
        quantity: qty,
        rate: itemRate,
        subtotal: itemRate * qty,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add item");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      
      toast({ title: "✅ Item added successfully" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    } catch (error: any) {
      console.error("Error adding item:", error);
      toast({ 
        title: "❌ Failed to add item", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
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
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
        toast({ title: "✅ All changes saved successfully" });
      } else {
        toast({ title: "ℹ️ No changes to save" });
      }

      setEditMode(false);
      setEditingItems({});
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "❌ Failed to save changes", variant: "destructive" });
    }
  };

  // Delete Individual Item
  const deleteItem = async (itemId: string, itemName: string) => {
    try {
      await apiRequest("DELETE", `/api/sale-items/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: `✅ ${itemName} deleted successfully` });

      // Remove from editing state if exists
      setEditingItems(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "❌ Failed to delete item", variant: "destructive" });
    }
  };

  // ✅ FIXED: FULL PRODUCT LIST WITHOUT LIMIT
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB");

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full max-w-2xl mx-auto" /></div>;
  if (!sale) return <div className="p-6 text-center text-muted-foreground">Bill not found</div>;

  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
  const isPaid = sale.paymentStatus === "paid";

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
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
            {/* ✅ DIRECT PRINT BUTTON */}
            <Button onClick={printThermalDirect} className="font-medium bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4 mr-2" />
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
              <h1 className="text-2xl font-bold">INVOICE</h1>
              <p className="text-xs mt-1">Bill No: {sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <strong>{sale.customerName}</strong></div>
              <div><span className="text-muted-foreground">Phone:</span> <strong>{sale.customerPhone}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> <strong>{new Date(sale.createdAt).toLocaleDateString("en-GB")}</strong></div>
              <div><span className="text-muted-foreground">Time:</span> <strong>{new Date(sale.createdAt).toLocaleTimeString()}</strong></div>
            </div>

            <div className="border-t pt-4">
              <h2 className="font-semibold mb-3 flex justify-between items-center">
                <span>Items ({sale.saleItems.length})</span>
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
                Thank you for your business!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <ThermalReceipt sale={sale} receiptSettings={receiptSettings} />

      {/* ✅ IMPROVED DELETE BILL DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Complete Bill?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All {sale?.saleItems.length} items from this bill</li>
                <li>Payment record of Rs. {sale ? Math.round(parseFloat(sale.amountPaid)) : 0}</li>
                <li>Customer information</li>
                <li>Complete sale history</li>
              </ul>
              <p className="mt-3 font-semibold text-red-600">This action cannot be undone!</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Complete Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ FIXED: ADD ITEM DIALOG WITH PROPER LAYOUT */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Item to Bill</DialogTitle>
            <DialogDescription>
              Select from complete product list ({filteredColors.length} products available)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 flex flex-col">
            <Input 
              placeholder="Search by product name, color, code, company..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="h-12 text-lg"
            />
            
            <div className="flex-1 overflow-y-auto border rounded-lg p-2">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredColors.map(c => (
                  <Card
                    key={c.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedColor?.id === c.id 
                        ? "border-2 border-blue-500 bg-blue-50" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setSelectedColor(c);
                      setQuantity("1");
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          {c.variant.product.productName} - {c.colorName} {c.colorCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {c.variant.product.company} • {c.variant.packingSize}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="font-mono">
                            Code: {c.colorCode}
                          </Badge>
                          <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                            Stock: {c.stockQuantity}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {filteredColors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No products found matching your search
                  </div>
                )}
              </div>
            </div>

            {/* ✅ FIXED: QUANTITY INPUT AND ADD BUTTON - ALWAYS VISIBLE WHEN PRODUCT SELECTED */}
            {selectedColor && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-lg font-semibold block mb-2">Selected Product</Label>
                    <p className="font-semibold text-gray-900">
                      {selectedColor.variant.product.productName} - {selectedColor.colorName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedColor.colorCode} • {selectedColor.variant.packingSize} • Rs. {Math.round(parseFloat(selectedColor.variant.rate))}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <Label htmlFor="quantity-input" className="block mb-2 font-medium">Quantity</Label>
                      <Input 
                        id="quantity-input"
                        type="number" 
                        min="1" 
                        value={quantity} 
                        onChange={e => setQuantity(e.target.value)}
                        className="text-center text-lg font-semibold h-12"
                      />
                    </div>
                    
                    <div className="w-32">
                      <Label className="block mb-2 font-medium">Total</Label>
                      <div className="h-12 flex items-center justify-center bg-white border border-gray-300 rounded-md text-lg font-bold text-blue-600">
                        Rs. {Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "1"))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    ✅ Zero stock allowed - You can add items even if stock is zero
                  </p>
                  
                  <Button 
                    onClick={handleAddItem} 
                    className="bg-blue-600 hover:bg-blue-700 h-12 px-8"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Item to Bill
                  </Button>
                </div>
              </div>
            )}

            {/* ✅ SHOW MESSAGE WHEN NO PRODUCT SELECTED */}
            {!selectedColor && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <p className="text-yellow-700 font-medium">
                  Please select a product from the list above to add to the bill
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => {
              setAddItemDialogOpen(false);
              setSelectedColor(null);
              setQuantity("1");
              setSearchQuery("");
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS */}
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