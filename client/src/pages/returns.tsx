"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDateFormat } from "@/hooks/use-date-format"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search,
  RotateCcw,
  Package,
  Minus,
  Plus,
  Loader2,
  CheckCircle,
  Ban,
  Info,
  Download,
} from "lucide-react"
import jsPDF from "jspdf"
import type { SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema"

interface QuickReturnForm {
  customerName: string
  customerPhone: string
  colorId: string
  quantity: number
  rate: number
  reason: string
  restoreStock: boolean
}

interface SaleItemWithReturn extends Omit<SaleItem, 'quantityReturned'> {
  quantityReturned?: number
  color: ColorWithVariantAndProduct
}

interface SaleWithItemsAndReturns extends Omit<SaleWithItems, "saleItems"> {
  saleItems: SaleItemWithReturn[]
}

export default function Returns() {
  const { toast } = useToast()
  const { formatDate, formatDateShort } = useDateFormat()
  const [searchPhone, setSearchPhone] = useState("")
  const [selectedSale, setSelectedSale] = useState<SaleWithItemsAndReturns | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithItems | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showQuickReturnDialog, setShowQuickReturnDialog] = useState(false)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [returnReason, setReturnReason] = useState("")
  const [returnType, setReturnType] = useState<"full" | "partial">("full")
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [restockItems, setRestockItems] = useState<Record<string, boolean>>({})

  // Quick return form state
  const [quickReturnForm, setQuickReturnForm] = useState<QuickReturnForm>({
    customerName: "",
    customerPhone: "",
    colorId: "",
    quantity: 1,
    rate: 0,
    reason: "",
    restoreStock: true,
  })

  const {
    data: returns = [],
    isLoading: returnsLoading,
    refetch: refetchReturns,
  } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  })

  const { data: sales = [], isLoading: salesLoading } = useQuery<SaleWithItemsAndReturns[]>({
    queryKey: ["/api/sales"],
  })

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  })

  const searchResults = useMemo(() => {
    if (!searchPhone.trim()) return []
    return sales.filter((sale) => {
      const matchesSearch =
        sale.customerPhone.includes(searchPhone) || sale.customerName.toLowerCase().includes(searchPhone.toLowerCase())

      if (!matchesSearch) return false

      // Check if sale has any items that can still be returned
      const hasReturnableItems = sale.saleItems?.some((item) => {
        const quantityReturned = item.quantityReturned || 0
        const availableToReturn = item.quantity - quantityReturned
        return availableToReturn > 0
      })

      return hasReturnableItems
    })
  }, [sales, searchPhone])

  const createReturnMutation = useMutation({
    mutationFn: async (data: { returnData: any; items: any[] }) => {
      const response = await apiRequest("POST", "/api/returns", data)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] })

      queryClient.refetchQueries({ queryKey: ["/api/colors"] })
      queryClient.refetchQueries({ queryKey: ["/api/sales"] })

      // Force immediate refetch for fresh data
      refetchReturns()

      setShowReturnDialog(false)
      setSelectedSale(null)
      setSelectedItems({})
      setRestockItems({})
      setReturnReason("")
      toast({
        title: "Return Processed",
        description: "Return has been successfully processed and stock has been updated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process return",
        variant: "destructive",
      })
    },
  })

  const quickReturnMutation = useMutation({
    mutationFn: async (data: QuickReturnForm) => {
      const response = await apiRequest("POST", "/api/returns/quick", data)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] })
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] })

      queryClient.refetchQueries({ queryKey: ["/api/colors"] })

      // Force immediate refetch for fresh data
      refetchReturns()

      setShowQuickReturnDialog(false)
      setQuickReturnForm({
        customerName: "",
        customerPhone: "",
        colorId: "",
        quantity: 1,
        rate: 0,
        reason: "",
        restoreStock: true,
      })
      toast({
        title: "Quick Return Processed",
        description: "Item has been returned successfully and stock has been updated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process quick return",
        variant: "destructive",
      })
    },
  })

  const isProcessing = createReturnMutation.isPending || quickReturnMutation.isPending

  const handleSelectSale = (sale: SaleWithItemsAndReturns) => {
    setSelectedSale(sale)
    setShowReturnDialog(true)
    setReturnType("full")
    setSelectedItems({})
    setRestockItems({})
    setReturnReason("")

    if (sale.saleItems) {
      const items: Record<string, number> = {}
      const restock: Record<string, boolean> = {}
      sale.saleItems.forEach((item) => {
        const quantityReturned = item.quantityReturned || 0
        const availableToReturn = item.quantity - quantityReturned
        if (availableToReturn > 0) {
          items[item.id] = availableToReturn
          restock[item.id] = true
        }
      })
      setSelectedItems(items)
      setRestockItems(restock)
    }
  }

  const handleItemQuantityChange = (itemId: string, maxAvailableQty: number, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0
      const newQty = Math.max(0, Math.min(maxAvailableQty, current + delta))
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
    setReturnType("partial")
  }

  const handleToggleRestock = (itemId: string) => {
    setRestockItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const handleSelectAllItems = () => {
    if (!selectedSale) return

    const items: Record<string, number> = {}
    const restock: Record<string, boolean> = {}

    selectedSale.saleItems?.forEach((item) => {
      const quantityReturned = item.quantityReturned || 0
      const availableToReturn = item.quantity - quantityReturned
      if (availableToReturn > 0) {
        items[item.id] = availableToReturn
        restock[item.id] = true
      }
    })

    setSelectedItems(items)
    setRestockItems(restock)
    setReturnType("full")
  }

  const handleDeselectAllItems = () => {
    setSelectedItems({})
    setRestockItems({})
    setReturnType("partial")
  }

  const handleSubmitReturn = () => {
    if (!selectedSale) return

    const itemsToReturn = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => {
        const saleItem = selectedSale.saleItems?.find((i) => i.id === itemId)
        if (!saleItem) return null

        // Validate quantity doesn't exceed available
        const quantityReturned = saleItem.quantityReturned || 0
        const availableToReturn = saleItem.quantity - quantityReturned
        if (quantity > availableToReturn) {
          toast({
            title: "Invalid Quantity",
            description: `Cannot return more than ${availableToReturn} units of ${formatItemDetails(saleItem)}`,
            variant: "destructive",
          })
          return null
        }

        return {
          colorId: saleItem.colorId,
          saleItemId: saleItem.id,
          quantity,
          rate: Number.parseFloat(saleItem.rate),
          subtotal: quantity * Number.parseFloat(saleItem.rate),
          stockRestored: restockItems[itemId] ?? true,
        }
      })
      .filter(Boolean)

    if (itemsToReturn.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Select at least one item to return",
        variant: "destructive",
      })
      return
    }

    const totalRefund = itemsToReturn.reduce((sum, item) => sum + (item?.subtotal || 0), 0)

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
    })
  }

  const handleQuickReturnSubmit = () => {
    if (!quickReturnForm.customerName || !quickReturnForm.customerPhone || !quickReturnForm.colorId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (quickReturnForm.quantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      })
      return
    }

    quickReturnMutation.mutate(quickReturnForm)
  }

  const handleColorSelect = (colorId: string) => {
    const selectedColor = colors.find((c) => c.id === colorId)
    if (selectedColor) {
      const rate = selectedColor.rateOverride
        ? Number.parseFloat(selectedColor.rateOverride)
        : Number.parseFloat(selectedColor.variant.rate)
      setQuickReturnForm((prev) => ({
        ...prev,
        colorId,
        rate,
      }))
    }
  }

  const formatItemDetails = (item: any) => {
    if (!item.color) return `Item #${item.colorId}`
    const color = item.color
    const variant = color.variant
    const product = variant?.product
    return `${product?.company || ""} ${product?.productName || ""} - ${variant?.packingSize || ""} - ${color.colorCode} ${color.colorName}`
  }

  const handleViewDetails = (returnRecord: ReturnWithItems) => {
    setSelectedReturn(returnRecord)
    setViewDetailsOpen(true)
  }

  const downloadReturnPDF = (returnRecord: ReturnWithItems) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 15
    let yPos = margin

    // Header
    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 30, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("RETURN DOCUMENT", pageWidth / 2, 12, { align: "center" })
    pdf.setFontSize(9)
    pdf.text("PaintPulse", pageWidth / 2, 20, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 40

    // Return Info
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("Return Details:", margin, yPos)
    yPos += 6

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Return ID: ${returnRecord.id.slice(0, 8).toUpperCase()}`, margin, yPos)
    yPos += 5
    pdf.text(`Date: ${formatDateShort(returnRecord.createdAt)}`, margin, yPos)
    yPos += 5
    pdf.text(`Status: ${returnRecord.status.toUpperCase()}`, margin, yPos)
    yPos += 5
    pdf.text(`Type: ${returnRecord.returnType === "full_bill" ? "FULL BILL RETURN" : "ITEM RETURN"}`, margin, yPos)
    yPos += 10

    // Customer Info
    pdf.setFont("helvetica", "bold")
    pdf.text("Customer Information:", margin, yPos)
    yPos += 6

    pdf.setFont("helvetica", "normal")
    pdf.text(`Name: ${returnRecord.customerName}`, margin, yPos)
    yPos += 5
    pdf.text(`Phone: ${returnRecord.customerPhone}`, margin, yPos)
    yPos += 10

    // Returned Items Table
    pdf.setFont("helvetica", "bold")
    pdf.text("Returned Items:", margin, yPos)
    yPos += 8

    // Table header
    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)

    pdf.text("Product", margin + 3, yPos + 5)
    pdf.text("Qty", margin + 70, yPos + 5)
    pdf.text("Rate", margin + 90, yPos + 5)
    pdf.text("Subtotal", pageWidth - margin - 20, yPos + 5, { align: "right" })
    yPos += 10

    pdf.setTextColor(0, 0, 0)

    // Table rows
    returnRecord.returnItems.forEach((item, index) => {
      if (yPos > 250) {
        pdf.addPage()
        yPos = margin
      }

      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255]
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")

      pdf.setFontSize(8)
      const productName = `${item.color.variant.product.productName} - ${item.color.colorName} (${item.color.colorCode})`
      pdf.text(productName.substring(0, 40), margin + 3, yPos + 5)
      pdf.text(item.quantity.toString(), margin + 70, yPos + 5)
      pdf.text(`Rs.${Math.round(Number.parseFloat(item.rate))}`, margin + 90, yPos + 5)
      pdf.text(`Rs.${Math.round(Number.parseFloat(item.subtotal))}`, pageWidth - margin - 3, yPos + 5, {
        align: "right",
      })

      yPos += 8
    })

    yPos += 10

    // Summary
    pdf.setFont("helvetica", "bold")
    pdf.text("Return Summary:", margin, yPos)
    yPos += 8

    pdf.setFont("helvetica", "normal")
    pdf.text(`Total Items Returned: ${returnRecord.returnItems.length}`, margin, yPos)
    yPos += 5
    pdf.text(`Total Refund Amount: Rs.${Math.round(Number.parseFloat(returnRecord.totalRefund || "0"))}`, margin, yPos)

    pdf.save(
      `Return-${returnRecord.id.slice(0, 8).toUpperCase()}-${formatDateShort(returnRecord.createdAt).replace(/\//g, "-")}.pdf`,
    )
    toast({
      title: "Return Document Downloaded",
      description: "PDF has been downloaded successfully.",
    })
  }

  const getAvailableToReturn = (item: SaleItemWithReturn) => {
    const quantityReturned = item.quantityReturned || 0
    return item.quantity - quantityReturned
  }

  return (
    <div className="glass-page p-6 space-y-6">
      <div className="glass-surface p-4">
        <h1 className="text-2xl font-bold tracking-tight">Returns Management</h1>
        <p className="text-muted-foreground">Process bill returns and quick item returns with stock restoration</p>
      </div>

      <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Search Bill Section */}
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
                    />
                  </div>
                  <Button onClick={() => setSearchPhone(searchPhone)} disabled={salesLoading}>
                    {salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Found Sales ({searchResults.length})</Label>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <div className="p-2 space-y-2">
                        {searchResults.map((sale) => {
                          const returnableItemsCount =
                            sale.saleItems?.filter((item) => {
                              const available = getAvailableToReturn(item)
                              return available > 0
                            }).length || 0

                          const totalReturnedItems =
                            sale.saleItems?.reduce((sum, item) => {
                              return sum + (item.quantityReturned || 0)
                            }, 0) || 0

                          return (
                            <Card
                              key={sale.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSelectSale(sale)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium truncate">{sale.customerName}</span>
                                      <Badge variant="outline" className="shrink-0">
                                        {sale.customerPhone}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {formatDate(new Date(sale.createdAt))} - {sale.saleItems?.length || 0} items
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      {totalReturnedItems > 0 && (
                                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                          <RotateCcw className="w-3 h-3 mr-1" />
                                          {totalReturnedItems} returned
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-green-50 text-green-700 border-green-200"
                                      >
                                        <Package className="w-3 h-3 mr-1" />
                                        {returnableItemsCount} can return
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-medium">
                                      Rs. {Number.parseFloat(sale.totalAmount).toLocaleString()}
                                    </div>
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
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
      </div>

      {/* Process Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Select items to return and specify quantities. Only fresh stock available for return is shown.
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
                  <p className="font-medium">Rs. {Number.parseFloat(selectedSale.totalAmount).toLocaleString()}</p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Items to Return</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllItems}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAllItems}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[280px] rounded-md border">
                <div className="p-2 space-y-2">
                  {selectedSale.saleItems?.map((item) => {
                    const returnQty = selectedItems[item.id] || 0
                    const isReturning = returnQty > 0
                    const quantityReturned = item.quantityReturned || 0
                    const availableToReturn = getAvailableToReturn(item)
                    const isFullyReturned = availableToReturn <= 0

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-md border ${
                          isFullyReturned
                            ? "bg-gray-100 border-gray-300 opacity-60"
                            : isReturning
                              ? "bg-destructive/5 border-destructive/30"
                              : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{formatItemDetails(item)}</p>
                            <p className="text-xs text-muted-foreground">
                              Rate: Rs. {Number.parseFloat(item.rate).toLocaleString()} x {item.quantity} = Rs.{" "}
                              {Number.parseFloat(item.subtotal).toLocaleString()}
                            </p>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {quantityReturned > 0 && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  {quantityReturned} already returned
                                </Badge>
                              )}
                              {!isFullyReturned && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {availableToReturn} available
                                </Badge>
                              )}
                              {isFullyReturned && (
                                <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Fully Returned
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => handleItemQuantityChange(item.id, availableToReturn, -1)}
                              disabled={returnQty === 0 || isFullyReturned}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span
                              className={`w-8 text-center text-sm font-medium ${isFullyReturned ? "text-gray-400" : ""}`}
                            >
                              {isFullyReturned ? "-" : returnQty}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => handleItemQuantityChange(item.id, availableToReturn, 1)}
                              disabled={returnQty >= availableToReturn || isFullyReturned}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {isReturning && !isFullyReturned && (
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
                              - Rs. {(returnQty * Number.parseFloat(item.rate)).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Items that have been previously returned show their status. You can only return the remaining
                  available quantity for each item.
                </p>
              </div>

              <div>
                <Label htmlFor="reason" className="text-sm font-medium">
                  Return Reason (Optional)
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Total Refund Amount</p>
                  <p className="text-xl font-bold text-destructive">
                    Rs.{" "}
                    {Object.entries(selectedItems)
                      .reduce((sum, [itemId, qty]) => {
                        const item = selectedSale.saleItems?.find((i) => i.id === itemId)
                        return sum + qty * Number.parseFloat(item?.rate || "0")
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
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReturn}
              disabled={isProcessing || Object.keys(selectedItems).length === 0}
              className={isProcessing ? "opacity-70 cursor-not-allowed" : ""}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Return Dialog */}
      <Dialog open={showQuickReturnDialog} onOpenChange={setShowQuickReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Item Return</DialogTitle>
            <DialogDescription>Return an item without referencing a specific bill</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quickCustomerName">Customer Name *</Label>
                <Input
                  id="quickCustomerName"
                  value={quickReturnForm.customerName}
                  onChange={(e) => setQuickReturnForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickCustomerPhone">Phone *</Label>
                <Input
                  id="quickCustomerPhone"
                  value={quickReturnForm.customerPhone}
                  onChange={(e) => setQuickReturnForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="Enter phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickColor">Select Product *</Label>
              <Select value={quickReturnForm.colorId} onValueChange={handleColorSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product to return" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.id} value={color.id}>
                      {color.variant.product.company} {color.variant.product.productName} - {color.variant.packingSize}{" "}
                      - {color.colorCode} {color.colorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quickQuantity">Quantity</Label>
                <Input
                  id="quickQuantity"
                  type="number"
                  min="1"
                  value={quickReturnForm.quantity}
                  onChange={(e) =>
                    setQuickReturnForm((p) => ({ ...p, quantity: Number.parseInt(e.target.value) || 1 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickRate">Rate (Rs.)</Label>
                <Input
                  id="quickRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickReturnForm.rate}
                  onChange={(e) => setQuickReturnForm((p) => ({ ...p, rate: Number.parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickReason">Reason (Optional)</Label>
              <Textarea
                id="quickReason"
                value={quickReturnForm.reason}
                onChange={(e) => setQuickReturnForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Enter reason for return"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="quickRestock"
                checked={quickReturnForm.restoreStock}
                onCheckedChange={(checked) => setQuickReturnForm((p) => ({ ...p, restoreStock: !!checked }))}
              />
              <Label htmlFor="quickRestock" className="cursor-pointer">
                <Package className="h-4 w-4 inline mr-1" />
                Restore to stock
              </Label>
            </div>

            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Refund</p>
              <p className="text-xl font-bold text-destructive">
                Rs. {(quickReturnForm.quantity * quickReturnForm.rate).toLocaleString()}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickReturnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickReturnSubmit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Return Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">Return ID</Label>
                  <p className="font-mono font-semibold">#{selectedReturn.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDate(new Date(selectedReturn.createdAt))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedReturn.customerName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedReturn.customerPhone}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge variant={selectedReturn.returnType === "full_bill" ? "destructive" : "secondary"}>
                    {selectedReturn.returnType === "full_bill" ? "Full Bill" : "Item Return"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={selectedReturn.status === "completed" ? "default" : "secondary"}>
                    {selectedReturn.status}
                  </Badge>
                </div>
              </div>

              {selectedReturn.reason && (
                <div className="p-3 rounded-md bg-muted/30">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <p className="text-sm">{selectedReturn.reason}</p>
                </div>
              )}

              <Separator />

              <div>
                <Label className="text-sm font-medium">Returned Items</Label>
                <ScrollArea className="h-[200px] mt-2 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.returnItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            {item.color.variant.product.productName} - {item.color.colorName} ({item.color.colorCode})
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">Rs.{Math.round(Number.parseFloat(item.rate))}</TableCell>
                          <TableCell className="text-right font-medium">
                            Rs.{Math.round(Number.parseFloat(item.subtotal))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-red-50 border border-red-200">
                <p className="font-medium text-red-700">Total Refund</p>
                <p className="text-xl font-bold text-red-700">
                  Rs.{Math.round(Number.parseFloat(selectedReturn.totalRefund || "0")).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
            {selectedReturn && (
              <Button onClick={() => downloadReturnPDF(selectedReturn)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
