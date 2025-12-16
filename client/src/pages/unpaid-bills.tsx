"use client"

import { useState, useMemo, useDeferredValue } from "react"
import { useLocation } from "wouter"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  CreditCard,
  User,
  Phone,
  Plus,
  Search,
  Banknote,
  AlertTriangle,
  Wallet,
  Users,
  ArrowUpRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { queryClient, apiRequest } from "@/lib/queryClient"
import type { Sale } from "@shared/schema"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDateFormat } from "@/hooks/use-date-format"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

const VISIBLE_LIMIT_INITIAL = 30
const VISIBLE_LIMIT_INCREMENT = 20

interface CustomerSuggestion {
  customerName: string
  customerPhone: string
  lastSaleDate: string
  totalSpent: number
  transactionCount: number
}

type ExtendedSale = Sale & {
  dueDate?: string | Date | null
  isManualBalance?: boolean
  notes?: string | null
}

type ConsolidatedCustomer = {
  customerPhone: string
  customerName: string
  bills: ExtendedSale[]
  totalAmount: number
  totalPaid: number
  totalReturnCredits: number
  totalOutstanding: number
  oldestBillDate: Date
  daysOverdue: number
  isFullyPaid: boolean
  paymentStatus: 'paid' | 'partial' | 'unpaid'
}

type ReturnRecord = {
  id: string
  saleId: string
  customerName: string
  customerPhone: string
  totalRefund: string
  refundMethod: string
  createdAt: string
}

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100
}

