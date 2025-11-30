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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  FileText,
  Package,
  Minus,
  Plus,
  Loader2,
  Eye,
  Download,
  User,
  Phone,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react"
import jsPDF from "jspdf"
import type { SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct } from "@shared/schema"

interface ReturnStats {
  totalReturns: number
  totalRefunded: number
  itemReturns: number
  billReturns: number
}

interface QuickReturnForm {
  customerName: string
  customerPhone: string
  colorId: string
  quantity: number
  rate: number
  reason: string
  restoreStock: boolean
}

export default function Returns() {
  const { toast } = useToast()
  const { formatDate, formatDateShort } = useDateFormat()
  const [activeTab, setActiveTab] = useState("bill")
  const [searchPhone, setSearchPhone] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null)
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

  const { data: sales = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales"],
  })

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  })

  const filteredReturns = useMemo(() => {
    return returns.filter(
      (ret) =>
        ret.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customerPhone.includes(searchQuery) ||
        ret.id.toLowerCase().includes(searchQuery),
    )
  }, [returns, searchQuery])

  const stats: ReturnStats = useMemo(() => {
    return {
      totalReturns: returns.length,
      totalRefunded: returns.reduce((sum, ret) => sum + Number.parseFloat(ret.totalRefund || "0"), 0),
      itemReturns: returns.filter((ret) => ret.returnType === "item").length,
      billReturns: returns.filter((ret) => ret.returnType === "full_bill").length,
    }
  }, [returns])

  const searchResults = useMemo(() => {
    if (!searchPhone.trim()) return []
    return sales.filter(
      (sale) =>
        sale.customerPhone.includes(searchPhone) || sale.customerName.toLowerCase().includes(searchPhone.toLowerCase()),
    )
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

  const handleSelectSale = (sale: SaleWithItems) => {
    setSelectedSale(sale)
    setShowReturnDialog(true)
    setReturnType("full")
    setSelectedItems({})
    setRestockItems({})
    setReturnReason("")

    // Pre-select all items for full return
    if (sale.saleItems) {
      const items: Record<string, number> = {}
      const restock: Record<string, boolean> = {}
      sale.saleItems.forEach((item) => {
        items[item.id] = item.quantity
        restock[item.id] = true
      })
      setSelectedItems(items)
      setRestockItems(restock)
    }
  }

  const handleItemQuantityChange = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0
      const newQty = Math.max(0, Math.min(maxQty, current + delta))
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
      items[item.id] = item.quantity
      restock[item.id] = true
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Returns Management</h1>
        <p className="text-muted-foreground">Process bill returns and quick item returns with stock restoration</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bill">
            <FileText className="w-4 h-4 mr-2" />
            Bill Returns
          </TabsTrigger>
          <TabsTrigger value="history">
            <AlertTriangle className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bill" className="space-y-4 mt-4">
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
                        {searchResults.map((sale) => (
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
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Return Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Item Return</CardTitle>
                <CardDescription>Return individual items without searching for a specific bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setShowQuickReturnDialog(true)} className="w-full" size="lg">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Open Quick Return Form
                </Button>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Return individual items without bill reference</p>
                  <p>• Automatic stock restoration</p>
                  <p>• Customer refund processing</p>
                  <p>• Complete return history tracking</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Returns</p>
                    <p className="text-2xl font-bold">{stats.totalReturns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <DollarSign className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Refunded</p>
                    <p className="text-2xl font-bold">Rs.{Math.round(stats.totalRefunded).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Item Returns</p>
                    <p className="text-2xl font-bold">{stats.itemReturns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <AlertTriangle className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bill Returns</p>
                    <p className="text-2xl font-bold">{stats.billReturns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, phone, or return ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchReturns()}
              disabled={returnsLoading}
              title="Refresh returns data"
            >
              <RotateCcw className={`h-4 w-4 ${returnsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Returns Table */}
          <Card>
            <CardHeader>
              <CardTitle>Return History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Return ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Refund Amount</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No returns found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReturns.map((ret) => (
                      <TableRow key={ret.id}>
                        <TableCell>{formatDateShort(ret.createdAt)}</TableCell>
                        <TableCell className="font-mono font-semibold">#{ret.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{ret.customerName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {ret.customerPhone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={ret.returnType === "full_bill" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {ret.returnType === "full_bill" ? "Full Bill" : "Item"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          Rs.{Math.round(Number.parseFloat(ret.totalRefund || "0")).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ret.returnItems.length} items</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ret.status === "completed" ? "default" : "secondary"} className="capitalize">
                            {ret.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(ret)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadReturnPDF(ret)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>Select items to return and specify quantities</DialogDescription>
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

              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-2">
                  {selectedSale.saleItems?.map((item) => {
                    const returnQty = selectedItems[item.id] || 0
                    const isReturning = returnQty > 0

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-md border ${isReturning ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{formatItemDetails(item)}</p>
                            <p className="text-xs text-muted-foreground">
                              Rate: Rs. {Number.parseFloat(item.rate).toLocaleString()} x {item.quantity} = Rs.{" "}
                              {Number.parseFloat(item.subtotal).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => handleItemQuantityChange(item.id, item.quantity, -1)}
                              disabled={returnQty === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{returnQty}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => handleItemQuantityChange(item.id, item.quantity, 1)}
                              disabled={returnQty >= item.quantity}
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
                              - Rs. {(returnQty * Number.parseFloat(item.rate)).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

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
              disabled={isProcessing}
              className={isProcessing ? "opacity-70 cursor-not-allowed" : ""}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Return...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Return Dialog - Full Page */}
      <Dialog open={showQuickReturnDialog} onOpenChange={setShowQuickReturnDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowQuickReturnDialog(false)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle>Quick Item Return</DialogTitle>
                <DialogDescription>Return individual items without bill reference</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={quickReturnForm.customerName}
                    onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Customer Phone *</Label>
                  <Input
                    id="customerPhone"
                    placeholder="Enter customer phone"
                    value={quickReturnForm.customerPhone}
                    onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Item Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="colorSelect">Select Item *</Label>
                  <Select onValueChange={handleColorSelect} value={quickReturnForm.colorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an item to return" />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map((color) => (
                        <SelectItem key={color.id} value={color.id}>
                          {color.variant.product.company} {color.variant.product.productName} -{" "}
                          {color.variant.packingSize} - {color.colorCode} {color.colorName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setQuickReturnForm((prev) => ({
                            ...prev,
                            quantity: Math.max(1, prev.quantity - 1),
                          }))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quickReturnForm.quantity}
                        onChange={(e) =>
                          setQuickReturnForm((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value) || 1 }))
                        }
                        className="text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setQuickReturnForm((prev) => ({
                            ...prev,
                            quantity: prev.quantity + 1,
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate (Rs.) *</Label>
                    <Input
                      id="rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={quickReturnForm.rate}
                      onChange={(e) =>
                        setQuickReturnForm((prev) => ({ ...prev, rate: Number.parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal (Rs.)</Label>
                    <Input
                      id="subtotal"
                      value={(quickReturnForm.quantity * quickReturnForm.rate).toFixed(2)}
                      readOnly
                      className="bg-muted font-semibold"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Return Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter reason for return..."
                    value={quickReturnForm.reason}
                    onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="restoreStock"
                    checked={quickReturnForm.restoreStock}
                    onCheckedChange={(checked) =>
                      setQuickReturnForm((prev) => ({ ...prev, restoreStock: checked as boolean }))
                    }
                  />
                  <Label htmlFor="restoreStock" className="cursor-pointer text-sm">
                    <div className="font-medium">Restore item to stock inventory</div>
                    <div className="text-muted-foreground">
                      This will add {quickReturnForm.quantity} units back to the stock quantity
                    </div>
                  </Label>
                </div>

                {/* Summary */}
                <div className="p-4 bg-blue-50 rounded-lg border">
                  <h3 className="font-semibold mb-2">Return Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Customer:</div>
                    <div className="font-medium">{quickReturnForm.customerName || "Not specified"}</div>

                    <div>Phone:</div>
                    <div className="font-medium">{quickReturnForm.customerPhone || "Not specified"}</div>

                    <div>Item:</div>
                    <div className="font-medium">
                      {quickReturnForm.colorId
                        ? colors.find((c) => c.id === quickReturnForm.colorId)?.colorName
                        : "Not selected"}
                    </div>

                    <div>Quantity:</div>
                    <div className="font-medium">{quickReturnForm.quantity} units</div>

                    <div>Refund Amount:</div>
                    <div className="font-bold text-red-600">
                      Rs. {(quickReturnForm.quantity * quickReturnForm.rate).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setQuickReturnForm({
                  customerName: "",
                  customerPhone: "",
                  colorId: "",
                  quantity: 1,
                  rate: 0,
                  reason: "",
                  restoreStock: true,
                })
              }}
            >
              Reset Form
            </Button>
            <Button
              onClick={handleQuickReturnSubmit}
              disabled={isProcessing}
              className={isProcessing ? "opacity-70 cursor-not-allowed" : ""}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Process Quick Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Details - #{selectedReturn?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6">
              {/* Return Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Return Date</p>
                  <p className="font-semibold">{formatDateShort(selectedReturn.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Return Type</p>
                  <p className="font-semibold">
                    {selectedReturn.returnType === "full_bill" ? "Full Bill Return" : "Item Return"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="capitalize">{selectedReturn.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Refund</p>
                  <p className="font-semibold text-red-600">
                    Rs.{Math.round(Number.parseFloat(selectedReturn.totalRefund || "0")).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{selectedReturn.customerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{selectedReturn.customerPhone}</p>
                  </div>
                </div>
              </div>

              {/* Original Sale Info */}
              {selectedReturn.sale && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Original Sale</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-blue-50 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Sale ID:</span>
                      <p className="font-mono font-semibold">#{selectedReturn.sale.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sale Date:</span>
                      <p className="font-medium">{formatDateShort(selectedReturn.sale.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <p className="font-medium">
                        Rs.{Math.round(Number.parseFloat(selectedReturn.sale.totalAmount)).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <p className="font-medium">
                        Rs.{Math.round(Number.parseFloat(selectedReturn.sale.amountPaid)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Returned Items */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Returned Items ({selectedReturn.returnItems.length})
                </h3>
                <div className="space-y-3">
                  {selectedReturn.returnItems.map((item) => {
                    const originalQty =
                      selectedReturn.sale.saleItems?.find((si) => si.colorId === item.colorId)?.quantity || 0
                    const remainingQty = originalQty - item.quantity

                    return (
                      <Card key={item.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold">{item.color.variant.product.productName}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.color.colorName} ({item.color.colorCode})
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Size: {item.color.variant.packingSize}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{item.quantity} units returned</Badge>
                              {item.stockRestored && (
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                  <CheckCircle className="h-3 w-3" />
                                  Stock Restored
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-2 rounded">
                            <div>
                              <span className="text-muted-foreground block text-xs">Original Qty</span>
                              <span className="font-semibold">{originalQty}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Returned</span>
                              <span className="font-semibold text-red-600">{item.quantity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Remaining</span>
                              <span className="font-semibold text-green-600">{remainingQty}</span>
                            </div>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Rate:</span>
                            <span className="font-mono">
                              Rs.{Math.round(Number.parseFloat(item.rate)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-semibold border-t pt-2">
                            <span>Refund Amount:</span>
                            <span className="text-red-600">
                              Rs.{Math.round(Number.parseFloat(item.subtotal)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Return Reason */}
              {selectedReturn.reason && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Return Reason</h3>
                  <p className="text-sm text-muted-foreground p-3 bg-yellow-50 rounded-lg">{selectedReturn.reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
            {selectedReturn && (
              <Button onClick={() => downloadReturnPDF(selectedReturn)}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
