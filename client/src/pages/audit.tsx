"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"

const VISIBLE_LIMIT_INITIAL = 50
const VISIBLE_LIMIT_INCREMENT = 30
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
  FileText,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDateFormat } from "@/hooks/use-date-format"
import { useReceiptSettings } from "@/hooks/use-receipt-settings"
import jsPDF from "jspdf"
import type {
  ColorWithVariantAndProduct,
  Sale,
  Product,
  PaymentHistory,
  Return,
  Settings as AppSettings,
} from "@shared/schema"
import { format, startOfDay, endOfDay, isBefore, isAfter } from "date-fns"

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

type UnifiedTransactionType = "payment" | "return" | "manual_balance" | "sale"

interface UnifiedTransaction {
  id: string
  type: UnifiedTransactionType
  date: Date
  customerName: string
  customerPhone: string
  amount: number
  method?: string
  notes?: string
  saleId?: string
  previousBalance?: number
  newBalance?: number
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

    try {
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
        let errorMessage = `Request failed with status ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, try to get text
          const text = await response.text()
          if (text) errorMessage = `${errorMessage}: ${text}`
        }
        throw new Error(errorMessage)
      }

      return response.json()
    } catch (error: any) {
      console.error(`API Request Error for ${url}:`, error)
      throw error
    }
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

  const [activeTab, setActiveTab] = useState("settings")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [movementTypeFilter, setMovementTypeFilter] = useState("all")
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL)
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

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
  const [syncInterval, setSyncInterval] = useState(5)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [pendingChanges, setPendingChanges] = useState(0)

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


  const { data: allSales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: isVerified,
  })

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  })

  // Unpaid bills query - simplified version
  const { data: unpaidBills = [], isLoading: unpaidLoading } = useQuery<Sale[]>({
    queryKey: ["/api/audit/unpaid-bills"],
    enabled: isVerified,
    queryFn: async () => {
      try {
        const response = await authenticatedRequest("/api/audit/unpaid-bills")
        return response
      } catch (error) {
        console.error("Unpaid bills error:", error)
        return []
      }
    },
  })

  // Payments query - simplified version
  const { data: auditPayments = [], isLoading: auditPaymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  })

  // Returns query - simplified version
  const { data: auditReturns = [], isLoading: returnsLoading } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
    enabled: isVerified,
  })

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
  })

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: Partial<AppSettings>) => {
      const response = await authenticatedRequest("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(permissions),
      })
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
      const response = await authenticatedRequest("/api/audit/pin", {
        method: "PATCH",
        body: JSON.stringify({ currentPin, newPin }),
      })
      return response
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

  // Cloud Sync Functions - Using Real Backend API
  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter a PostgreSQL connection URL.",
        variant: "destructive",
      })
      return
    }

    if (!cloudUrl.includes('postgresql://') || !cloudUrl.includes('@')) {
      setCloudConnectionStatus("error")
      toast({
        title: "Invalid Format",
        description: "URL must be in format: postgresql://user:password@host/database",
        variant: "destructive",
      })
      return
    }

    setCloudConnectionStatus("testing")
    try {
      const response = await authenticatedRequest("/api/cloud/test-connection", {
        method: "POST",
        body: JSON.stringify({ connectionUrl: cloudUrl }),
      })
      
      if (response.success) {
        setCloudConnectionStatus("success")
        toast({
          title: "Connection Successful",
          description: response.message || "Connected to cloud database successfully.",
        })
      } else {
        setCloudConnectionStatus("error")
        toast({
          title: "Connection Failed",
          description: response.error || "Could not connect to cloud database.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      setCloudConnectionStatus("error")
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to cloud database.",
        variant: "destructive",
      })
    }
  }

  const handleExportToCloud = async (silent = false) => {
    if (!cloudUrl.trim()) {
      if (!silent) {
        toast({
          title: "Connection URL Required",
          description: "Please enter and save a PostgreSQL connection URL first.",
          variant: "destructive",
        })
      }
      return
    }

    if (!silent) setCloudSyncStatus("exporting")
    try {
      const response = await authenticatedRequest("/api/cloud/export", {
        method: "POST",
      })
      
      if (response.success) {
        setLastExportCounts(response.counts || {})
        setLastSyncTime(new Date())
        if (!silent) {
          toast({
            title: "Export Complete",
            description: response.message || "Data exported to cloud successfully.",
          })
        }
      } else {
        if (!silent) {
          toast({
            title: "Export Failed",
            description: response.error || "Could not export data to cloud.",
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Export Failed",
          description: error.message || "Could not export data to cloud.",
          variant: "destructive",
        })
      }
    } finally {
      if (!silent) setCloudSyncStatus("idle")
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

    setCloudSyncStatus("importing")
    try {
      const response = await authenticatedRequest("/api/cloud/import", {
        method: "POST",
      })
      
      if (response.success) {
        setLastImportCounts(response.counts || {})
        setLastSyncTime(new Date())
        queryClient.invalidateQueries()
        toast({
          title: "Import Complete",
          description: response.message || "Data imported from cloud successfully.",
        })
      } else {
        toast({
          title: "Import Failed",
          description: response.error || "Could not import data from cloud.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import data from cloud.",
        variant: "destructive",
      })
    } finally {
      setCloudSyncStatus("idle")
    }
  }

  // Auto-sync functions
  const toggleAutoSync = async (enabled: boolean) => {
    try {
      const response = await authenticatedRequest("/api/cloud/auto-sync", {
        method: "POST",
        body: JSON.stringify({ enabled, interval: syncInterval }),
      })
      
      if (response.success) {
        setAutoSyncEnabled(enabled)
        toast({
          title: enabled ? "Auto-Sync Enabled" : "Auto-Sync Disabled",
          description: enabled 
            ? `Auto-syncing every ${syncInterval} seconds.`
            : "Automatic synchronization has been turned off.",
        })
      } else {
        toast({
          title: "Failed to Update Auto-Sync",
          description: response.error || "Could not update auto-sync settings.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to Update Auto-Sync",
        description: error.message || "Could not update auto-sync settings.",
        variant: "destructive",
      })
    }
  }

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

  const filteredSales = useMemo(() => {
    let filtered = [...allSales]

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
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
  }, [allSales, debouncedSearchQuery, dateFrom, dateTo])
  
  const visibleSales = useMemo(() => {
    return filteredSales.slice(0, visibleLimit)
  }, [filteredSales, visibleLimit])

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
    const totalPayments = auditPayments.reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    const cashPayments = auditPayments
      .filter((p) => p.paymentMethod === "cash")
      .reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    const onlinePayments = auditPayments
      .filter((p) => p.paymentMethod === "online")
      .reduce((acc, p) => acc + safeParseFloat(p.amount), 0)
    return {
      totalPayments: roundNumber(totalPayments),
      cashPayments: roundNumber(cashPayments),
      onlinePayments: roundNumber(onlinePayments),
    }
  }, [auditPayments])

  const returnsSummary = useMemo(() => {
    const totalReturns = auditReturns.reduce((acc, r) => acc + safeParseFloat(r.totalRefund || "0"), 0)
    const totalItemsReturned = auditReturns.reduce((acc, r) => {
      return acc + 1
    }, 0)
    return {
      totalReturns: roundNumber(totalReturns),
      totalItemsReturned,
    }
  }, [auditReturns])

  const manualBalances = useMemo(() => {
    return allSales.filter((s) => s.isManualBalance === true)
  }, [allSales])

  const manualBalanceSummary = useMemo(() => {
    const total = manualBalances.reduce((acc, s) => acc + safeParseFloat(s.totalAmount), 0)
    return {
      totalAmount: roundNumber(total),
      count: manualBalances.length,
    }
  }, [manualBalances])

  const unifiedTransactions = useMemo(() => {
    const transactions: UnifiedTransaction[] = []

    auditPayments.forEach((p) => {
      transactions.push({
        id: `payment-${p.id}`,
        type: "payment",
        date: new Date(p.createdAt),
        customerName: p.sale?.customerName || "N/A",
        customerPhone: p.customerPhone || "",
        amount: safeParseFloat(p.amount),
        method: p.paymentMethod,
        notes: p.notes || undefined,
        saleId: p.saleId,
        previousBalance: safeParseFloat(p.previousBalance),
        newBalance: safeParseFloat(p.newBalance),
      })
    })

    auditReturns.forEach((r) => {
      transactions.push({
        id: `return-${r.id}`,
        type: "return",
        date: new Date(r.createdAt),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        amount: safeParseFloat(r.totalRefund),
        notes: r.reason || undefined,
        saleId: r.saleId || undefined,
      })
    })

    manualBalances.forEach((s) => {
      transactions.push({
        id: `manual-${s.id}`,
        type: "manual_balance",
        date: new Date(s.createdAt),
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        amount: safeParseFloat(s.totalAmount),
        notes: s.notes || undefined,
        saleId: s.id,
      })
    })

    transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
    return transactions
  }, [auditPayments, auditReturns, manualBalances])

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
    salesLoading ||
    paymentsLoading ||
    unpaidLoading ||
    auditPaymentsLoading ||
    returnsLoading

  return (
    <div className="glass-page flex flex-col h-full overflow-hidden">
      <div className="glass-surface m-4 mb-0 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Audit Settings</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 glass-input"
                data-testid="input-audit-search"
              />
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 glass-input"
                data-testid="input-date-from"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 glass-input"
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

        {/* Settings Header */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Audit Settings & Cloud Sync</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden mt-4">
        {/* Main Content Area */}
        <div className="h-full overflow-hidden">
          {/* Settings Content - Direct display since Stock tab removed */}
          {activeTab === "settings" && (
            <div className="h-full overflow-auto p-4">
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
                        <div className="text-sm text-muted-foreground" id="cloud-description">
                          Connect to a cloud PostgreSQL database (Neon, Supabase) to sync your data across multiple devices.
                        </div>

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
                              Example: postgresql://username:password@hostname/database
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
                                  ? "Connection Failed"
                                  : "Test Connection"}
                          </Button>

                          {/* Real-Time Sync Settings */}
                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <RefreshCw className="h-4 w-4" />
                              Real-Time Sync
                            </h4>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <div className="space-y-0.5">
                                <Label className="flex items-center gap-2">
                                  {autoSyncEnabled ? (
                                    <Wifi className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <WifiOff className="h-4 w-4 text-gray-500" />
                                  )}
                                  Real-Time Cloud Sync
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {autoSyncEnabled
                                    ? `Auto-syncing every ${syncInterval} seconds`
                                    : "Manual sync only"}
                                </p>
                              </div>
                              <Switch
                                checked={autoSyncEnabled}
                                onCheckedChange={toggleAutoSync}
                              />
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <RefreshCw className="h-4 w-4" />
                              Manual Sync Actions
                            </h4>

                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                onClick={() => handleExportToCloud(false)}
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
                                <strong>Export:</strong> Send local data to cloud database
                              </p>
                              <p className="flex items-center gap-2">
                                <Download className="h-3 w-3" />
                                <strong>Import:</strong> Download data from cloud database
                              </p>
                            </div>
                          </div>
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
                              {cloudConnectionStatus === "success" ? "Cloud sync enabled" : "Manual sync only"}
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
                            <Button 
                              variant="outline" 
                              className="flex items-center gap-2 bg-transparent"
                              onClick={async () => {
                                try {
                                  const response = await fetch("/api/database/export")
                                  if (response.ok) {
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement("a")
                                    a.href = url
                                    a.download = `paintpulse-backup-${new Date().toISOString().split("T")[0]}.db`
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                    window.URL.revokeObjectURL(url)
                                    toast({
                                      title: "Backup Complete",
                                      description: "Database backup has been downloaded.",
                                    })
                                  } else {
                                    toast({
                                      title: "Backup Failed",
                                      description: "Could not create database backup.",
                                      variant: "destructive",
                                    })
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Backup Failed", 
                                    description: "Could not create database backup.",
                                    variant: "destructive",
                                  })
                                }
                              }}
                            >
                              <Database className="h-4 w-4" />
                              Backup Database
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}