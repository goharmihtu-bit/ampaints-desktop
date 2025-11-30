"use client"

import type React from "react"

// audit.tsx - COMPLETE VERSION WITH ALL TABS IMPLEMENTED
import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Search,
  Calendar,
  Package,
  TrendingUp,
  TrendingDown,
  Download,
  X,
  Lock,
  Settings,
  Eye,
  EyeOff,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Wallet,
  RotateCcw,
  Receipt,
  Database,
  Trash2,
  Edit,
  Cloud,
  Upload,
  Check,
  XCircle,
  Loader2,
  Users,
  Key,
  Cpu,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  IndianRupee,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDateFormat } from "@/hooks/use-date-format"
import { useReceiptSettings } from "@/hooks/use-receipt-settings"
import jsPDF from "jspdf"
import type {
  ColorWithVariantAndProduct,
  Sale,
  StockInHistory,
  Product,
  PaymentHistory,
  Return,
  Settings as AppSettings,
} from "@shared/schema"
import { format, startOfDay, endOfDay, isBefore, isAfter } from "date-fns"

interface StockInHistoryWithColor extends StockInHistory {
  color: ColorWithVariantAndProduct
}

interface StockOutItem {
  id: string
  saleId: string
  colorId: string
  quantity: number
  rate: string
  subtotal: string
  color: ColorWithVariantAndProduct
  sale: Sale
  soldAt: Date
  customerName: string
  customerPhone: string
}

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null
}

interface ConsolidatedCustomer {
  customerName: string
  customerPhone: string
  totalAmount: number
  totalPaid: number
  totalOutstanding: number
  sales: Sale[]
}

// Helper function to format phone number for WhatsApp
function formatPhoneForWhatsApp(phone: string): string | null {
  if (!phone) return null

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "")

  // Check if it's a valid Indian phone number (10 digits)
  if (cleaned.length === 10) {
    return `91${cleaned}`
  }

  // Check if it's already in international format
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned
  }

  return null
}

// Helper function to generate statement PDF blob
function generateStatementPDFBlob(customer: ConsolidatedCustomer): Blob {
  const pdf = new jsPDF()

  // Add basic statement content
  pdf.text(`Statement for ${customer.customerName}`, 20, 20)
  pdf.text(`Phone: ${customer.customerPhone}`, 20, 30)
  pdf.text(`Total Amount: Rs. ${Math.round(customer.totalAmount).toLocaleString()}`, 20, 40)
  pdf.text(`Total Paid: Rs. ${Math.round(customer.totalPaid).toLocaleString()}`, 20, 50)
  pdf.text(`Outstanding: Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}`, 20, 60)

  // Convert to blob
  const pdfBlob = pdf.output("blob")
  return pdfBlob
}

// Utility function to safely parse numbers
const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

// Utility function to round numbers for display
const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100
}

// Custom hook for authenticated API calls
function useAuditApiRequest() {
  const [auditToken, setAuditToken] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken")
    if (storedToken) {
      setAuditToken(storedToken)
    }
  }, [])

  const authenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = auditToken || sessionStorage.getItem("auditToken")
    if (!token) {
      throw new Error("No audit token available")
    }

    const headers = {
      "Content-Type": "application/json",
      "X-Audit-Token": token,
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Clear invalid token
      sessionStorage.removeItem("auditToken")
      sessionStorage.removeItem("auditVerified")
      setAuditToken(null)
      throw new Error("Authentication failed. Please re-enter your PIN.")
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    return response.json()
  }

  return { authenticatedRequest, auditToken, setAuditToken }
}