export default function UnpaidBills() {
  const { formatDateShort } = useDateFormat()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { canEditPayment, canEditSales } = usePermissions()

  const [searchQuery, setSearchQuery] = useState("")
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL)
  const [sortBy, setSortBy] = useState<"oldest" | "newest" | "highest" | "lowest">("highest")
  // Default: Show all bills and all payment statuses
  const [showAllBills, setShowAllBills] = useState(true)
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all")

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<ConsolidatedCustomer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentNotes, setPaymentNotes] = useState("")

  const [manualBalanceDialogOpen, setManualBalanceDialogOpen] = useState(false)
  const [manualBalanceForm, setManualBalanceForm] = useState({
    customerName: "",
    customerPhone: "",
    totalAmount: "",
    dueDate: "",
    notes: "",
  })
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false)

  const { data: customerSuggestions = [] } = useQuery<CustomerSuggestion[]>({
    queryKey: ["/api/customers/suggestions"],
  })

  const {
    data: allSalesRaw = [],
    isLoading,
    refetch: refetchAllSales,
  } = useQuery<ExtendedSale[]>({
    queryKey: ["/api/sales"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  const { data: allReturns = [] } = useQuery<ReturnRecord[]>({
    queryKey: ["/api/returns"],
  })

  const allSales = useDeferredValue(allSalesRaw)

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/sales/${data.saleId}/payment`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to record payment")
      }
      return response.json()
    },
  })

  const createManualBalanceMutation = useMutation({
    mutationFn: async (data: {
      customerName: string
      customerPhone: string
      totalAmount: string
      dueDate?: string
      notes?: string
    }) => {
      const response = await apiRequest("POST", "/api/sales/manual-balance", data)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      refetchAllSales()
      toast({
        title: "Balance added",
        description: "New pending balance has been created.",
      })
      setManualBalanceDialogOpen(false)
      setManualBalanceForm({
        customerName: "",
        customerPhone: "",
        totalAmount: "",
        dueDate: "",
        notes: "",
      })
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add balance", variant: "destructive" })
    },
  })

  const closePaymentDialog = () => {
    setPaymentDialogOpen(false)
    setPaymentAmount("")
    setPaymentNotes("")
    setPaymentMethod("cash")
    setSelectedCustomer(null)
  }

  const consolidatedCustomers = useMemo(() => {
    const returnsByPhone = new Map<string, number>()
    allReturns.forEach((ret) => {
      const phone = ret.customerPhone || "unknown"
      const existing = returnsByPhone.get(phone) || 0
      // Only count credited refunds (not cash refunds) as they reduce account balance
      if (ret.refundMethod === 'credited') {
        returnsByPhone.set(phone, existing + safeParseFloat(ret.totalRefund))
      }
    })

    const customerMap = new Map<string, ConsolidatedCustomer>()

    allSales.forEach((sale) => {
      if (sale.paymentStatus === "full_return") return

      const phone = sale.customerPhone || "unknown"
      const existing = customerMap.get(phone)

      const totalAmount = safeParseFloat(sale.totalAmount)
      const amountPaid = safeParseFloat(sale.amountPaid)

      if (existing) {
        existing.bills.push(sale)
        existing.totalAmount = roundNumber(existing.totalAmount + totalAmount)
        existing.totalPaid = roundNumber(existing.totalPaid + amountPaid)
        const saleDate = new Date(sale.createdAt)
        if (saleDate < existing.oldestBillDate) {
          existing.oldestBillDate = saleDate
        }
      } else {
        customerMap.set(phone, {
          customerPhone: phone,
          customerName: sale.customerName || "Unknown",
          bills: [sale],
          totalAmount: roundNumber(totalAmount),
          totalPaid: roundNumber(amountPaid),
          totalReturnCredits: 0,
          totalOutstanding: 0,
          oldestBillDate: new Date(sale.createdAt),
          daysOverdue: 0,
          isFullyPaid: false,
          paymentStatus: 'unpaid'
        })
      }
    })

    customerMap.forEach((customer, phone) => {
      customer.totalReturnCredits = roundNumber(returnsByPhone.get(phone) || 0)
      customer.totalOutstanding = roundNumber(
        customer.totalAmount - customer.totalPaid - customer.totalReturnCredits
      )
      customer.daysOverdue = Math.floor(
        (Date.now() - customer.oldestBillDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      customer.isFullyPaid = customer.totalOutstanding <= 0
      customer.paymentStatus = customer.totalOutstanding <= 0 ? 'paid' : 
                               customer.totalPaid > 0 ? 'partial' : 'unpaid'
    })

    return Array.from(customerMap.values())
  }, [allSales, allReturns])

  const filteredCustomers = useMemo(() => {
    let filtered = consolidatedCustomers

    // Filter by payment status
    if (!showAllBills) {
      // When "Show all bills" is OFF, only show unpaid
      filtered = filtered.filter(c => c.totalOutstanding > 0)
    } else if (paymentFilter !== "all") {
      // When "Show all bills" is ON, apply payment filter
      if (paymentFilter === "paid") {
        filtered = filtered.filter(c => c.totalOutstanding <= 0)
      } else if (paymentFilter === "unpaid") {
        filtered = filtered.filter(c => c.totalOutstanding > 0)
      }
    }

    // Filter by search query
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.customerName.toLowerCase().includes(search) ||
          c.customerPhone.includes(search)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "highest":
          return b.totalOutstanding - a.totalOutstanding
        case "lowest":
          return a.totalOutstanding - b.totalOutstanding
        case "oldest":
          return a.oldestBillDate.getTime() - b.oldestBillDate.getTime()
        case "newest":
          return b.oldestBillDate.getTime() - a.oldestBillDate.getTime()
        default:
          return b.totalOutstanding - a.totalOutstanding
      }
    })

    return filtered
  }, [consolidatedCustomers, debouncedSearch, sortBy, showAllBills, paymentFilter])

  const visibleCustomers = filteredCustomers.slice(0, visibleLimit)

  const totals = useMemo(() => {
    const allCustomers = consolidatedCustomers
    const unpaidCustomers = allCustomers.filter(c => c.totalOutstanding > 0)
    
    return {
      totalOutstanding: unpaidCustomers.reduce((sum, c) => sum + c.totalOutstanding, 0),
      totalCustomers: allCustomers.length,
      unpaidCustomers: unpaidCustomers.length,
      overdueCount: unpaidCustomers.filter(c => c.daysOverdue > 30).length,
      totalPaid: allCustomers.reduce((sum, c) => sum + c.totalPaid, 0),
      totalAmount: allCustomers.reduce((sum, c) => sum + c.totalAmount, 0),
    }
  }, [consolidatedCustomers])

  const openPaymentDialog = (customer: ConsolidatedCustomer, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setPaymentDialogOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      toast({ title: "Enter payment amount", variant: "destructive" })
      return
    }

    const amount = roundNumber(Number.parseFloat(paymentAmount))
    if (amount <= 0) {
      toast({ title: "Amount must be positive", variant: "destructive" })
      return
    }

    if (amount > selectedCustomer.totalOutstanding) {
      toast({
        title: "Amount exceeds outstanding balance",
        description: `Outstanding: Rs. ${Math.round(selectedCustomer.totalOutstanding).toLocaleString()}`,
        variant: "destructive",
      })
      return
    }

    setIsProcessingPayment(true)
    const customerName = selectedCustomer.customerName
    const totalPaymentAmount = amount

    try {
      const sortedBills = [...selectedCustomer.bills].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      let remainingPayment = amount
      for (const bill of sortedBills) {
        if (remainingPayment <= 0) break

        const billTotal = safeParseFloat(bill.totalAmount)
        const billPaid = safeParseFloat(bill.amountPaid)
        const billOutstanding = roundNumber(billTotal - billPaid)

        if (billOutstanding > 0) {
          const paymentForThisBill = Math.min(billOutstanding, remainingPayment)
          await recordPaymentMutation.mutateAsync({
            saleId: bill.id,
            amount: paymentForThisBill,
            paymentMethod,
            notes: paymentNotes || undefined,
          })
          remainingPayment = roundNumber(remainingPayment - paymentForThisBill)
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      refetchAllSales()

      toast({
        title: "Payment recorded",
        description: `Rs. ${Math.round(totalPaymentAmount).toLocaleString()} payment for ${customerName} recorded successfully.`,
      })

      closePaymentDialog()
    } catch (error: any) {
      toast({
        title: "Failed to record payment",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleCreateManualBalance = () => {
    if (!manualBalanceForm.customerName || !manualBalanceForm.customerPhone || !manualBalanceForm.totalAmount) {
      toast({ title: "Fill all required fields", variant: "destructive" })
      return
    }
    createManualBalanceMutation.mutate(manualBalanceForm)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {showAllBills ? "All Bills" : "Unpaid Bills"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {showAllBills ? "View all customer bills and payments" : "Track and manage customer balances"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showAllBills}
              onCheckedChange={setShowAllBills}
              id="show-all-bills"
              data-testid="switch-show-all-bills"
            />
            <Label htmlFor="show-all-bills" className="text-sm cursor-pointer">
              Show all bills
            </Label>
          </div>
          {canEditSales && (
            <Button
              onClick={() => setManualBalanceDialogOpen(true)}
              className="gap-2"
              data-testid="button-add-balance"
            >
              <Plus className="h-4 w-4" />
              Add Balance
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Wallet className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 font-mono" data-testid="text-total-outstanding">
                  Rs. {Math.round(totals.totalOutstanding).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {showAllBills ? "Total Customers" : "Customers with Balance"}
                </p>
                <p className="text-xl font-bold text-foreground font-mono" data-testid="text-total-customers">
                  {showAllBills ? totals.totalCustomers : totals.unpaidCustomers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono" data-testid="text-total-paid">
                  Rs. {Math.round(totals.totalPaid).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue (30+ days)</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono" data-testid="text-overdue-count">
                  {totals.overdueCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        
        {/* Always show payment filter, default to "all" */}
        <Select value={paymentFilter} onValueChange={(v: "all" | "paid" | "unpaid") => setPaymentFilter(v)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-payment-filter">
            <SelectValue placeholder="Filter by payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bills</SelectItem>
            <SelectItem value="paid">Paid Only</SelectItem>
            <SelectItem value="unpaid">Unpaid Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="highest">Highest Balance</SelectItem>
            <SelectItem value="lowest">Lowest Balance</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {visibleCustomers.length} of {filteredCustomers.length} customers
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">
            Total Bills: Rs. {Math.round(totals.totalAmount).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? "No customers found" : 
               showAllBills ? "No bills found" : "All payments received"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try a different search term" : 
               showAllBills ? "There are no bills to display" : "No unpaid bills to display"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCustomers.map((customer) => (
            <Card
              key={customer.customerPhone}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                customer.isFullyPaid ? 'border-emerald-200 dark:border-emerald-900/50' : ''
              }`}
              onClick={() => setLocation(`/customer/${encodeURIComponent(customer.customerPhone)}`)}
              data-testid={`card-customer-${customer.customerPhone}`}
            >
              <CardContent className="p-4">
                {/* Customer Info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      customer.isFullyPaid 
                        ? "bg-emerald-100 dark:bg-emerald-900/30" 
                        : customer.daysOverdue > 30 
                          ? "bg-red-100 dark:bg-red-900/30" 
                          : "bg-blue-100 dark:bg-blue-900/30"
                    }`}>
                      {customer.isFullyPaid ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <User className={`h-4 w-4 ${
                          customer.daysOverdue > 30 
                            ? "text-red-600 dark:text-red-400" 
                            : "text-blue-600 dark:text-blue-400"
                        }`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {customer.customerName}
                        </h3>
                        {customer.isFullyPaid && (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
                            Paid
                          </Badge>
                        )}
                        {customer.paymentStatus === 'partial' && customer.totalOutstanding > 0 && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                            Partial
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {customer.customerPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {customer.bills.length > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {customer.bills.length} bills
                      </Badge>
                    )}
                    {!customer.isFullyPaid && customer.daysOverdue > 30 && (
                      <Badge variant="destructive" className="text-xs">
                        {customer.daysOverdue}d
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Amount Summary */}
                <div className={`rounded-lg p-3 space-y-2 mb-3 ${
                  customer.isFullyPaid 
                    ? "bg-emerald-50 dark:bg-emerald-900/20" 
                    : "bg-muted/50"
                }`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Bills</span>
                    <span className="font-mono font-medium">
                      Rs. {Math.round(customer.totalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className={`font-mono font-medium ${
                      customer.isFullyPaid 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      Rs. {Math.round(customer.totalPaid).toLocaleString()}
                    </span>
                  </div>
                  {customer.totalReturnCredits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Returns</span>
                      <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                        Rs. {Math.round(customer.totalReturnCredits).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-medium">
                      {customer.isFullyPaid ? "Balance Status" : "Balance Due"}
                    </span>
                    <span className={`font-mono font-bold ${
                      customer.isFullyPaid 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {customer.isFullyPaid ? (
                        "Fully Paid"
                      ) : (
                        `Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}`
                      )}
                    </span>
                  </div>
                  {customer.isFullyPaid && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 text-center pt-1">
                      Paid on {formatDateShort(customer.oldestBillDate)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {canEditPayment && !customer.isFullyPaid && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={(e) => openPaymentDialog(customer, e)}
                      data-testid={`button-pay-${customer.customerPhone}`}
                    >
                      <Banknote className="h-4 w-4" />
                      Record Payment
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1 ${!canEditPayment || customer.isFullyPaid ? "flex-1" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocation(`/customer/${encodeURIComponent(customer.customerPhone)}`)
                    }}
                    data-testid={`button-view-${customer.customerPhone}`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Load More */}
          {filteredCustomers.length > visibleLimit && (
            <div className="col-span-full flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => setVisibleLimit((prev) => prev + VISIBLE_LIMIT_INCREMENT)}
                data-testid="button-load-more"
              >
                Load More ({filteredCustomers.length - visibleLimit} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Recording payment for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Bills</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-mono text-emerald-600">Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-border">
                  <span>Outstanding</span>
                  <span className="font-mono text-red-600">Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount (Rs.)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="input-payment-amount"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPaymentAmount(String(Math.round(selectedCustomer.totalOutstanding)))}
                  data-testid="button-pay-full"
                >
                  Pay Full: Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Add payment notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  data-testid="input-payment-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closePaymentDialog} disabled={isProcessingPayment}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={isProcessingPayment}
              data-testid="button-confirm-payment"
            >
              {isProcessingPayment ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manual Balance Dialog */}
      <Dialog open={manualBalanceDialogOpen} onOpenChange={setManualBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Pending Balance
            </DialogTitle>
            <DialogDescription>
              Add a manual balance entry for a customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone Number</Label>
              <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                    data-testid="button-customer-select"
                  >
                    {manualBalanceForm.customerPhone || "Select or enter phone..."}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search customer..."
                      value={manualBalanceForm.customerPhone}
                      onValueChange={(value) =>
                        setManualBalanceForm((prev) => ({ ...prev, customerPhone: value }))
                      }
                    />
                    <CommandList>
                      <CommandEmpty>No customer found</CommandEmpty>
                      <CommandGroup>
                        {customerSuggestions.slice(0, 10).map((customer) => (
                          <CommandItem
                            key={customer.customerPhone}
                            onSelect={() => {
                              setManualBalanceForm((prev) => ({
                                ...prev,
                                customerPhone: customer.customerPhone,
                                customerName: customer.customerName,
                              }))
                              setCustomerSuggestionsOpen(false)
                            }}
                          >
                            <div>
                              <p className="font-medium">{customer.customerName}</p>
                              <p className="text-sm text-muted-foreground">{customer.customerPhone}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                placeholder="Enter name"
                value={manualBalanceForm.customerName}
                onChange={(e) =>
                  setManualBalanceForm((prev) => ({ ...prev, customerName: e.target.value }))
                }
                data-testid="input-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="balanceAmount">Amount (Rs.)</Label>
              <Input
                id="balanceAmount"
                type="number"
                placeholder="0"
                value={manualBalanceForm.totalAmount}
                onChange={(e) =>
                  setManualBalanceForm((prev) => ({ ...prev, totalAmount: e.target.value }))
                }
                data-testid="input-balance-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={manualBalanceForm.dueDate}
                onChange={(e) =>
                  setManualBalanceForm((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                data-testid="input-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="balanceNotes">Notes (Optional)</Label>
              <Textarea
                id="balanceNotes"
                placeholder="Add notes..."
                value={manualBalanceForm.notes}
                onChange={(e) =>
                  setManualBalanceForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
                data-testid="input-balance-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualBalanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateManualBalance}
              disabled={createManualBalanceMutation.isPending}
              data-testid="button-confirm-balance"
            >
              {createManualBalanceMutation.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}