"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
  Shield,
  Ban,
  CheckCircle,
  Smartphone,
  History,
  Store,
  Palette,
  LayoutDashboard,
  ClipboardList,
  Phone,
  ChevronRight,
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

const VISIBLE_LIMIT_INITIAL = 50
const VISIBLE_LIMIT_INCREMENT = 30

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100
}

type AdminSection = "overview" | "store" | "security" | "data"
type StoreTab = "branding" | "display" | "receipt"
type SecurityTab = "pin" | "permissions" | "licenses"
type DataTab = "cloud" | "backup" | "system"

const sectionConfig = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard, description: "Dashboard & Quick Stats" },
  { id: "store" as const, label: "Store", icon: Store, description: "Branding & Display" },
  { id: "security" as const, label: "Security", icon: Shield, description: "PIN & Licenses" },
  { id: "data" as const, label: "Data", icon: Database, description: "Cloud & Backup" },
]

export default function Admin() {
  const { toast } = useToast()
  const { formatDate, formatDateShort } = useDateFormat()
  
  const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return "Rs. 0"
    const num = typeof value === "string" ? parseFloat(value) || 0 : value
    return `Rs. ${Math.round(num).toLocaleString()}`
  }
  const { storeName: receiptStoreName } = useReceiptSettings()

  const [isVerified, setIsVerified] = useState(false)
  const [pinInput, setPinInput] = useState(["", "", "", ""])
  const [pinError, setPinError] = useState("")
  const [isDefaultPin, setIsDefaultPin] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(true)

  const [activeSection, setActiveSection] = useState<AdminSection>("overview")
  const [storeTab, setStoreTab] = useState<StoreTab>("branding")
  const [securityTab, setSecurityTab] = useState<SecurityTab>("pin")
  const [dataTab, setDataTab] = useState<DataTab>("cloud")

  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)

  const [licenseDevices, setLicenseDevices] = useState<any[]>([])
  const [licenseAuditLog, setLicenseAuditLog] = useState<any[]>([])
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [masterPinInput, setMasterPinInput] = useState("")
  const [showMasterPin, setShowMasterPin] = useState(false)
  const [masterPinVerified, setMasterPinVerified] = useState(false)
  const [masterPinError, setMasterPinError] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showAutoBlockDialog, setShowAutoBlockDialog] = useState(false)
  const [autoBlockDate, setAutoBlockDate] = useState("")

  const [cloudUrl, setCloudUrl] = useState("")
  const [showCloudUrl, setShowCloudUrl] = useState(false)
  const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "exporting" | "importing">("idle")

  const [auditToken, setAuditToken] = useState<string | null>(() => {
    return sessionStorage.getItem("auditToken")
  })

  useEffect(() => {
    if (auditToken) {
      setIsVerified(true)
    }
  }, [])

  const { data: hasPin } = useQuery<{ hasPin: boolean; isDefault?: boolean }>({
    queryKey: ["/api/audit/has-pin"],
    enabled: !isVerified && !auditToken,
  })

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
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

  const { data: paymentHistory = [] } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  })

  const { data: returns = [] } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
    enabled: isVerified,
  })

  useEffect(() => {
    if (hasPin?.isDefault) {
      setIsDefaultPin(true)
    }
  }, [hasPin])

  const handlePinInput = (index: number, value: string) => {
    if (value.length > 1) return
    if (value && !/^\d$/.test(value)) return

    const newPin = [...pinInput]
    newPin[index] = value
    setPinInput(newPin)
    setPinError("")

    if (value && index < 3) {
      const nextInput = document.querySelector(`[data-testid="input-pin-${index + 1}"]`) as HTMLInputElement
      nextInput?.focus()
    }

    if (newPin.every((d) => d !== "") && index === 3) {
      verifyPin(newPin.join(""))
    }
  }

  const verifyPin = async (pin: string) => {
    try {
      const response = await apiRequest("POST", "/api/audit/verify", { pin })
      if (response.ok) {
        const data = await response.json()
        if (data.token) {
          sessionStorage.setItem("auditToken", data.token)
          setAuditToken(data.token)
        }
        setIsVerified(true)
        setShowPinDialog(false)
        toast({
          title: "Access Granted",
          description: "Welcome to Admin Center",
        })
      }
    } catch (error) {
      setPinError("Invalid PIN")
      setPinInput(["", "", "", ""])
      const firstInput = document.querySelector('[data-testid="input-pin-0"]') as HTMLInputElement
      firstInput?.focus()
    }
  }

  const totalProducts = products.length
  const totalColors = colors.length
  const totalStock = colors.reduce((sum, c) => sum + (c.stockQuantity || 0), 0)
  const lowStockColors = colors.filter((c) => (c.stockQuantity || 0) < 10).length
  const totalSalesAmount = allSales.reduce((sum, s) => sum + safeParseFloat(s.totalAmount), 0)
  const totalCollected = allSales.reduce((sum, s) => sum + safeParseFloat(s.amountPaid), 0)
  const totalOutstanding = totalSalesAmount - totalCollected
  const totalReturnsAmount = returns.reduce((sum, r) => sum + safeParseFloat(r.refundAmount), 0)

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] })
      toast({ title: "Settings Saved", description: "Changes applied successfully." })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    },
  })

  const verifyMasterPin = async () => {
    setLicenseLoading(true)
    try {
      const response = await fetch("/api/license/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterPin: masterPinInput }),
      })
      
      if (response.ok) {
        setMasterPinVerified(true)
        setMasterPinError("")
        refreshDevices()
        toast({ title: "Verified", description: "Master PIN verified successfully." })
      } else {
        setMasterPinError("Invalid Master PIN")
      }
    } catch (error) {
      setMasterPinError("Verification failed")
    } finally {
      setLicenseLoading(false)
    }
  }

  const refreshDevices = async () => {
    setLicenseLoading(true)
    try {
      const [devicesRes, auditRes] = await Promise.all([
        fetch("/api/license/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ masterPin: masterPinInput }),
        }),
        fetch("/api/license/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ masterPin: masterPinInput }),
        }),
      ])
      
      if (devicesRes.ok) {
        const data = await devicesRes.json()
        setLicenseDevices(data.devices || [])
      }
      if (auditRes.ok) {
        const data = await auditRes.json()
        setLicenseAuditLog(data.auditLog || [])
      }
    } catch (error) {
      console.error("Error refreshing devices:", error)
    } finally {
      setLicenseLoading(false)
    }
  }

  const handleBlockDevice = async () => {
    if (!selectedDeviceId || !blockReason) return
    setLicenseLoading(true)
    try {
      const response = await fetch("/api/license/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterPin: masterPinInput,
          deviceId: selectedDeviceId,
          reason: blockReason,
        }),
      })
      
      if (response.ok) {
        toast({ title: "License Paused", description: "The license has been paused." })
        setShowBlockDialog(false)
        setBlockReason("")
        setSelectedDeviceId(null)
        refreshDevices()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to pause license.", variant: "destructive" })
    } finally {
      setLicenseLoading(false)
    }
  }

  const handleUnblockDevice = async (deviceId: string) => {
    setLicenseLoading(true)
    try {
      const response = await fetch("/api/license/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterPin: masterPinInput, deviceId }),
      })
      
      if (response.ok) {
        toast({ title: "License Activated", description: "The license has been activated." })
        refreshDevices()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to activate license.", variant: "destructive" })
    } finally {
      setLicenseLoading(false)
    }
  }

  const handleSetAutoBlockDate = async () => {
    if (!selectedDeviceId) return
    setLicenseLoading(true)
    try {
      const response = await fetch("/api/license/set-auto-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterPin: masterPinInput,
          deviceId: selectedDeviceId,
          autoBlockDate: autoBlockDate || null,
        }),
      })
      
      if (response.ok) {
        toast({
          title: autoBlockDate ? "Expiry Date Set" : "Expiry Cleared",
          description: autoBlockDate ? `License expires on ${autoBlockDate}` : "Expiry date removed",
        })
        setShowAutoBlockDialog(false)
        setAutoBlockDate("")
        setSelectedDeviceId(null)
        refreshDevices()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to set expiry.", variant: "destructive" })
    } finally {
      setLicenseLoading(false)
    }
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Center</CardTitle>
            <CardDescription>Enter your 4-digit PIN to access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center gap-3">
              {pinInput.map((digit, index) => (
                <Input
                  key={index}
                  type="password"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinInput(index, e.target.value)}
                  className="w-14 h-14 text-center text-2xl font-bold"
                  data-testid={`input-pin-${index}`}
                />
              ))}
            </div>
            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}
            {isDefaultPin && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Default PIN is 0000. Please change it after login.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <aside className="w-64 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {receiptStoreName || settings?.storeName || "PaintPulse"}
            </p>
          </div>

          <ScrollArea className="flex-1 p-2">
            <nav className="space-y-1">
              {sectionConfig.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`nav-${section.id}`}
                >
                  <section.icon className="h-5 w-5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{section.label}</p>
                    <p className={`text-xs truncate ${
                      activeSection === section.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}>
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
                    activeSection === section.id ? "rotate-90" : ""
                  }`} />
                </button>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-foreground">RAYOUX INNOVATIONS</p>
              <p className="text-xs text-muted-foreground">0300-1204190</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {activeSection === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Dashboard</h2>
                  <p className="text-muted-foreground">Quick overview of your business</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalColors}</p>
                          <p className="text-xs text-muted-foreground">Total Colors</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(totalSalesAmount)}</p>
                          <p className="text-xs text-muted-foreground">Total Sales</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(totalReturnsAmount)}</p>
                          <p className="text-xs text-muted-foreground">Returns</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Quick Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Products</span>
                        <span className="font-medium">{totalProducts}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Total Stock</span>
                        <span className="font-medium">{totalStock} units</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Low Stock Items</span>
                        <Badge variant={lowStockColors > 0 ? "destructive" : "secondary"}>
                          {lowStockColors}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Total Bills</span>
                        <span className="font-medium">{allSales.length}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Returns</span>
                        <span className="font-medium">{returns.length}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Collection Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Total Billed</span>
                        <span className="font-medium">{formatCurrency(totalSalesAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Collected</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalCollected)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Outstanding</span>
                        <span className="font-medium text-amber-600">{formatCurrency(totalOutstanding)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Collection Rate</span>
                        <Badge variant="secondary">
                          {totalSalesAmount > 0 ? Math.round((totalCollected / totalSalesAmount) * 100) : 0}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeSection === "store" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Store Settings</h2>
                  <p className="text-muted-foreground">Customize your store appearance</p>
                </div>

                <Tabs value={storeTab} onValueChange={(v) => setStoreTab(v as StoreTab)}>
                  <TabsList>
                    <TabsTrigger value="branding" className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Branding
                    </TabsTrigger>
                    <TabsTrigger value="display" className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Display
                    </TabsTrigger>
                    <TabsTrigger value="receipt" className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Receipt
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value="branding" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Store Identity</CardTitle>
                          <CardDescription>Configure your store name and branding</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Store Name</Label>
                            <Input
                              value={settings?.storeName || ""}
                              onChange={(e) => updateSettingsMutation.mutate({ storeName: e.target.value })}
                              placeholder="Your Store Name"
                              data-testid="input-store-name"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="display" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Display Options</CardTitle>
                          <CardDescription>Configure how products are displayed</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Date Format</Label>
                            <Select
                              value={settings?.dateFormat || "DD-MM-YYYY"}
                              onValueChange={(v) => updateSettingsMutation.mutate({ dateFormat: v })}
                            >
                              <SelectTrigger data-testid="select-date-format">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                                <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="receipt" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Receipt Settings</CardTitle>
                          <CardDescription>Configure receipt printing options</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">Receipt settings coming soon...</p>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}

            {activeSection === "security" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Security</h2>
                  <p className="text-muted-foreground">Manage PIN, permissions, and licenses</p>
                </div>

                <Tabs value={securityTab} onValueChange={(v) => setSecurityTab(v as SecurityTab)}>
                  <TabsList>
                    <TabsTrigger value="pin" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      PIN
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Permissions
                    </TabsTrigger>
                    <TabsTrigger value="licenses" className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Licenses
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value="pin" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Change Admin PIN</CardTitle>
                          <CardDescription>Update your 4-digit access PIN</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Current PIN</Label>
                            <div className="relative">
                              <Input
                                type={showCurrentPin ? "text" : "password"}
                                value={currentPin}
                                onChange={(e) => setCurrentPin(e.target.value)}
                                maxLength={4}
                                placeholder="****"
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
                            <Label>New PIN</Label>
                            <div className="relative">
                              <Input
                                type={showNewPin ? "text" : "password"}
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                maxLength={4}
                                placeholder="****"
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
                            <Label>Confirm New PIN</Label>
                            <Input
                              type="password"
                              value={confirmPin}
                              onChange={(e) => setConfirmPin(e.target.value)}
                              maxLength={4}
                              placeholder="****"
                              data-testid="input-confirm-pin"
                            />
                          </div>
                          <Button
                            onClick={async () => {
                              if (newPin !== confirmPin) {
                                toast({ title: "Error", description: "PINs do not match", variant: "destructive" })
                                return
                              }
                              if (newPin.length !== 4) {
                                toast({ title: "Error", description: "PIN must be 4 digits", variant: "destructive" })
                                return
                              }
                              try {
                                const token = sessionStorage.getItem("auditToken")
                                await apiRequest("POST", "/api/audit/change-pin", {
                                  currentPin,
                                  newPin,
                                }, { headers: { Authorization: `Bearer ${token}` } })
                                toast({ title: "Success", description: "PIN changed successfully" })
                                setCurrentPin("")
                                setNewPin("")
                                setConfirmPin("")
                              } catch (error) {
                                toast({ title: "Error", description: "Failed to change PIN", variant: "destructive" })
                              }
                            }}
                            data-testid="button-change-pin"
                          >
                            Change PIN
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="permissions" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Permission Settings</CardTitle>
                          <CardDescription>Control what actions are allowed</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between py-3 border-b">
                            <div>
                              <p className="font-medium">Stock Delete</p>
                              <p className="text-sm text-muted-foreground">Allow deleting stock entries</p>
                            </div>
                            <Switch
                              checked={settings?.permStockDelete ?? true}
                              onCheckedChange={(v) => updateSettingsMutation.mutate({ permStockDelete: v })}
                              data-testid="switch-perm-stock-delete"
                            />
                          </div>
                          <div className="flex items-center justify-between py-3 border-b">
                            <div>
                              <p className="font-medium">Stock Edit</p>
                              <p className="text-sm text-muted-foreground">Allow editing stock entries</p>
                            </div>
                            <Switch
                              checked={settings?.permStockEdit ?? true}
                              onCheckedChange={(v) => updateSettingsMutation.mutate({ permStockEdit: v })}
                              data-testid="switch-perm-stock-edit"
                            />
                          </div>
                          <div className="flex items-center justify-between py-3 border-b">
                            <div>
                              <p className="font-medium">Sales Delete</p>
                              <p className="text-sm text-muted-foreground">Allow deleting sales</p>
                            </div>
                            <Switch
                              checked={settings?.permSalesDelete ?? true}
                              onCheckedChange={(v) => updateSettingsMutation.mutate({ permSalesDelete: v })}
                              data-testid="switch-perm-sales-delete"
                            />
                          </div>
                          <div className="flex items-center justify-between py-3 border-b">
                            <div>
                              <p className="font-medium">Sales Edit</p>
                              <p className="text-sm text-muted-foreground">Allow editing sales</p>
                            </div>
                            <Switch
                              checked={settings?.permSalesEdit ?? true}
                              onCheckedChange={(v) => updateSettingsMutation.mutate({ permSalesEdit: v })}
                              data-testid="switch-perm-sales-edit"
                            />
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium">Database Access</p>
                              <p className="text-sm text-muted-foreground">Allow database management</p>
                            </div>
                            <Switch
                              checked={settings?.permDatabaseAccess ?? true}
                              onCheckedChange={(v) => updateSettingsMutation.mutate({ permDatabaseAccess: v })}
                              data-testid="switch-perm-database"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="licenses" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>License Management</CardTitle>
                          <CardDescription>Manage device licenses and subscriptions</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {!masterPinVerified ? (
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Enter Master PIN to manage licenses
                              </p>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    type={showMasterPin ? "text" : "password"}
                                    value={masterPinInput}
                                    onChange={(e) => setMasterPinInput(e.target.value)}
                                    placeholder="Master PIN"
                                    data-testid="input-master-pin"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0"
                                    onClick={() => setShowMasterPin(!showMasterPin)}
                                  >
                                    {showMasterPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                                <Button
                                  onClick={verifyMasterPin}
                                  disabled={licenseLoading || !masterPinInput}
                                  data-testid="button-verify-master"
                                >
                                  {licenseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                                </Button>
                              </div>
                              {masterPinError && (
                                <p className="text-sm text-destructive">{masterPinError}</p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" />
                                  Master PIN Verified
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={refreshDevices}
                                  disabled={licenseLoading}
                                  data-testid="button-refresh-devices"
                                >
                                  {licenseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                              </div>

                              <div className="border rounded-lg">
                                <div className="p-3 bg-muted/30 border-b">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Smartphone className="h-4 w-4" />
                                    Devices ({licenseDevices.length})
                                  </h4>
                                </div>
                                
                                {licenseDevices.length === 0 ? (
                                  <div className="p-6 text-center text-muted-foreground">
                                    <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No devices registered</p>
                                  </div>
                                ) : (
                                  <div className="divide-y">
                                    {licenseDevices.map((device) => (
                                      <div key={device.id} className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{device.deviceName || device.deviceId}</span>
                                            {device.status === "blocked" ? (
                                              <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                Paused
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                Active
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            <p>Store: {device.storeName || "Unknown"}</p>
                                            {device.autoBlockDate && device.status !== "blocked" && (
                                              <p className="text-amber-600">Expires: {device.autoBlockDate}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="shrink-0 flex gap-2">
                                          {device.status === "blocked" ? (
                                            <Button
                                              size="sm"
                                              onClick={() => handleUnblockDevice(device.deviceId)}
                                              disabled={licenseLoading}
                                            >
                                              Activate
                                            </Button>
                                          ) : (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setSelectedDeviceId(device.deviceId)
                                                  setAutoBlockDate(device.autoBlockDate || "")
                                                  setShowAutoBlockDialog(true)
                                                }}
                                                disabled={licenseLoading}
                                              >
                                                <Calendar className="h-4 w-4 mr-1" />
                                                {device.autoBlockDate ? "Edit" : "Expiry"}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-amber-600"
                                                onClick={() => {
                                                  setSelectedDeviceId(device.deviceId)
                                                  setShowBlockDialog(true)
                                                }}
                                                disabled={licenseLoading}
                                              >
                                                Pause
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {licenseAuditLog.length > 0 && (
                                <div className="border rounded-lg">
                                  <div className="p-3 bg-muted/30 border-b">
                                    <h4 className="font-medium flex items-center gap-2">
                                      <History className="h-4 w-4" />
                                      History
                                    </h4>
                                  </div>
                                  <div className="divide-y max-h-48 overflow-auto">
                                    {licenseAuditLog.slice(0, 5).map((log) => {
                                      const labels: Record<string, string> = {
                                        "block": "Paused",
                                        "unblock": "Activated",
                                        "set_auto_block": "Expiry Set",
                                        "clear_auto_block": "Expiry Cleared"
                                      }
                                      return (
                                        <div key={log.id} className="p-3 text-sm">
                                          <span className="font-medium">{labels[log.action] || log.action}</span>
                                          <span className="text-muted-foreground"> - {log.deviceId.slice(0, 8)}...</span>
                                          <p className="text-xs text-muted-foreground">{formatDateShort(new Date(log.createdAt))}</p>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}

            {activeSection === "data" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Data Management</h2>
                  <p className="text-muted-foreground">Cloud sync, backup, and system info</p>
                </div>

                <Tabs value={dataTab} onValueChange={(v) => setDataTab(v as DataTab)}>
                  <TabsList>
                    <TabsTrigger value="cloud" className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      Cloud Sync
                    </TabsTrigger>
                    <TabsTrigger value="backup" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Backup
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      System
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value="cloud" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Cloud Database Sync</CardTitle>
                          <CardDescription>Sync data across multiple devices</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Cloud Database URL</Label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type={showCloudUrl ? "text" : "password"}
                                  value={cloudUrl || settings?.cloudDatabaseUrl || ""}
                                  onChange={(e) => setCloudUrl(e.target.value)}
                                  placeholder="postgresql://..."
                                  data-testid="input-cloud-url"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0"
                                  onClick={() => setShowCloudUrl(!showCloudUrl)}
                                >
                                  {showCloudUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  setCloudConnectionStatus("testing")
                                  try {
                                    const response = await fetch("/api/cloud-sync/test-connection", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ cloudDatabaseUrl: cloudUrl || settings?.cloudDatabaseUrl }),
                                    })
                                    if (response.ok) {
                                      setCloudConnectionStatus("success")
                                      toast({ title: "Connected", description: "Cloud connection successful!" })
                                    } else {
                                      setCloudConnectionStatus("error")
                                      toast({ title: "Failed", description: "Could not connect to cloud", variant: "destructive" })
                                    }
                                  } catch {
                                    setCloudConnectionStatus("error")
                                  }
                                }}
                                disabled={cloudConnectionStatus === "testing"}
                                data-testid="button-test-cloud"
                              >
                                {cloudConnectionStatus === "testing" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Test"
                                )}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {cloudConnectionStatus === "success" && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700">
                                  <Check className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                              {cloudConnectionStatus === "error" && (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Failed
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Separator />

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={async () => {
                                setCloudSyncStatus("exporting")
                                try {
                                  await fetch("/api/cloud-sync/export", { method: "POST" })
                                  toast({ title: "Exported", description: "Data exported to cloud" })
                                } catch {
                                  toast({ title: "Error", description: "Export failed", variant: "destructive" })
                                } finally {
                                  setCloudSyncStatus("idle")
                                }
                              }}
                              disabled={cloudSyncStatus !== "idle"}
                              data-testid="button-export-cloud"
                            >
                              {cloudSyncStatus === "exporting" ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Export to Cloud
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={async () => {
                                setCloudSyncStatus("importing")
                                try {
                                  await fetch("/api/cloud-sync/import", { method: "POST" })
                                  toast({ title: "Imported", description: "Data imported from cloud" })
                                  queryClient.invalidateQueries()
                                } catch {
                                  toast({ title: "Error", description: "Import failed", variant: "destructive" })
                                } finally {
                                  setCloudSyncStatus("idle")
                                }
                              }}
                              disabled={cloudSyncStatus !== "idle"}
                              data-testid="button-import-cloud"
                            >
                              {cloudSyncStatus === "importing" ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Import from Cloud
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="backup" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Database Backup</CardTitle>
                          <CardDescription>Download or restore database backups</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Button
                            variant="outline"
                            className="w-full"
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
                                  toast({ title: "Downloaded", description: "Backup file downloaded" })
                                }
                              } catch {
                                toast({ title: "Error", description: "Download failed", variant: "destructive" })
                              }
                            }}
                            data-testid="button-download-backup"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Database Backup
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="system" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>System Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">Total Records</p>
                              <p className="text-2xl font-bold text-primary">
                                {allSales.length + products.length + colors.length}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">Cloud Status</p>
                              <div className="flex items-center gap-2">
                                {cloudConnectionStatus === "success" ? (
                                  <>
                                    <Wifi className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600">Connected</span>
                                  </>
                                ) : (
                                  <>
                                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Offline</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 text-center">
                            <h3 className="font-bold text-lg">RAYOUX INNOVATIONS PRIVATE LIMITED</h3>
                            <p className="text-sm text-muted-foreground mt-1">Software Development & Technology Solutions</p>
                            <Separator className="my-3" />
                            <p className="font-medium">CEO: AHSAN KAMRAN</p>
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-1">
                              <Phone className="h-4 w-4" />
                              0300-1204190
                            </p>
                            <Separator className="my-3" />
                            <p className="text-xs text-muted-foreground">PaintPulse v1.0.0</p>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              queryClient.invalidateQueries()
                              toast({ title: "Refreshed", description: "All data refreshed" })
                            }}
                            data-testid="button-refresh-all"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh All Data
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-500" />
              Pause License
            </DialogTitle>
            <DialogDescription>
              This will temporarily pause the license until reactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Renewal pending"
                data-testid="input-pause-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
                Cancel
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={handleBlockDevice}
                disabled={licenseLoading || !blockReason}
              >
                {licenseLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Pause License
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAutoBlockDialog} onOpenChange={setShowAutoBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Set License Expiry
            </DialogTitle>
            <DialogDescription>
              Set an expiry date for this license.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={autoBlockDate}
                onChange={(e) => setAutoBlockDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                data-testid="input-expiry-date"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAutoBlockDialog(false)}>
                Cancel
              </Button>
              {autoBlockDate && (
                <Button variant="outline" onClick={() => setAutoBlockDate("")}>
                  Clear
                </Button>
              )}
              <Button onClick={handleSetAutoBlockDate} disabled={licenseLoading}>
                {licenseLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {autoBlockDate ? "Set Date" : "Clear Date"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