export default function Audit() {
  const { formatDateShort } = useDateFormat()
  const { receiptSettings } = useReceiptSettings()
  const { toast } = useToast()
  const { authenticatedRequest, auditToken, setAuditToken } = useAuditApiRequest()

  const [isVerified, setIsVerified] = useState(false)
  const [pinInput, setPinInput] = useState(["", "", "", ""])
  const [pinError, setPinError] = useState("")
  const [isDefaultPin, setIsDefaultPin] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(true)

  const [activeTab, setActiveTab] = useState("stock")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [movementTypeFilter, setMovementTypeFilter] = useState("all")

  // Settings Tabs State
  const [settingsTab, setSettingsTab] = useState("pin")
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)

  // Cloud Sync State
  const [cloudUrl, setCloudUrl] = useState("")
  const [showCloudUrl, setShowCloudUrl] = useState(false)
  const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "exporting" | "importing">("idle")
  const [lastExportCounts, setLastExportCounts] = useState<any>(null)
  const [lastImportCounts, setLastImportCounts] = useState<any>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [syncInterval, setSyncInterval] = useState(5) // minutes

  const { data: hasPin } = useQuery<{ hasPin: boolean; isDefault?: boolean }>({
    queryKey: ["/api/audit/has-pin"],
    enabled: !isVerified,
  })

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: isVerified,
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isVerified,
  })

  const { data: stockInHistory = [], isLoading: stockInLoading } = useQuery<StockInHistoryWithColor[]>({
    queryKey: ["/api/stock-in/history"],
    enabled: isVerified,
  })

  // Fixed stock out query with proper authentication
  const { data: stockOutHistory = [], isLoading: stockOutLoading } = useQuery<StockOutItem[]>({
    queryKey: ["/api/audit/stock-out", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/stock-out"),
  })

  const { data: allSales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: isVerified,
  })

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  })

  // Fixed unpaid bills query with proper authentication
  const { data: unpaidBills = [], isLoading: unpaidLoading } = useQuery<Sale[]>({
    queryKey: ["/api/audit/unpaid-bills", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/unpaid-bills"),
  })

  // Fixed payments query with proper authentication
  const { data: auditPayments = [], isLoading: auditPaymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/audit/payments", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/payments"),
  })

  // Fixed returns query with proper authentication
  const { data: auditReturns = [], isLoading: returnsLoading } = useQuery<Return[]>({
    queryKey: ["/api/audit/returns", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/returns"),
  })

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
  })

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: Partial<AppSettings>) => {
      const response = await apiRequest("PATCH", "/api/settings", permissions)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] })
      toast({
        title: "Permissions Updated",
        description: "Access control settings have been saved.",
      })
    },
    onError: () => {
      toast({
        title: "Failed to Update",
        description: "Could not save permission settings.",
        variant: "destructive",
      })
    },
  })

  const handlePermissionChange = (key: keyof AppSettings, value: boolean) => {
    updatePermissionsMutation.mutate({ [key]: value })
  }

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await fetch("/api/audit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "PIN verification failed")
      }
      return response.json()
    },
    onSuccess: (data: { ok: boolean; isDefault?: boolean; auditToken?: string }) => {
      if (data.ok && data.auditToken) {
        setIsVerified(true)
        setAuditToken(data.auditToken)
        setShowPinDialog(false)
        setIsDefaultPin(data.isDefault || false)
        setPinError("")
        if (data.isDefault) {
          toast({
            title: "Default PIN Used",
            description: "Please change your PIN in the Settings tab for security.",
            variant: "destructive",
          })
        }
        sessionStorage.setItem("auditVerified", "true")
        sessionStorage.setItem("auditToken", data.auditToken)
      }
    },
    onError: (error: Error) => {
      setPinError(error.message || "Invalid PIN. Please try again.")
      setPinInput(["", "", "", ""])
    },
  })

  const changePinMutation = useMutation({
    mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      const response = await fetch("/api/audit/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to change PIN")
      }
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "PIN Changed",
        description: "Your audit PIN has been successfully updated.",
      })
      setCurrentPin("")
      setNewPin("")
      setConfirmPin("")
      setIsDefaultPin(false)
      queryClient.invalidateQueries({ queryKey: ["/api/audit/has-pin"] })
    },
    onError: (error: Error) => {
      toast({
        title: "PIN Change Failed",
        description: error.message || "Failed to change PIN. Please check your current PIN.",
        variant: "destructive",
      })
    },
  })

  // Cloud Sync Functions - Fixed with proper authentication and error handling
  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter a PostgreSQL connection URL.",
        variant: "destructive",
      })
      return
    }

    try {
      new URL(cloudUrl)
    } catch {
      setCloudConnectionStatus("error")
      toast({
        title: "Invalid URL Format",
        description: "Please enter a valid PostgreSQL connection URL starting with 'postgresql://'",
        variant: "destructive",
      })
      return
    }

    setCloudConnectionStatus("testing")
    try {
      const data = await authenticatedRequest("/api/cloud/test-connection", {
        method: "POST",
        body: JSON.stringify({ connectionUrl: cloudUrl }),
      })

      if (data.ok) {
        setCloudConnectionStatus("success")
        toast({
          title: "Connection Successful",
          description: `Successfully connected to ${data.details?.provider || "cloud database"}`,
        })
      } else {
        setCloudConnectionStatus("error")
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to cloud database.",
          variant: "destructive",
        })
        console.log("[v0] Connection error details:", data.details)
      }
    } catch (error: any) {
      setCloudConnectionStatus("error")
      console.log("[v0] Connection error:", error)
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to cloud database.",
        variant: "destructive",
      })
    }
  }

  const handleSaveCloudSettings = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter a PostgreSQL connection URL first.",
        variant: "destructive",
      })
      return
    }

    try {
      const data = await authenticatedRequest("/api/cloud/save-settings", {
        method: "POST",
        body: JSON.stringify({
          connectionUrl: cloudUrl,
          syncEnabled: true,
          cloudSyncEnabled: autoSyncEnabled,
        }),
      })

      if (data.ok) {
        toast({
          title: "Settings Saved",
          description: "Cloud database settings saved successfully.",
        })
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] })
      }
    } catch (error: any) {
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save cloud settings.",
        variant: "destructive",
      })
    }
  }

  const handleExportToCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      })
      return
    }

    // First save settings if not already saved
    await handleSaveCloudSettings()

    setCloudSyncStatus("exporting")
    try {
      const data = await authenticatedRequest("/api/cloud/export", {
        method: "POST",
      })

      if (data.ok) {
        setLastExportCounts(data.counts)
        toast({
          title: "Export Successful",
          description: `Exported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales to cloud.`,
        })
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] })
      } else {
        toast({
          title: "Export Failed",
          description: data.error || "Could not export to cloud database.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description:
          error.message || "Could not export to cloud database. Please check your connection URL and try again.",
        variant: "destructive",
      })
    } finally {
      setCloudSyncStatus("idle")
    }
  }

  const handleImportFromCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      })
      return
    }

    // First save settings if not already saved
    await handleSaveCloudSettings()

    setCloudSyncStatus("importing")
    try {
      const data = await authenticatedRequest("/api/cloud/import", {
        method: "POST",
      })

      if (data.ok) {
        setLastImportCounts(data.counts)
        toast({
          title: "Import Successful",
          description: `Imported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales from cloud.`,
        })
        // Invalidate all data queries to refresh
        queryClient.invalidateQueries({ queryKey: ["/api/products"] })
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] })
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Could not import from cloud database.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Import error:", error)
      toast({
        title: "Import Failed",
        description:
          error.message || "Could not import from cloud database. Please check your connection URL and try again.",
        variant: "destructive",
      })
    } finally {
      setCloudSyncStatus("idle")
    }
  }

  // Auto-sync functions
  const toggleAutoSync = async (enabled: boolean) => {
    setAutoSyncEnabled(enabled)
    await handleSaveCloudSettings()

    if (enabled) {
      toast({
        title: "Auto-Sync Enabled",
        description: `Data will sync automatically every ${syncInterval} minutes.`,
      })
    } else {
      toast({
        title: "Auto-Sync Disabled",
        description: "Automatic synchronization has been turned off.",
      })
    }
  }

  const startAutoSync = () => {
    if (!autoSyncEnabled || cloudConnectionStatus !== "success" || !cloudUrl.trim()) {
      return
    }

    // Export every interval (bidirectional sync is better handled with user choice)
    const intervalId = setInterval(
      async () => {
        try {
          console.log("[Auto-Sync] Triggered")
          // Always export on auto-sync to keep cloud updated with local changes
          await handleExportToCloud()
        } catch (error) {
          console.error("[Auto-Sync] Error:", error)
          // Don't disable auto-sync, just log the error
        }
      },
      syncInterval * 60 * 1000,
    )

    return () => clearInterval(intervalId)
  }

  useEffect(() => {
    const cleanup = startAutoSync()
    return cleanup
  }, [autoSyncEnabled, syncInterval, cloudConnectionStatus, cloudUrl])

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken")
    const storedVerified = sessionStorage.getItem("auditVerified")

    if (storedVerified === "true" && storedToken) {
      setIsVerified(true)
      setAuditToken(storedToken)
      setShowPinDialog(false)
    }
  }, [])

  // Initialize cloud URL from settings when they load
  useEffect(() => {
    if (appSettings?.cloudDatabaseUrl && !cloudUrl) {
      setCloudUrl(appSettings.cloudDatabaseUrl)
      if (appSettings.cloudSyncEnabled) {
        setCloudConnectionStatus("success")
        setAutoSyncEnabled(true)
      }
    }
  }, [appSettings?.cloudDatabaseUrl, appSettings?.cloudSyncEnabled])

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPinInput = [...pinInput]
    newPinInput[index] = value.slice(-1)
    setPinInput(newPinInput)
    setPinError("")

    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`)
      nextInput?.focus()
    }

    if (index === 3 && value) {
      const fullPin = newPinInput.join("")
      if (fullPin.length === 4) {
        verifyPinMutation.mutate(fullPin)
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pinInput[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handlePinChange = () => {
    if (newPin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "New PIN and confirmation do not match.",
        variant: "destructive",
      })
      return
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      })
      return
    }

    changePinMutation.mutate({
      currentPin: currentPin || "0000",
      newPin: newPin,
    })
  }

  const companies = useMemo(() => {
    const uniqueCompanies = new Set(products.map((p) => p.company))
    return Array.from(uniqueCompanies).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    if (companyFilter === "all") return products
    return products.filter((p) => p.company === companyFilter)
  }, [products, companyFilter])

  const stockMovements = useMemo(() => {
    const movements: {
      id: string
      date: Date
      type: "IN" | "OUT"
      company: string
      product: string
      variant: string
      colorCode: string
      colorName: string
      quantity: number
      previousStock?: number
      newStock?: number
      reference: string
      customer?: string
      notes?: string
    }[] = []

    stockInHistory.forEach((record) => {
      movements.push({
        id: record.id,
        date: new Date(record.createdAt),
        type: "IN",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        previousStock: record.previousStock,
        newStock: record.newStock,
        reference: `Stock In: ${record.stockInDate}`,
        notes: record.notes || undefined,
      })
    })

    stockOutHistory.forEach((record) => {
      movements.push({
        id: record.id,
        date: new Date(record.soldAt),
        type: "OUT",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        reference: `Bill #${record.saleId.slice(0, 8).toUpperCase()}`,
        customer: record.customerName,
      })
    })

    return movements.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [stockInHistory, stockOutHistory])

  const filteredStockMovements = useMemo(() => {
    let filtered = [...stockMovements]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.colorCode.toLowerCase().includes(query) ||
          m.colorName.toLowerCase().includes(query) ||
          m.product.toLowerCase().includes(query) ||
          m.company.toLowerCase().includes(query) ||
          (m.customer && m.customer.toLowerCase().includes(query)),
      )
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom))
      filtered = filtered.filter((m) => !isBefore(m.date, fromDate))
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo))
      filtered = filtered.filter((m) => !isAfter(m.date, toDate))
    }

    if (companyFilter !== "all") {
      filtered = filtered.filter((m) => m.company === companyFilter)
    }

    if (productFilter !== "all") {
      filtered = filtered.filter((m) => m.product === productFilter)
    }

    if (movementTypeFilter !== "all") {
      filtered = filtered.filter((m) => m.type === movementTypeFilter)
    }

    return filtered
  }, [stockMovements, searchQuery, dateFrom, dateTo, companyFilter, productFilter, movementTypeFilter])

  const filteredSales = useMemo(() => {
    let filtered = [...allSales]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (sale) =>
          sale.customerName.toLowerCase().includes(query) ||
          sale.customerPhone.includes(query) ||
          sale.id.toLowerCase().includes(query),
      )
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom))
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.createdAt)
        return !isBefore(saleDate, fromDate)
      })
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo))
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.createdAt)
        return !isAfter(saleDate, toDate)
      })
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [allSales, searchQuery, dateFrom, dateTo])

  const stockSummary = useMemo(() => {
    const totalIn = stockInHistory.reduce((acc, r) => acc + r.quantity, 0)
    const totalOut = stockOutHistory.reduce((acc, r) => acc + r.quantity, 0)
    const currentStock = colors.reduce((acc, c) => acc + c.stockQuantity, 0)
    return { totalIn, totalOut, currentStock }
  }, [stockInHistory, stockOutHistory, colors])

  const salesSummary = useMemo(() => {
    const totalSales = allSales.reduce((acc, s) => acc + safeParseFloat(s.totalAmount), 0)
    const totalPaid = allSales.reduce((acc, s) => acc + safeParseFloat(s.amountPaid), 0)
    const totalOutstanding = Math.max(0, totalSales - totalPaid)
    const totalBills = allSales.length
    const paidBills = allSales.filter((s) => s.paymentStatus === "paid").length
    return {
      totalSales: roundNumber(totalSales),
      totalPaid: roundNumber(totalPaid),
      totalOutstanding: roundNumber(totalOutstanding),
      totalBills,
      paidBills,
    }
  }, [allSales])

  const paymentsSummary = useMemo(() => {
    const totalPayments = paymentHistory.reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    const cashPayments = paymentHistory
      .filter((p) => p.paymentMethod === "cash")
      .reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    const onlinePayments = paymentHistory
      .filter((p) => p.paymentMethod === "online")
      .reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    return {
      totalPayments: roundNumber(totalPayments),
      cashPayments: roundNumber(cashPayments),
      onlinePayments: roundNumber(onlinePayments),
    }
  }, [paymentHistory])

  const returnsSummary = useMemo(() => {
    const totalReturns = auditReturns.reduce((acc, r) => acc + safeParseFloat(r.totalRefund || "0"), 0)
    const totalItemsReturned = auditReturns.reduce((acc, r) => {
      // This would need to be calculated from return items in a real implementation
      return acc + 1 // Placeholder
    }, 0)
    return {
      totalReturns: roundNumber(totalReturns),
      totalItemsReturned,
    }
  }, [auditReturns])

  const clearFilters = () => {
    setSearchQuery("")
    setDateFrom("")
    setDateTo("")
    setCompanyFilter("all")
    setProductFilter("all")
    setMovementTypeFilter("all")
  }

  const hasActiveFilters =
    searchQuery ||
    dateFrom ||
    dateTo ||
    companyFilter !== "all" ||
    productFilter !== "all" ||
    movementTypeFilter !== "all"

  // PDF download functions
  const downloadStockAuditPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    let yPos = margin

    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" })
    pdf.setFontSize(12)
    pdf.text("STOCK AUDIT REPORT", pageWidth / 2, 18, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 35

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos)
    if (dateFrom || dateTo) {
      pdf.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, margin + 80, yPos)
    }
    yPos += 8

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F")
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text(`Total Stock In: ${stockSummary.totalIn}`, margin + 5, yPos + 10)
    pdf.text(`Total Stock Out: ${stockSummary.totalOut}`, margin + 70, yPos + 10)
    pdf.text(`Current Stock: ${stockSummary.currentStock}`, margin + 140, yPos + 10)
    pdf.text(`Net Movement: ${stockSummary.totalIn - stockSummary.totalOut}`, margin + 200, yPos + 10)
    yPos += 22

    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    const headers = ["Date", "Type", "Company", "Product", "Size", "Color", "Qty", "Reference", "Customer"]
    const colWidths = [25, 15, 35, 35, 25, 40, 15, 45, 40]
    let xPos = margin + 2
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5)
      xPos += colWidths[i]
    })
    yPos += 10
    pdf.setTextColor(0, 0, 0)

    const maxRows = Math.min(filteredStockMovements.length, 25)
    for (let i = 0; i < maxRows; i++) {
      const m = filteredStockMovements[i]
      if (yPos > pageHeight - 20) break

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")
      }

      pdf.setFontSize(7)
      xPos = margin + 2
      pdf.text(formatDateShort(m.date), xPos, yPos + 4)
      xPos += colWidths[0]

      if (m.type === "IN") {
        pdf.setTextColor(34, 197, 94)
      } else {
        pdf.setTextColor(239, 68, 68)
      }
      pdf.text(m.type, xPos, yPos + 4)
      xPos += colWidths[1]
      pdf.setTextColor(0, 0, 0)

      pdf.text(m.company.substring(0, 15), xPos, yPos + 4)
      xPos += colWidths[2]
      pdf.text(m.product.substring(0, 15), xPos, yPos + 4)
      xPos += colWidths[3]
      pdf.text(m.variant, xPos, yPos + 4)
      xPos += colWidths[4]
      pdf.text(`${m.colorCode} - ${m.colorName}`.substring(0, 20), xPos, yPos + 4)
      xPos += colWidths[5]
      pdf.text(m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`, xPos, yPos + 4)
      xPos += colWidths[6]
      pdf.text(m.reference.substring(0, 22), xPos, yPos + 4)
      xPos += colWidths[7]
      pdf.text((m.customer || "-").substring(0, 18), xPos, yPos + 4)
      yPos += 6
    }

    if (filteredStockMovements.length > maxRows) {
      pdf.setFontSize(8)
      pdf.text(`... and ${filteredStockMovements.length - maxRows} more records`, margin, yPos + 5)
    }

    pdf.save(`Stock-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)
    toast({ title: "PDF Downloaded", description: "Stock Audit Report has been downloaded." })
  }

  const downloadSalesAuditPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    let yPos = margin

    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" })
    pdf.setFontSize(12)
    pdf.text("SALES AUDIT REPORT", pageWidth / 2, 18, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 35

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos)
    pdf.text(`Total Sales: Rs. ${salesSummary.totalSales.toLocaleString()}`, margin + 80, yPos)
    pdf.text(`Total Bills: ${salesSummary.totalBills}`, margin + 160, yPos)
    yPos += 15

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F")
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text(`Total Amount: Rs. ${salesSummary.totalSales.toLocaleString()}`, margin + 5, yPos + 10)
    pdf.text(`Total Paid: Rs. ${salesSummary.totalPaid.toLocaleString()}`, margin + 70, yPos + 10)
    pdf.text(`Outstanding: Rs. ${salesSummary.totalOutstanding.toLocaleString()}`, margin + 140, yPos + 10)
    pdf.text(`Paid Bills: ${salesSummary.paidBills}/${salesSummary.totalBills}`, margin + 220, yPos + 10)
    yPos += 22

    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    const headers = ["Date", "Bill No", "Customer", "Phone", "Amount", "Paid", "Balance", "Status"]
    const colWidths = [25, 35, 50, 45, 30, 30, 30, 25]
    let xPos = margin + 2
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5)
      xPos += colWidths[i]
    })
    yPos += 10
    pdf.setTextColor(0, 0, 0)

    const maxRows = Math.min(filteredSales.length, 25)
    for (let i = 0; i < maxRows; i++) {
      const sale = filteredSales[i]
      if (yPos > pageHeight - 20) break

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")
      }

      pdf.setFontSize(7)
      xPos = margin + 2
      pdf.text(formatDateShort(new Date(sale.createdAt)), xPos, yPos + 4)
      xPos += colWidths[0]
      pdf.text(sale.id.slice(0, 8).toUpperCase(), xPos, yPos + 4)
      xPos += colWidths[1]
      pdf.text(sale.customerName.substring(0, 20), xPos, yPos + 4)
      xPos += colWidths[2]
      pdf.text(sale.customerPhone, xPos, yPos + 4)
      xPos += colWidths[3]
      pdf.text(`Rs. ${Math.round(safeParseFloat(sale.totalAmount)).toLocaleString()}`, xPos, yPos + 4)
      xPos += colWidths[4]
      pdf.text(`Rs. ${Math.round(safeParseFloat(sale.amountPaid)).toLocaleString()}`, xPos, yPos + 4)
      xPos += colWidths[5]
      pdf.text(
        `Rs. ${Math.round(safeParseFloat(sale.totalAmount) - safeParseFloat(sale.amountPaid)).toLocaleString()}`,
        xPos,
        yPos + 4,
      )
      xPos += colWidths[6]

      if (sale.paymentStatus === "paid") {
        pdf.setTextColor(34, 197, 94)
        pdf.text("Paid", xPos, yPos + 4)
      } else if (sale.paymentStatus === "partial") {
        pdf.setTextColor(245, 158, 11)
        pdf.text("Partial", xPos, yPos + 4)
      } else {
        pdf.setTextColor(239, 68, 68)
        pdf.text("Unpaid", xPos, yPos + 4)
      }
      pdf.setTextColor(0, 0, 0)
      yPos += 6
    }

    if (filteredSales.length > maxRows) {
      pdf.setFontSize(8)
      pdf.text(`... and ${filteredSales.length - maxRows} more records`, margin, yPos + 5)
    }

    pdf.save(`Sales-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)
    toast({ title: "PDF Downloaded", description: "Sales Audit Report has been downloaded." })
  }

  const downloadUnpaidPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    let yPos = margin

    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" })
    pdf.setFontSize(12)
    pdf.text("UNPAID BILLS REPORT", pageWidth / 2, 18, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 35

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos)
    pdf.text(`Total Unpaid Bills: ${unpaidBills.length}`, margin + 80, yPos)
    pdf.text(
      `Total Outstanding: Rs. ${Math.round(unpaidBills.reduce((acc, bill) => acc + (safeParseFloat(bill.totalAmount) - safeParseFloat(bill.amountPaid)), 0)).toLocaleString()}`,
      margin + 160,
      yPos,
    )
    yPos += 15

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text("Customer", margin + 5, yPos + 5)
    pdf.text("Phone", margin + 80, yPos + 5)
    pdf.text("Bill Amount", margin + 140, yPos + 5)
    pdf.text("Paid", margin + 190, yPos + 5)
    pdf.text("Outstanding", margin + 230, yPos + 5)
    pdf.text("Status", margin + 280, yPos + 5)
    yPos += 12

    const maxRows = Math.min(unpaidBills.length, 30)
    for (let i = 0; i < maxRows; i++) {
      const bill = unpaidBills[i]
      if (yPos > pageHeight - 20) break

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")
      }

      pdf.setFontSize(7)
      pdf.setTextColor(0, 0, 0)
      pdf.text(bill.customerName.substring(0, 25), margin + 5, yPos + 4)
      pdf.text(bill.customerPhone, margin + 80, yPos + 4)
      pdf.text(`Rs. ${Math.round(safeParseFloat(bill.totalAmount)).toLocaleString()}`, margin + 140, yPos + 4)
      pdf.text(`Rs. ${Math.round(safeParseFloat(bill.amountPaid)).toLocaleString()}`, margin + 190, yPos + 4)

      const outstanding = safeParseFloat(bill.totalAmount) - safeParseFloat(bill.amountPaid)
      pdf.setTextColor(239, 68, 68)
      pdf.text(`Rs. ${Math.round(outstanding).toLocaleString()}`, margin + 230, yPos + 4)

      pdf.setTextColor(0, 0, 0)
      if (bill.paymentStatus === "partial") {
        pdf.setTextColor(245, 158, 11)
        pdf.text("Partial", margin + 280, yPos + 4)
      } else {
        pdf.setTextColor(239, 68, 68)
        pdf.text("Unpaid", margin + 280, yPos + 4)
      }
      yPos += 6
    }

    if (unpaidBills.length > maxRows) {
      pdf.setFontSize(8)
      pdf.text(`... and ${unpaidBills.length - maxRows} more unpaid bills`, margin, yPos + 5)
    }

    pdf.save(`Unpaid-Bills-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)
    toast({ title: "PDF Downloaded", description: "Unpaid Bills Report has been downloaded." })
  }

  const downloadPaymentsPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    let yPos = margin

    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" })
    pdf.setFontSize(12)
    pdf.text("PAYMENTS AUDIT REPORT", pageWidth / 2, 18, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 35

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos)
    pdf.text(`Total Payments: Rs. ${paymentsSummary.totalPayments.toLocaleString()}`, margin + 80, yPos)
    pdf.text(
      `Cash: Rs. ${paymentsSummary.cashPayments.toLocaleString()} | Online: Rs. ${paymentsSummary.onlinePayments.toLocaleString()}`,
      margin + 160,
      yPos,
    )
    yPos += 15

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text("Date", margin + 5, yPos + 5)
    pdf.text("Customer", margin + 35, yPos + 5)
    pdf.text("Phone", margin + 90, yPos + 5)
    pdf.text("Amount", margin + 140, yPos + 5)
    pdf.text("Method", margin + 180, yPos + 5)
    pdf.text("Previous Balance", margin + 220, yPos + 5)
    pdf.text("New Balance", margin + 270, yPos + 5)
    yPos += 12

    const maxRows = Math.min(auditPayments.length, 30)
    for (let i = 0; i < maxRows; i++) {
      const payment = auditPayments[i]
      if (yPos > pageHeight - 20) break

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")
      }

      pdf.setFontSize(7)
      pdf.setTextColor(0, 0, 0)
      pdf.text(formatDateShort(new Date(payment.createdAt)), margin + 5, yPos + 4)
      pdf.text((payment.sale?.customerName || "N/A").substring(0, 20), margin + 35, yPos + 4)
      pdf.text(payment.customerPhone, margin + 90, yPos + 4)
      pdf.text(`Rs. ${Math.round(safeParseFloat(payment.amount)).toLocaleString()}`, margin + 140, yPos + 4)

      if (payment.paymentMethod === "cash") {
        pdf.setTextColor(34, 197, 94)
        pdf.text("Cash", margin + 180, yPos + 4)
      } else {
        pdf.setTextColor(59, 130, 246)
        pdf.text("Online", margin + 180, yPos + 4)
      }

      pdf.setTextColor(0, 0, 0)
      pdf.text(`Rs. ${Math.round(safeParseFloat(payment.previousBalance)).toLocaleString()}`, margin + 220, yPos + 4)
      pdf.text(`Rs. ${Math.round(safeParseFloat(payment.newBalance)).toLocaleString()}`, margin + 270, yPos + 4)
      yPos += 6
    }

    if (auditPayments.length > maxRows) {
      pdf.setFontSize(8)
      pdf.text(`... and ${auditPayments.length - maxRows} more payment records`, margin, yPos + 5)
    }

    pdf.save(`Payments-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)
    toast({ title: "PDF Downloaded", description: "Payments Audit Report has been downloaded." })
  }

  const downloadReturnsPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    let yPos = margin

    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" })
    pdf.setFontSize(12)
    pdf.text("RETURNS AUDIT REPORT", pageWidth / 2, 18, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 35

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos)
    pdf.text(`Total Returns: Rs. ${returnsSummary.totalReturns.toLocaleString()}`, margin + 80, yPos)
    pdf.text(`Total Items Returned: ${returnsSummary.totalItemsReturned}`, margin + 160, yPos)
    yPos += 15

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text("Date", margin + 5, yPos + 5)
    pdf.text("Customer", margin + 35, yPos + 5)
    pdf.text("Phone", margin + 90, yPos + 5)
    pdf.text("Refund Amount", margin + 140, yPos + 5)
    pdf.text("Type", margin + 190, yPos + 5)
    pdf.text("Reason", margin + 230, yPos + 5)
    pdf.text("Status", margin + 280, yPos + 5)
    yPos += 12

    const maxRows = Math.min(auditReturns.length, 30)
    for (let i = 0; i < maxRows; i++) {
      const returnItem = auditReturns[i]
      if (yPos > pageHeight - 20) break

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")
      }

      pdf.setFontSize(7)
      pdf.setTextColor(0, 0, 0)
      pdf.text(formatDateShort(new Date(returnItem.createdAt)), margin + 5, yPos + 4)
      pdf.text(returnItem.customerName.substring(0, 20), margin + 35, yPos + 4)
      pdf.text(returnItem.customerPhone, margin + 90, yPos + 4)
      pdf.text(
        `Rs. ${Math.round(safeParseFloat(returnItem.totalRefund || "0")).toLocaleString()}`,
        margin + 140,
        yPos + 4,
      )
      pdf.text(returnItem.returnType === "item" ? "Item Return" : "Full Return", margin + 190, yPos + 4)
      pdf.text((returnItem.reason || "N/A").substring(0, 25), margin + 230, yPos + 4)

      if (returnItem.status === "completed") {
        pdf.setTextColor(34, 197, 94)
        pdf.text("Completed", margin + 280, yPos + 4)
      } else {
        pdf.setTextColor(245, 158, 11)
        pdf.text("Pending", margin + 280, yPos + 4)
      }
      yPos += 6
    }

    if (auditReturns.length > maxRows) {
      pdf.setFontSize(8)
      pdf.text(`... and ${auditReturns.length - maxRows} more return records`, margin, yPos + 5)
    }

    pdf.save(`Returns-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)
    toast({ title: "PDF Downloaded", description: "Returns Audit Report has been downloaded." })
  }

  if (showPinDialog) {
    return (
      <Dialog open={showPinDialog} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          aria-describedby="pin-dialog-description"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center text-xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Audit PIN Verification
            </DialogTitle>
            <DialogDescription id="pin-dialog-description" className="text-center">
              Enter your 4-digit PIN to access Audit Reports
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {hasPin && !hasPin.hasPin && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Default PIN is <strong>0000</strong>. Please change it after login.
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  data-testid={`input-pin-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={pinInput[index]}
                  onChange={(e) => handlePinInput(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-14 h-14 text-center text-2xl font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus={index === 0}
                  autoComplete="off"
                />
              ))}
            </div>

            {pinError && <p className="text-center text-sm text-destructive">{pinError}</p>}

            {verifyPinMutation.isPending && (
              <div className="flex justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const isLoading =
    colorsLoading ||
    stockInLoading ||
    stockOutLoading ||
    salesLoading ||
    paymentsLoading ||
    unpaidLoading ||
    auditPaymentsLoading ||
    returnsLoading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit Reports</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48"
              data-testid="input-audit-search"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
              data-testid="input-date-to"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4">
          <TabsList className="h-12 flex-wrap">
            <TabsTrigger value="stock" className="flex items-center gap-2" data-testid="tab-stock-audit">
              <Package className="h-4 w-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="tab-sales-audit">
              <BarChart3 className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="unpaid" className="flex items-center gap-2" data-testid="tab-unpaid-audit">
              <CreditCard className="h-4 w-4" />
              Unpaid Bills
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2" data-testid="tab-payments-audit">
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex items-center gap-2" data-testid="tab-returns-audit">
              <RotateCcw className="h-4 w-4" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-audit-settings">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* STOCK AUDIT TAB */}
        <TabsContent value="stock" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  Total Stock In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockSummary.totalIn}</div>
                <p className="text-xs text-muted-foreground">Units added to stock</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  Total Stock Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockSummary.totalOut}</div>
                <p className="text-xs text-muted-foreground">Units sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Current Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockSummary.currentStock}</div>
                <p className="text-xs text-muted-foreground">Available units</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  Net Movement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockSummary.totalIn - stockSummary.totalOut}</div>
                <p className="text-xs text-muted-foreground">Stock change</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Stock Movement History
                </div>
                <div className="flex items-center gap-2">
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.productName}>
                          {product.productName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="IN">Stock In</SelectItem>
                      <SelectItem value="OUT">Stock Out</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={downloadStockAuditPDF} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Customer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No stock movements found for the selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStockMovements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="font-medium">{formatDateShort(movement.date)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={movement.type === "IN" ? "default" : "destructive"}
                                className="flex items-center gap-1 w-16 justify-center"
                              >
                                {movement.type === "IN" ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {movement.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{movement.company}</TableCell>
                            <TableCell>{movement.product}</TableCell>
                            <TableCell>{movement.variant}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded border"
                                  style={{
                                    backgroundColor:
                                      movement.colorCode === "WHITE"
                                        ? "#f3f4f6"
                                        : movement.colorCode === "BLACK"
                                          ? "#000"
                                          : `#${movement.colorCode}`,
                                  }}
                                />
                                {movement.colorCode} - {movement.colorName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div
                                className={`flex items-center gap-1 ${movement.type === "IN" ? "text-green-600" : "text-red-600"}`}
                              >
                                {movement.type === "IN" ? "+" : "-"}
                                {movement.quantity}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{movement.reference}</TableCell>
                            <TableCell>{movement.customer || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALES AUDIT TAB */}
        <TabsContent value="sales" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-green-500" />
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {salesSummary.totalSales.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All time revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-500" />
                  Total Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {salesSummary.totalPaid.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount received</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-orange-500" />
                  Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {salesSummary.totalOutstanding.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Pending payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-purple-500" />
                  Total Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesSummary.totalBills}</div>
                <p className="text-xs text-muted-foreground">
                  {salesSummary.paidBills} paid, {salesSummary.totalBills - salesSummary.paidBills} unpaid
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Sales History
                </div>
                <Button onClick={downloadSalesAuditPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bill No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No sales found for the selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSales.map((sale) => {
                          const balance = safeParseFloat(sale.totalAmount) - safeParseFloat(sale.amountPaid)
                          return (
                            <TableRow key={sale.id}>
                              <TableCell className="font-medium">{formatDateShort(new Date(sale.createdAt))}</TableCell>
                              <TableCell className="font-mono text-sm">{sale.id.slice(0, 8).toUpperCase()}</TableCell>
                              <TableCell>{sale.customerName}</TableCell>
                              <TableCell>{sale.customerPhone}</TableCell>
                              <TableCell>Rs. {Math.round(safeParseFloat(sale.totalAmount)).toLocaleString()}</TableCell>
                              <TableCell>Rs. {Math.round(safeParseFloat(sale.amountPaid)).toLocaleString()}</TableCell>
                              <TableCell>
                                <span className={balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                                  Rs. {Math.round(balance).toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    sale.paymentStatus === "paid"
                                      ? "default"
                                      : sale.paymentStatus === "partial"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {sale.paymentStatus === "paid"
                                    ? "Paid"
                                    : sale.paymentStatus === "partial"
                                      ? "Partial"
                                      : "Unpaid"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* UNPAID BILLS TAB */}
        <TabsContent value="unpaid" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-red-500" />
                  Total Unpaid Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unpaidBills.length}</div>
                <p className="text-xs text-muted-foreground">Pending bills</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-orange-500" />
                  Total Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rs.{" "}
                  {Math.round(
                    unpaidBills.reduce(
                      (acc, bill) => acc + (safeParseFloat(bill.totalAmount) - safeParseFloat(bill.amountPaid)),
                      0,
                    ),
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Amount pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-purple-500" />
                  Average Per Bill
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rs.{" "}
                  {unpaidBills.length > 0
                    ? Math.round(
                        unpaidBills.reduce(
                          (acc, bill) => acc + (safeParseFloat(bill.totalAmount) - safeParseFloat(bill.amountPaid)),
                          0,
                        ) / unpaidBills.length,
                      ).toLocaleString()
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground">Average outstanding</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Unpaid Bills
                </div>
                <Button onClick={downloadUnpaidPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unpaidLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Bill Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidBills.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No unpaid bills found. Great job!
                          </TableCell>
                        </TableRow>
                      ) : (
                        unpaidBills.map((bill) => {
                          const outstanding = safeParseFloat(bill.totalAmount) - safeParseFloat(bill.amountPaid)
                          return (
                            <TableRow key={bill.id}>
                              <TableCell className="font-medium">{bill.customerName}</TableCell>
                              <TableCell>{bill.customerPhone}</TableCell>
                              <TableCell>Rs. {Math.round(safeParseFloat(bill.totalAmount)).toLocaleString()}</TableCell>
                              <TableCell>Rs. {Math.round(safeParseFloat(bill.amountPaid)).toLocaleString()}</TableCell>
                              <TableCell>
                                <span className="text-red-600 font-medium">
                                  Rs. {Math.round(outstanding).toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={bill.paymentStatus === "partial" ? "secondary" : "destructive"}>
                                  {bill.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDateShort(new Date(bill.createdAt))}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS AUDIT TAB */}
        <TabsContent value="payments" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-green-500" />
                  Total Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {paymentsSummary.totalPayments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All payments received</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-500" />
                  Cash Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {paymentsSummary.cashPayments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cash transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                  Online Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {paymentsSummary.onlinePayments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Digital transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  Payment Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auditPayments.length}</div>
                <p className="text-xs text-muted-foreground">Total payment entries</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Payment History
                </div>
                <Button onClick={downloadPaymentsPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditPaymentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Previous Balance</TableHead>
                        <TableHead>New Balance</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No payment records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {formatDateShort(new Date(payment.createdAt))}
                            </TableCell>
                            <TableCell>{payment.sale?.customerName || "N/A"}</TableCell>
                            <TableCell>{payment.customerPhone}</TableCell>
                            <TableCell className="text-green-600 font-medium">
                              Rs. {Math.round(safeParseFloat(payment.amount)).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={payment.paymentMethod === "cash" ? "default" : "secondary"}>
                                {payment.paymentMethod === "cash" ? "Cash" : "Online"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              Rs. {Math.round(safeParseFloat(payment.previousBalance)).toLocaleString()}
                            </TableCell>
                            <TableCell>Rs. {Math.round(safeParseFloat(payment.newBalance)).toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                              {payment.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RETURNS AUDIT TAB */}
        <TabsContent value="returns" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-orange-500" />
                  Total Returns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auditReturns.length}</div>
                <p className="text-xs text-muted-foreground">Return transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-red-500" />
                  Total Refund Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {returnsSummary.totalReturns.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount refunded</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-500" />
                  Items Returned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{returnsSummary.totalItemsReturned}</div>
                <p className="text-xs text-muted-foreground">Total items returned</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Returns History
                </div>
                <Button onClick={downloadReturnsPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Refund Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No return records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditReturns.map((returnItem) => (
                          <TableRow key={returnItem.id}>
                            <TableCell className="font-medium">
                              {formatDateShort(new Date(returnItem.createdAt))}
                            </TableCell>
                            <TableCell>{returnItem.customerName}</TableCell>
                            <TableCell>{returnItem.customerPhone}</TableCell>
                            <TableCell className="text-red-600 font-medium">
                              Rs. {Math.round(safeParseFloat(returnItem.totalRefund || "0")).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {returnItem.returnType === "item" ? "Item Return" : "Full Return"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-48 truncate">
                              {returnItem.reason || "No reason provided"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={returnItem.status === "completed" ? "default" : "secondary"}>
                                {returnItem.status === "completed" ? "Completed" : "Pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB - COMPLETELY REORGANIZED WITH SEPARATE TABS */}
        <TabsContent value="settings" className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto">
            <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
              <TabsList className="grid grid-cols-4 mb-6">
                <TabsTrigger value="pin" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  PIN Settings
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger value="cloud" className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Cloud Sync
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  System
                </TabsTrigger>
              </TabsList>

              {/* PIN SETTINGS TAB */}
              <TabsContent value="pin" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Audit PIN
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isDefaultPin && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          You are using the default PIN. Please change it for security.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="currentPin">Current PIN</Label>
                      <div className="relative">
                        <Input
                          id="currentPin"
                          type={showCurrentPin ? "text" : "password"}
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value)}
                          placeholder={isDefaultPin ? "Default: 0000" : "Enter current PIN"}
                          maxLength={4}
                          data-testid="input-current-pin"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowCurrentPin(!showCurrentPin)}
                        >
                          {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPin">New PIN</Label>
                      <div className="relative">
                        <Input
                          id="newPin"
                          type={showNewPin ? "text" : "password"}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="Enter new 4-digit PIN"
                          maxLength={4}
                          data-testid="input-new-pin"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowNewPin(!showNewPin)}
                        >
                          {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPin">Confirm New PIN</Label>
                      <div className="relative">
                        <Input
                          id="confirmPin"
                          type={showConfirmPin ? "text" : "password"}
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value)}
                          placeholder="Confirm new PIN"
                          maxLength={4}
                          data-testid="input-confirm-pin"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowConfirmPin(!showConfirmPin)}
                        >
                          {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handlePinChange}
                      className="w-full"
                      disabled={changePinMutation.isPending}
                      data-testid="button-change-pin"
                    >
                      {changePinMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4 mr-2" />
                      )}
                      Change PIN
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        PIN is encrypted and stored securely
                      </p>
                      <p className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Audit access expires when browser tab is closed
                      </p>
                      <p className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Default PIN is 0000 - change it immediately after first login
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PERMISSIONS TAB */}
              <TabsContent value="permissions" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Access Control Permissions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Control which actions are allowed in the application. Disabled actions will be hidden throughout
                      the software.
                    </p>

                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4" />
                          Stock Management
                        </h4>
                        <div className="space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-blue-500" />
                                Edit Products/Variants/Colors
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow editing stock items</p>
                            </div>
                            <Switch
                              checked={appSettings?.permStockEdit ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permStockEdit", checked)}
                              data-testid="switch-perm-stock-edit"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-red-500" />
                                Delete Products/Variants/Colors
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow deleting stock items</p>
                            </div>
                            <Switch
                              checked={appSettings?.permStockDelete ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permStockDelete", checked)}
                              data-testid="switch-perm-stock-delete"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-red-500" />
                                Delete Stock History
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow deleting stock in/out history</p>
                            </div>
                            <Switch
                              checked={appSettings?.permStockHistoryDelete ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permStockHistoryDelete", checked)}
                              data-testid="switch-perm-stock-history-delete"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-b pb-3">
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <Receipt className="h-4 w-4" />
                          Sales / Bills
                        </h4>
                        <div className="space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-blue-500" />
                                Edit Bills
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow editing sales bills</p>
                            </div>
                            <Switch
                              checked={appSettings?.permSalesEdit ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permSalesEdit", checked)}
                              data-testid="switch-perm-sales-edit"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-red-500" />
                                Delete Bills
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow deleting sales bills</p>
                            </div>
                            <Switch
                              checked={appSettings?.permSalesDelete ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permSalesDelete", checked)}
                              data-testid="switch-perm-sales-delete"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-b pb-3">
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4" />
                          Payments
                        </h4>
                        <div className="space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-blue-500" />
                                Edit Payments
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow editing payment records</p>
                            </div>
                            <Switch
                              checked={appSettings?.permPaymentEdit ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permPaymentEdit", checked)}
                              data-testid="switch-perm-payment-edit"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-red-500" />
                                Delete Payments
                              </Label>
                              <p className="text-xs text-muted-foreground">Allow deleting payment records</p>
                            </div>
                            <Switch
                              checked={appSettings?.permPaymentDelete ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permPaymentDelete", checked)}
                              data-testid="switch-perm-payment-delete"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <Database className="h-4 w-4" />
                          System Access
                        </h4>
                        <div className="space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-purple-500" />
                                Database Access
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Access database tab in settings (requires PIN)
                              </p>
                            </div>
                            <Switch
                              checked={appSettings?.permDatabaseAccess ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permDatabaseAccess", checked)}
                              data-testid="switch-perm-database-access"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CLOUD SYNC TAB */}
              <TabsContent value="cloud" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-blue-500" />
                      Cloud Database Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground" id="cloud-description">
                      Connect to a cloud PostgreSQL database (Neon, Supabase) to sync your data across multiple devices.
                    </p>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cloudUrl" className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          PostgreSQL Connection URL
                        </Label>
                        <div className="relative">
                          <Input
                            id="cloudUrl"
                            type={showCloudUrl ? "text" : "password"}
                            value={cloudUrl}
                            onChange={(e) => {
                              setCloudUrl(e.target.value)
                              setCloudConnectionStatus("idle")
                            }}
                            placeholder="postgresql://user:password@host/database"
                            className="pr-20"
                            data-testid="input-cloud-url"
                          />
                          <div className="absolute right-0 top-0 flex">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowCloudUrl(!showCloudUrl)}
                            >
                              {showCloudUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            {cloudConnectionStatus === "success" && (
                              <div className="flex items-center text-green-500 pr-2">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                            {cloudConnectionStatus === "error" && (
                              <div className="flex items-center text-red-500 pr-2">
                                <XCircle className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get your connection URL from Neon (neon.tech) or Supabase (supabase.com)
                        </p>
                      </div>

                      <Button
                        onClick={handleTestConnection}
                        variant="outline"
                        className="w-full bg-transparent"
                        disabled={cloudConnectionStatus === "testing" || !cloudUrl.trim()}
                        data-testid="button-test-connection"
                        aria-label="Test connection to cloud database"
                        aria-describedby="cloud-description"
                      >
                        {cloudConnectionStatus === "testing" ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : cloudConnectionStatus === "success" ? (
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                        ) : cloudConnectionStatus === "error" ? (
                          <XCircle className="h-4 w-4 mr-2 text-red-500" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        {cloudConnectionStatus === "testing"
                          ? "Testing..."
                          : cloudConnectionStatus === "success"
                            ? "Connected"
                            : cloudConnectionStatus === "error"
                              ? "Connection Failed - Retry"
                              : "Test Connection"}
                      </Button>

                      {/* Auto-Sync Settings */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Auto-Sync Settings
                        </h4>

                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              {autoSyncEnabled ? (
                                <Wifi className="h-4 w-4 text-green-500" />
                              ) : (
                                <WifiOff className="h-4 w-4 text-gray-500" />
                              )}
                              Automatic Cloud Sync
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {autoSyncEnabled
                                ? `Syncing every ${syncInterval} minute${syncInterval !== 1 ? "s" : ""}`
                                : "Manual sync only"}
                            </p>
                          </div>
                          <Switch
                            checked={autoSyncEnabled}
                            onCheckedChange={toggleAutoSync}
                            disabled={cloudConnectionStatus !== "success"}
                          />
                        </div>

                        {autoSyncEnabled && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Label htmlFor="syncInterval" className="flex items-center gap-2 mb-2">
                              <RefreshCw className="h-4 w-4" />
                              Sync Interval (Minutes)
                            </Label>
                            <div className="flex items-center gap-3">
                              <Input
                                id="syncInterval"
                                type="number"
                                min="1"
                                max="60"
                                value={syncInterval}
                                onChange={(e) => setSyncInterval(Number(e.target.value))}
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">
                                {syncInterval === 1 ? "minute" : "minutes"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Manual Sync Actions
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={handleExportToCloud}
                            variant="default"
                            disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
                            className="flex items-center gap-2"
                            data-testid="button-export-cloud"
                          >
                            {cloudSyncStatus === "exporting" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {cloudSyncStatus === "exporting" ? "Exporting..." : "Export to Cloud"}
                          </Button>

                          <Button
                            onClick={handleImportFromCloud}
                            variant="outline"
                            disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
                            className="flex items-center gap-2 bg-transparent"
                            data-testid="button-import-cloud"
                          >
                            {cloudSyncStatus === "importing" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {cloudSyncStatus === "importing" ? "Importing..." : "Import from Cloud"}
                          </Button>
                        </div>

                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <Upload className="h-3 w-3" />
                            <strong>Export:</strong> Sends your local data to cloud (overwrites cloud data)
                          </p>
                          <p className="flex items-center gap-2">
                            <Download className="h-3 w-3" />
                            <strong>Import:</strong> Downloads cloud data to local (overwrites local data)
                          </p>
                        </div>

                        {/* Add provider detection in the UI to show which provider is connected */}
                        {appSettings?.lastSyncTime && (
                          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs text-muted-foreground">
                            <p>Last Sync: {format(new Date(appSettings.lastSyncTime), "dd/MM/yyyy HH:mm:ss")}</p>
                            {cloudConnectionStatus === "success" && cloudUrl && (
                              <p className="mt-1 text-green-600 dark:text-green-400">
                                Connected to: {cloudUrl.includes("supabase") ? "Supabase" : "Neon"}
                              </p>
                            )}
                          </div>
                        )}

                        {cloudSyncStatus !== "idle" && (
                          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                                {cloudSyncStatus === "exporting" ? "Exporting data..." : "Importing data..."}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Enhanced sync results display */}
                      {(lastExportCounts || lastImportCounts) && (
                        <div className="border-t pt-4 space-y-3">
                          <h4 className="font-medium text-sm">Sync Results</h4>

                          {lastExportCounts && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">
                                Last Export
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <span>
                                  Products: <strong>{lastExportCounts.products}</strong>
                                </span>
                                <span>
                                  Variants: <strong>{lastExportCounts.variants}</strong>
                                </span>
                                <span>
                                  Colors: <strong>{lastExportCounts.colors}</strong>
                                </span>
                                <span>
                                  Sales: <strong>{lastExportCounts.sales}</strong>
                                </span>
                                <span>
                                  Items: <strong>{lastExportCounts.saleItems}</strong>
                                </span>
                                <span>
                                  Payments: <strong>{lastExportCounts.paymentHistory}</strong>
                                </span>
                                <span>
                                  Returns: <strong>{lastExportCounts.returns}</strong>
                                </span>
                                <span>
                                  Stock Moves: <strong>{lastExportCounts.stockInHistory}</strong>
                                </span>
                              </div>
                            </div>
                          )}

                          {lastImportCounts && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Last Import</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <span>
                                  Products: <strong>{lastImportCounts.products}</strong>
                                </span>
                                <span>
                                  Variants: <strong>{lastImportCounts.variants}</strong>
                                </span>
                                <span>
                                  Colors: <strong>{lastImportCounts.colors}</strong>
                                </span>
                                <span>
                                  Sales: <strong>{lastImportCounts.sales}</strong>
                                </span>
                                <span>
                                  Items: <strong>{lastImportCounts.saleItems}</strong>
                                </span>
                                <span>
                                  Payments: <strong>{lastImportCounts.paymentHistory}</strong>
                                </span>
                                <span>
                                  Returns: <strong>{lastImportCounts.returns}</strong>
                                </span>
                                <span>
                                  Stock Moves: <strong>{lastImportCounts.stockInHistory}</strong>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SYSTEM TAB */}
              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      System Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Database Records</Label>
                        <div className="text-2xl font-bold text-primary">
                          {allSales.length + products.length + colors.length}
                        </div>
                        <p className="text-xs text-muted-foreground">Total records across all tables</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Cloud Status</Label>
                        <div className="flex items-center gap-2">
                          {cloudConnectionStatus === "success" ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={cloudConnectionStatus === "success" ? "text-green-600" : "text-red-600"}>
                            {cloudConnectionStatus === "success" ? "Connected" : "Not Connected"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {cloudConnectionStatus === "success" ? "Sync enabled" : "Manual sync only"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="flex items-center gap-2 bg-transparent"
                          onClick={() => {
                            queryClient.invalidateQueries()
                            toast({
                              title: "Data Refreshed",
                              description: "All data has been refreshed.",
                            })
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh Data
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                          <Database className="h-4 w-4" />
                          Backup Database
                        </Button>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Audit Session</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Session Started:</span>
                          <span>{formatDateShort(new Date())}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Token Expires:</span>
                          <span>24 hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Access Level:</span>
                          <Badge variant="default">Full Audit Access</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
