"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { useLocation, useParams, Link } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  User,
  Phone,
  Calendar,
  Receipt,
  Wallet,
  CheckCircle,
  AlertCircle,
  Download,
  History,
  TrendingUp,
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  MessageCircle,
  ArrowDownCircle,
  Landmark,
  CalendarClock,
  Eye,
  ChevronDown,
  ChevronRight,
  Package,
  RefreshCw,
} from "lucide-react"
import { useState, useMemo, Fragment } from "react"
import { SiWhatsapp } from "react-icons/si"
import { useToast } from "@/hooks/use-toast"
import { useDateFormat } from "@/hooks/use-date-format"
import { useReceiptSettings } from "@/hooks/use-receipt-settings"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { Sale, PaymentHistory, SaleWithItems } from "@shared/schema"
import jsPDF from "jspdf"

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale
}

type TransactionType = "bill" | "payment" | "cash_loan" | "return"

interface SaleItemDisplay {
  productName: string
  variantName: string
  colorName: string
  colorCode: string
  quantity: number
  rate: number
  subtotal: number
}

interface Transaction {
  id: string
  date: Date
  type: TransactionType
  description: string
  reference: string
  debit: number
  credit: number
  balance: number
  paid: number
  totalAmount: number
  outstanding: number
  notes?: string
  dueDate?: Date | null
  status?: string
  saleId?: string
  items?: SaleItemDisplay[]
  billReturns?: number // Returns specific to this bill
}

// Utility function to safely parse numbers
const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

// Utility function to safely parse dates
const safeParseDate = (value: any): Date => {
  if (!value) return new Date()
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

// Utility function to round numbers for display
const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100
}

// Helper function to get credited refund amount (0 for cash refunds)
const getCreditedRefundAmount = (ret: any): number => {
  return ret.refundMethod === 'credit' ? safeParseFloat(ret.totalRefund) : 0
}

export default function CustomerStatement() {
  const { formatDateShort } = useDateFormat()
  const { receiptSettings } = useReceiptSettings()
  const params = useParams<{ phone: string }>()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const customerPhone = params.phone || ""

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentNotes, setPaymentNotes] = useState("")

  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryWithSale | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState("")
  const [editPaymentMethod, setEditPaymentMethod] = useState("")
  const [editPaymentNotes, setEditPaymentNotes] = useState("")

  const [cashLoanDialogOpen, setCashLoanDialogOpen] = useState(false)
  const [cashLoanAmount, setCashLoanAmount] = useState("")
  const [cashLoanNotes, setCashLoanNotes] = useState("")
  const [cashLoanDueDate, setCashLoanDueDate] = useState("")

  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentHistoryWithSale | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Clear Full Account state
  const [clearAccountDialogOpen, setClearAccountDialogOpen] = useState(false)
  const [clearAccountMethod, setClearAccountMethod] = useState("cash")
  const [clearAccountNotes, setClearAccountNotes] = useState("")
  const [clearAccountProcessing, setClearAccountProcessing] = useState(false)

  const toggleRowExpand = (rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.add(rowId)
      }
      return newSet
    })
  }

  // OPTIMIZED: Single combined API call for all customer statement data
  const { data: statementData, isLoading: statementLoading } = useQuery<{
    sales: SaleWithItems[]
    payments: PaymentHistoryWithSale[]
    returns: any[]
    summary: { totalSales: number; totalPayments: number; totalReturns: number }
  }>({
    queryKey: ["/api/customer", customerPhone, "statement"],
    queryFn: async () => {
      const res = await fetch(`/api/customer/${encodeURIComponent(customerPhone)}/statement`)
      if (!res.ok) throw new Error("Failed to fetch customer statement")
      return res.json()
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0, // Always fetch fresh data on mount
  })

  // Extract data from combined response
  const allSalesWithItems = statementData?.sales || []
  const allSales = allSalesWithItems as Sale[]
  const paymentHistory = statementData?.payments || []
  const customerReturns = statementData?.returns || []
  const salesLoading = statementLoading
  const historyLoading = statementLoading

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/sales/${data.saleId}/payment`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer", customerPhone, "statement"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      setPaymentDialogOpen(false)
      setPaymentAmount("")
      setPaymentNotes("")
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      })
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/payment-history/${data.id}`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer", customerPhone, "statement"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] })
      setEditPaymentDialogOpen(false)
      setEditingPayment(null)
      toast({
        title: "Payment Updated",
        description: "Payment has been successfully updated.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      })
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/payment-history/${id}`)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer", customerPhone, "statement"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] })
      setDeletePaymentDialogOpen(false)
      setPaymentToDelete(null)
      toast({
        title: "Payment Deleted",
        description: "Payment record has been deleted.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      })
    },
  })

  const addCashLoanMutation = useMutation({
    mutationFn: async (data: { amount: string; notes: string; dueDate: string | null }) => {
      const customerName = allSales[0]?.customerName || "Customer"
      const response = await apiRequest("POST", "/api/sales/manual-balance", {
        customerName,
        customerPhone,
        totalAmount: data.amount,
        dueDate: data.dueDate,
        notes: data.notes || `Manual balance of Rs. ${data.amount}`,
        isManualBalance: true,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer", customerPhone, "statement"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      setCashLoanDialogOpen(false)
      setCashLoanAmount("")
      setCashLoanNotes("")
      setCashLoanDueDate("")
      toast({
        title: "Manual Balance Added",
        description: "Manual balance has been added to customer account.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add manual balance",
        variant: "destructive",
      })
    },
  })

  // Function to clear full account - pay all unpaid bills at once
  const handleClearFullAccount = async () => {
    if (unpaidSales.length === 0) {
      toast({
        title: "No Unpaid Bills",
        description: "All bills are already paid.",
      })
      return
    }

    setClearAccountProcessing(true)
    let successCount = 0
    const failedBills: string[] = []

    try {
      // Process each unpaid bill sequentially
      for (const sale of unpaidSales) {
        const outstanding = roundNumber(safeParseFloat(sale.totalAmount) - safeParseFloat(sale.amountPaid))
        if (outstanding <= 0) continue

        try {
          await apiRequest("POST", `/api/sales/${sale.id}/payment`, {
            amount: outstanding,
            paymentMethod: clearAccountMethod,
            notes: clearAccountNotes || `Full account clearance payment`,
          })
          successCount++
        } catch (error) {
          const billRef = sale.isManualBalance ? "Manual Balance" : `Bill #${sale.id.slice(0, 8)}`
          failedBills.push(billRef)
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/customer", customerPhone, "statement"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })

      setClearAccountDialogOpen(false)
      setClearAccountMethod("cash")
      setClearAccountNotes("")

      if (failedBills.length === 0) {
        toast({
          title: "Account Cleared",
          description: `Successfully paid ${successCount} bill(s). Account balance is now zero.`,
        })
      } else {
        toast({
          title: "Partial Success",
          description: `Paid ${successCount} bill(s). Failed: ${failedBills.join(", ")}. Please check remaining bills.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setClearAccountProcessing(false)
    }
  }

  const customerName = allSales[0]?.customerName || "Customer"

  // Calculate returns per sale
  const getSaleReturns = (saleId: string): number => {
    return customerReturns
      .filter(ret => ret.saleId === saleId)
      .reduce((sum, ret) => sum + getCreditedRefundAmount(ret), 0)
  }

  const paidSales = useMemo(() => {
    return allSales.filter((s) => {
      const total = safeParseFloat(s.totalAmount)
      const paid = safeParseFloat(s.amountPaid)
      const returns = getSaleReturns(s.id)
      // Sale is paid if total - paid - returns <= 0
      return roundNumber(total - paid - returns) <= 0
    })
  }, [allSales, customerReturns])

  const unpaidSales = useMemo(() => {
    return allSales.filter((s) => {
      const total = safeParseFloat(s.totalAmount)
      const paid = safeParseFloat(s.amountPaid)
      const returns = getSaleReturns(s.id)
      // Sale is unpaid if total - paid - returns > 0
      return roundNumber(total - paid - returns) > 0
    })
  }, [allSales, customerReturns])

  // Corrected and improved stats calculations - INCLUDING return credits and credit balances
  const stats = useMemo(() => {
    const totalPurchases = allSales.reduce((sum, s) => sum + safeParseFloat(s.totalAmount), 0)
    const totalPaid = allSales.reduce((sum, s) => sum + safeParseFloat(s.amountPaid), 0)
    const totalPaymentsReceived = paymentHistory.reduce((sum, p) => sum + safeParseFloat(p.amount), 0)
    
    // Calculate total return credits (only credited refunds reduce outstanding balance, not cash refunds)
    const totalReturnCredits = customerReturns.reduce((sum, r) => sum + getCreditedRefundAmount(r), 0)
    
    // Outstanding = Bills - Payments - Returns (can be negative for credit/advance)
    // Negative value means customer has credit/advance balance
    const totalOutstanding = roundNumber(totalPurchases - totalPaid - totalReturnCredits)
    const hasCredit = totalOutstanding < 0
    // displayOutstanding is always positive for display purposes
    const displayOutstanding = roundNumber(Math.abs(totalOutstanding))

    return {
      totalBills: allSales.length,
      paidBills: paidSales.length,
      unpaidBills: unpaidSales.length,
      totalPurchases: roundNumber(totalPurchases),
      totalPaid: roundNumber(totalPaid),
      totalOutstanding: totalOutstanding, // Keep signed value for consistency with ledger
      displayOutstanding, // Positive value for display
      hasCredit,
      totalPaymentsReceived: roundNumber(totalPaymentsReceived),
      totalReturnCredits: roundNumber(totalReturnCredits),
      totalReturns: customerReturns.length,
    }
  }, [allSales, paidSales, unpaidSales, paymentHistory, customerReturns])

  // FIXED: Corrected transactions calculation with proper balance tracking
  // User's preferred logic: Show DEBIT and CREDIT in the SAME row for bills paid at POS
  const transactions = useMemo((): Transaction[] => {
    const txns: Transaction[] = []

    // First, collect all bills in chronological order
    // Include initial payment (at POS) as credit in the same row
    const billTransactions: Transaction[] = allSalesWithItems.map((sale) => {
      const saleItems: SaleItemDisplay[] =
        sale.saleItems?.map((item) => ({
          productName: item.color?.variant?.product?.productName || "Product",
          variantName: item.color?.variant?.packingSize || "Variant",
          colorName: item.color?.colorName || "Color",
          colorCode: item.color?.colorCode || "",
          quantity: item.quantity,
          rate: safeParseFloat(item.rate),
          subtotal: safeParseFloat(item.subtotal),
        })) || []

      const totalAmt = roundNumber(safeParseFloat(sale.totalAmount))
      const paidAmt = roundNumber(safeParseFloat(sale.amountPaid))
      
      // Calculate returns for this specific bill (only credited returns count)
      const billReturns = roundNumber(customerReturns
        .filter(ret => ret.saleId === sale.id)
        .reduce((sum, ret) => sum + getCreditedRefundAmount(ret), 0))
      
      // Outstanding = Bill amount - Payments - Returns for this bill
      const outstandingAmt = roundNumber(Math.max(0, totalAmt - paidAmt - billReturns))
      
      // Calculate initial payment (paid at POS, not via recovery)
      // Initial payment = amountPaid - sum of recovery payments for this sale
      // Use roundNumber to avoid floating point precision issues
      const recoveryPayments = roundNumber(paymentHistory
        .filter((p) => p.saleId === sale.id)
        .reduce((sum, p) => sum + safeParseFloat(p.amount), 0))
      const initialPayment = roundNumber(Math.max(0, paidAmt - recoveryPayments))

      return {
        id: `bill-${sale.id}`,
        date: safeParseDate(sale.createdAt),
        type: sale.isManualBalance ? "cash_loan" : "bill",
        description: sale.isManualBalance 
          ? "Manual Balance" 
          : `Bill #${sale.id.slice(0, 8)}${billReturns > 0 ? ` (Return: Rs. ${Math.round(billReturns).toLocaleString()})` : ''}`,
        reference: sale.id.slice(0, 8).toUpperCase(),
        debit: totalAmt,
        credit: initialPayment, // Include initial payment as credit in same row
        balance: 0,
        paid: paidAmt,
        totalAmount: totalAmt,
        outstanding: outstandingAmt,
        notes: sale.notes || undefined,
        dueDate: sale.dueDate ? safeParseDate(sale.dueDate) : null,
        status: sale.paymentStatus,
        saleId: sale.id,
        items: saleItems.length > 0 ? saleItems : undefined,
        billReturns: billReturns // Store returns for this bill
      }
    })

    // Then collect all payments from payment_history (recovery payments only)
    // These are payments made AFTER the initial sale
    const paymentTransactions: Transaction[] = paymentHistory.map((payment) => ({
      id: `payment-${payment.id}`,
      date: safeParseDate(payment.createdAt),
      type: "payment",
      description: `Payment Received (${payment.paymentMethod.toUpperCase()})`,
      reference: payment.id.slice(0, 8).toUpperCase(),
      debit: 0,
      credit: safeParseFloat(payment.amount),
      balance: 0,
      paid: 0,
      totalAmount: 0,
      outstanding: 0,
      notes: payment.notes || undefined,
      saleId: payment.saleId,
    }))

    // Collect all returns as transactions (refunds reduce balance)
    const returnTransactions: Transaction[] = customerReturns.map((ret) => {
      const refundAmount = safeParseFloat(ret.totalRefund)
      const returnItems: SaleItemDisplay[] = ret.returnItems?.map((item: any) => ({
        productName: item.color?.variant?.product?.productName || "Product",
        variantName: item.color?.variant?.packingSize || "Variant",
        colorName: item.color?.colorName || "Color",
        colorCode: item.color?.colorCode || "",
        quantity: item.quantity,
        rate: safeParseFloat(item.rate),
        subtotal: safeParseFloat(item.subtotal),
      })) || []

      const returnMethod = ret.returnType === "bill" ? "Full Bill Return" : "Item Return"
      const reasonText = ret.reason ? ` - ${ret.reason}` : ""

      // If refund method is "cash", credit should be 0 (no credit to account)
      // If refund method is "credited", credit should be the refund amount
      const creditAmount = getCreditedRefundAmount(ret)

      return {
        id: `return-${ret.id}`,
        date: safeParseDate(ret.createdAt),
        type: "return" as TransactionType,
        description: `${returnMethod}${reasonText}`,
        reference: `RET-${ret.id.slice(0, 6).toUpperCase()}`,
        debit: 0,
        credit: creditAmount,
        balance: 0,
        paid: refundAmount,
        totalAmount: 0,
        outstanding: 0,
        notes: ret.reason || undefined,
        saleId: ret.saleId || undefined,
        items: returnItems.length > 0 ? returnItems : undefined,
      }
    })

    // Combine and sort by date and time (oldest first for balance calculation)
    txns.push(...billTransactions, ...paymentTransactions, ...returnTransactions)
    txns.sort((a, b) => {
      const dateA = safeParseDate(a.date)
      const dateB = safeParseDate(b.date)
      const timeDiff = dateA.getTime() - dateB.getTime()
      // If same timestamp, sort by ID for consistent ordering
      if (timeDiff === 0) {
        return a.id.localeCompare(b.id)
      }
      return timeDiff
    })

    // Calculate running balance with combined debit/credit per row
    // For bills: net effect = debit - credit (bill amount minus initial payment)
    // For payments/returns: net effect = -credit (reduces balance)
    // Use roundNumber to avoid floating point precision issues
    let runningBalance = 0
    
    txns.forEach((txn) => {
      if (txn.type === "payment" || txn.type === "return") {
        // Payments and returns reduce the balance (customer pays us / we refund)
        runningBalance = roundNumber(runningBalance - txn.credit)
      } else {
        // Bills: add debit (bill amount) and subtract credit (initial payment at POS)
        // This gives the net effect in one row
        runningBalance = roundNumber(runningBalance + txn.debit - txn.credit)
      }
      txn.balance = runningBalance
    })

    // Return in descending order (newest first for display) - always
    return [...txns].reverse()
  }, [allSalesWithItems, paymentHistory, customerReturns])

  const scheduledPayments = useMemo(() => {
    const now = new Date()
    return unpaidSales
      .filter((s) => s.dueDate)
      .map((s) => {
        const total = safeParseFloat(s.totalAmount)
        const paid = safeParseFloat(s.amountPaid)
        const returns = getSaleReturns(s.id)
        const outstanding = roundNumber(total - paid - returns)
        
        return {
          ...s,
          dueDate: safeParseDate(s.dueDate!),
          outstanding: Math.max(0, outstanding),
        }
      })
      .sort((a, b) => {
        const dateA = safeParseDate(a.dueDate)
        const dateB = safeParseDate(b.dueDate)
        return dateA.getTime() - dateB.getTime()
      })
  }, [unpaidSales, customerReturns])

  const getDueDateStatus = (dueDate: Date | null) => {
    if (!dueDate) return "none"
    const now = new Date()
    const due = safeParseDate(dueDate)
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "overdue"
    if (diffDays <= 7) return "due_soon"
    return "normal"
  }

  const handleRecordPayment = () => {
    if (!selectedSaleId || !paymentAmount) return

    const amount = Number.parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      })
      return
    }

    recordPaymentMutation.mutate({
      saleId: selectedSaleId,
      amount,
      paymentMethod,
      notes: paymentNotes,
    })
  }

  const handleUpdatePayment = () => {
    if (!editingPayment || !editPaymentAmount) return

    const amount = Number.parseFloat(editPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      })
      return
    }

    updatePaymentMutation.mutate({
      id: editingPayment.id,
      amount,
      paymentMethod: editPaymentMethod,
      notes: editPaymentNotes,
    })
  }

  const handleAddCashLoan = () => {
    if (!cashLoanAmount) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount for the manual balance",
        variant: "destructive",
      })
      return
    }

    const amount = Number.parseFloat(cashLoanAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    addCashLoanMutation.mutate({
      amount: cashLoanAmount,
      notes: cashLoanNotes,
      dueDate: cashLoanDueDate || null,
    })
  }

  const openEditPayment = (payment: PaymentHistoryWithSale) => {
    setEditingPayment(payment)
    setEditPaymentAmount(payment.amount.toString())
    setEditPaymentMethod(payment.paymentMethod)
    setEditPaymentNotes(payment.notes || "")
    setEditPaymentDialogOpen(true)
  }

  const selectedSale = selectedSaleId ? allSales.find((s) => s.id === selectedSaleId) : null
  const selectedSaleReturns = selectedSale ? getSaleReturns(selectedSale.id) : 0
  const selectedSaleOutstanding = selectedSale
    ? Math.max(0, roundNumber(safeParseFloat(selectedSale.totalAmount) - safeParseFloat(selectedSale.amountPaid) - selectedSaleReturns))
    : 0

  const generateBankStatement = async () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPos = margin

    const drawHeader = () => {
      pdf.setFillColor(102, 126, 234)
      pdf.rect(0, 0, pageWidth, 35, "F")

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont("helvetica", "bold")
      pdf.text("ACCOUNT STATEMENT", pageWidth / 2, 15, { align: "center" })

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      pdf.text(receiptSettings.businessName, pageWidth / 2, 23, { align: "center" })
      pdf.text(receiptSettings.address, pageWidth / 2, 29, { align: "center" })

      pdf.setTextColor(0, 0, 0)
      yPos = 45
    }

    const addSectionHeader = (text: string) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage()
        yPos = margin
      }
      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, "F")
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "bold")
      pdf.text(text, margin + 3, yPos + 2)
      yPos += 10
    }

    drawHeader()

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("Account Holder:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerName, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Phone:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerPhone, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Statement Date:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(formatDateShort(new Date()), margin + 35, yPos)
    yPos += 10

    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    addSectionHeader("ACCOUNT SUMMARY")

    const balanceLabel = stats.hasCredit ? "Credit:" : "Outstanding:"
    const balanceValue = `Rs. ${stats.displayOutstanding.toLocaleString()}`
    const summaryData = [
      ["Total Bills:", stats.totalBills.toString(), "Total Purchases:", `Rs. ${stats.totalPurchases.toLocaleString()}`],
      ["Paid Bills:", stats.paidBills.toString(), "Total Paid:", `Rs. ${stats.totalPaid.toLocaleString()}`],
      ["Unpaid Bills:", stats.unpaidBills.toString(), "Total Returns:", `Rs. ${stats.totalReturnCredits.toLocaleString()}`],
      ["Total Returns:", stats.totalReturns.toString(), balanceLabel, balanceValue],
    ]

    pdf.setFontSize(9)
    summaryData.forEach((row) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(row[0], margin + 5, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.text(row[1], margin + 35, yPos)
      pdf.setFont("helvetica", "bold")
      pdf.text(row[2], margin + 70, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.text(row[3], margin + 105, yPos)
      yPos += 6
    })
    yPos += 8

    addSectionHeader("TRANSACTION HISTORY")

    const addLedgerRow = (cols: string[], isHeader = false, bgColor?: [number, number, number]) => {
      if (yPos > pageHeight - 15) {
        pdf.addPage()
        yPos = margin + 5
      }

      const colWidths = [22, 45, 25, 25, 25, 28]
      let xPos = margin

      if (bgColor) {
        pdf.setFillColor(...bgColor)
        pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, "F")
      }

      pdf.setFontSize(isHeader ? 8 : 7)
      pdf.setFont("helvetica", isHeader ? "bold" : "normal")

      cols.forEach((col, i) => {
        const align = i >= 2 ? "right" : "left"
        const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2
        pdf.text(col, textX, yPos, { align: align as "left" | "right" })
        xPos += colWidths[i]
      })

      yPos += 6
    }

    addLedgerRow(["DATE", "DESCRIPTION", "AMOUNT", "PAID", "DUE", "BALANCE"], true, [220, 220, 220])

    for (const txn of transactions) {
      const dateStr = formatDateShort(txn.date)
      const outstanding = txn.type !== "payment" && txn.type !== "return" ? Math.max(0, txn.totalAmount - txn.paid) : 0
      let amountStr = "-"
      let paidStr = "-"
      let dueStr = "-"

      if (txn.type === "payment" || txn.type === "return") {
        paidStr = `Rs. ${Math.round(txn.credit).toLocaleString()}`
      } else {
        amountStr = `Rs. ${Math.round(txn.totalAmount).toLocaleString()}`
        paidStr = "-"
        dueStr = outstanding > 0 ? `Rs. ${Math.round(outstanding).toLocaleString()}` : "CLEAR"
      }

      const balanceStr = `Rs. ${Math.round(txn.balance).toLocaleString()}`

      const bgColor: [number, number, number] =
        txn.type === "payment"
          ? [220, 245, 220]
          : txn.type === "return"
            ? [255, 230, 200]
            : txn.type === "cash_loan"
              ? [255, 240, 210]
              : txn.status === "paid"
                ? [210, 235, 255]
                : [245, 245, 250]

      addLedgerRow([dateStr, txn.description, amountStr, paidStr, dueStr, balanceStr], false, bgColor)

      if (txn.items && txn.items.length > 0) {
        const items = txn.items

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(6)

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (yPos > pageHeight - 15) {
            pdf.addPage()
            yPos = margin + 5
          }

          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
          pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 5, "F")

          pdf.setTextColor(50, 50, 70)
          const productInfo = `     - ${item.productName} | ${item.variantName} | ${item.colorName}${item.colorCode ? ` [${item.colorCode}]` : ""}    ${item.quantity} x Rs.${Math.round(item.rate).toLocaleString()} = Rs.${Math.round(item.subtotal).toLocaleString()}`
          pdf.text(productInfo, margin + 5, yPos)
          yPos += 4
        }
        pdf.setTextColor(0, 0, 0)
      }

      if (txn.notes && txn.type !== "payment") {
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 5, "F")

        pdf.setFontSize(6)
        pdf.setTextColor(70, 70, 70)
        pdf.text(`     Note: ${txn.notes}`, margin + 5, yPos)
        pdf.setTextColor(0, 0, 0)
        yPos += 5
      }

      pdf.setDrawColor(200, 200, 200)
      pdf.line(margin, yPos - 1, pageWidth - margin, yPos - 1)
      yPos += 2
    }

    yPos += 10
    pdf.setDrawColor(100, 100, 100)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    const closingBalance = transactions.length > 0 ? transactions[0].balance : 0
    const closingLabel = closingBalance < 0 ? "CREDIT BALANCE" : "CLOSING BALANCE"
    const closingDisplay = Math.abs(closingBalance)
    pdf.text(`${closingLabel}: Rs. ${Math.round(closingDisplay).toLocaleString()}`, pageWidth - margin, yPos, {
      align: "right",
    })
    yPos += 15

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text("This is a computer-generated statement and does not require a signature.", pageWidth / 2, yPos, {
      align: "center",
    })
    yPos += 5
    pdf.text("Thank you for your business!", pageWidth / 2, yPos, { align: "center" })

    pdf.save(`Statement-${customerName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`)

    toast({
      title: "Statement Downloaded",
      description: "Bank-style statement has been downloaded as PDF.",
    })
  }

  const formatPhoneForWhatsApp = (phone: string): string | null => {
    if (!phone || phone.trim().length < 10) {
      return null
    }
    let cleaned = phone.replace(/[^\d+]/g, "")
    if (cleaned.length < 10) {
      return null
    }
    if (cleaned.startsWith("0")) {
      cleaned = "92" + cleaned.slice(1)
    } else if (!cleaned.startsWith("92") && !cleaned.startsWith("+92")) {
      cleaned = "92" + cleaned
    }
    cleaned = cleaned.replace(/^\+/, "")
    if (cleaned.length < 12) {
      return null
    }
    return cleaned
  }

  const generateStatementPDFBlob = (): Blob | null => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPos = margin

    const drawHeader = () => {
      pdf.setFillColor(102, 126, 234)
      pdf.rect(0, 0, pageWidth, 35, "F")

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont("helvetica", "bold")
      pdf.text("ACCOUNT STATEMENT", pageWidth / 2, 15, { align: "center" })

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      pdf.text(receiptSettings.businessName, pageWidth / 2, 23, { align: "center" })
      pdf.text(receiptSettings.address, pageWidth / 2, 29, { align: "center" })

      pdf.setTextColor(0, 0, 0)
      yPos = 45
    }

    drawHeader()

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("Account Holder:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerName, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Phone:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerPhone, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Statement Date:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(formatDateShort(new Date()), margin + 35, yPos)
    yPos += 10

    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 20, "F")
    yPos += 5

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    const colWidth = (pageWidth - 2 * margin) / 3
    pdf.text("Total Purchases", margin + colWidth / 2, yPos, { align: "center" })
    pdf.text("Total Paid", margin + colWidth + colWidth / 2, yPos, { align: "center" })
    pdf.text(stats.hasCredit ? "Credit Balance" : "Balance Due", margin + 2 * colWidth + colWidth / 2, yPos, { align: "center" })
    yPos += 6

    pdf.setFontSize(11)
    pdf.text(`Rs. ${stats.totalPurchases.toLocaleString()}`, margin + colWidth / 2, yPos, { align: "center" })
    pdf.text(`Rs. ${stats.totalPaid.toLocaleString()}`, margin + colWidth + colWidth / 2, yPos, { align: "center" })
    const balanceDisplay = stats.displayOutstanding
    pdf.text(`Rs. ${balanceDisplay.toLocaleString()}`, margin + 2 * colWidth + colWidth / 2, yPos, {
      align: "center",
    })
    yPos += 15

    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    pdf.text("DATE", margin + 3, yPos + 5.5)
    pdf.text("DESCRIPTION", margin + 35, yPos + 5.5)
    pdf.text("DEBIT", pageWidth - margin - 55, yPos + 5.5, { align: "right" })
    pdf.text("CREDIT", pageWidth - margin - 30, yPos + 5.5, { align: "right" })
    pdf.text("BALANCE", pageWidth - margin - 3, yPos + 5.5, { align: "right" })
    yPos += 10
    pdf.setTextColor(0, 0, 0)

    const sortedTransactions = [...transactions].reverse()
    sortedTransactions.forEach((tx, index) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage()
        yPos = margin
      }

      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255]
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 8, "F")

      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.text(formatDateShort(tx.date), margin + 3, yPos + 2)

      const desc = tx.description.length > 35 ? tx.description.substring(0, 35) + "..." : tx.description
      pdf.text(desc, margin + 35, yPos + 2)

      pdf.text(tx.debit > 0 ? `Rs. ${Math.round(tx.debit).toLocaleString()}` : "-", pageWidth - margin - 55, yPos + 2, {
        align: "right",
      })
      pdf.text(
        tx.credit > 0 ? `Rs. ${Math.round(tx.credit).toLocaleString()}` : "-",
        pageWidth - margin - 30,
        yPos + 2,
        { align: "right" },
      )
      pdf.setFont("helvetica", "bold")
      pdf.text(`Rs. ${Math.round(tx.balance).toLocaleString()}`, pageWidth - margin - 3, yPos + 2, { align: "right" })

      yPos += 8
    })

    yPos += 5
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 10

    const premiumClosingLabel = stats.hasCredit ? "CREDIT BALANCE:" : "CLOSING BALANCE:"
    const premiumClosingValue = stats.displayOutstanding
    if (stats.hasCredit) {
      pdf.setFillColor(16, 185, 129)
    } else {
      pdf.setFillColor(102, 126, 234)
    }
    pdf.roundedRect(pageWidth - margin - 70, yPos - 5, 70, 15, 2, 2, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(premiumClosingLabel, pageWidth - margin - 65, yPos + 3)
    pdf.text(`Rs. ${premiumClosingValue.toLocaleString()}`, pageWidth - margin - 5, yPos + 3, { align: "right" })

    return pdf.output("blob")
  }

  const shareToWhatsApp = async () => {
    const whatsappPhone = formatPhoneForWhatsApp(customerPhone)

    if (!whatsappPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Customer phone number is invalid for WhatsApp. Please check the number.",
        variant: "destructive",
      })
      return
    }

    const pdfBlob = generateStatementPDFBlob()
    if (!pdfBlob) return

    const fileName = `Statement-${customerName.replace(/\s+/g, "_")}-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`

    // Check if running in Electron desktop app
    if (window.electron?.sharePdfToWhatsApp) {
      try {
        // Convert blob to base64 for Electron IPC
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(",")[1]
          
          const result = await window.electron!.sharePdfToWhatsApp({
            pdfBase64: base64Data,
            fileName: fileName,
            phoneNumber: customerPhone
          })

          if (result.success) {
            toast({
              title: "PDF Saved & WhatsApp Opened",
              description: "PDF saved to Documents folder. Please attach it to the WhatsApp chat.",
            })
          } else {
            toast({
              title: "Share Failed",
              description: result.error || "Could not share PDF to WhatsApp.",
              variant: "destructive",
            })
          }
        }
        reader.readAsDataURL(pdfBlob)
        return
      } catch {
        // Electron share failed, fall back to web share
      }
    }

    // Web Share API for mobile browsers
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        const balanceText = stats.hasCredit 
          ? `Credit: Rs. ${stats.displayOutstanding.toLocaleString()}`
          : `Balance: Rs. ${stats.displayOutstanding.toLocaleString()}`
        await navigator.share({
          files: [pdfFile],
          title: `Account Statement - ${customerName}`,
          text: `Account Statement from ${receiptSettings.businessName} - ${balanceText}`,
        })
        toast({
          title: "Shared Successfully",
          description: "Statement PDF shared via WhatsApp.",
        })
        return
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }
        // Share failed, fall back to text share
      }
    }

    // Fallback: Open WhatsApp with text message
    const closingBalance = transactions.length > 0 ? transactions[0].balance : 0
    const balanceLabel = closingBalance < 0 ? "CREDIT BALANCE" : "CURRENT BALANCE"
    const displayBalance = Math.abs(closingBalance)

    const message = `*ACCOUNT STATEMENT*
${receiptSettings.businessName}

*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Date:* ${formatDateShort(new Date())}

*ACCOUNT SUMMARY*
Total Bills: ${stats.totalBills}
Total Purchases: Rs. ${stats.totalPurchases.toLocaleString()}
Total Paid: Rs. ${stats.totalPaid.toLocaleString()}
Total Returns: Rs. ${stats.totalReturnCredits.toLocaleString()}

*${balanceLabel}: Rs. ${Math.round(displayBalance).toLocaleString()}*

Thank you for your business!`

    const encodedMessage = encodeURIComponent(message)
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, "_blank")

    toast({
      title: "WhatsApp Opening",
      description: "Statement summary sent to WhatsApp.",
    })
  }

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case "payment":
        return <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
      case "bill":
        return <Receipt className="h-5 w-5 text-blue-600" />
      case "cash_loan":
        return <Landmark className="h-5 w-5 text-amber-600" />
      case "return":
        return <Package className="h-5 w-5 text-orange-600" />
    }
  }

  const getTransactionBadge = (type: TransactionType) => {
    switch (type) {
      case "payment":
        return <Badge className="bg-emerald-100 text-emerald-800 border-0">IN</Badge>
      case "bill":
        return <Badge className="bg-blue-100 text-blue-800 border-0">OUT</Badge>
      case "cash_loan":
        return <Badge className="bg-amber-100 text-amber-800 border-0">LOAN</Badge>
      case "return":
        return <Badge className="bg-orange-100 text-orange-800 border-0">RETURN</Badge>
    }
  }

  if (salesLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <style>{`
        .bank-card {
          background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a365d 100%);
          position: relative;
          overflow: hidden;
        }
        .bank-card::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        }
        .bank-card::after {
          content: '';
          position: absolute;
          bottom: -30%;
          left: -30%;
          width: 80%;
          height: 80%;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 60%);
        }
        .stat-tile {
          background: white;
          border: 1px solid rgba(0,0,0,0.06);
          transition: all 0.2s ease;
        }
        .stat-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -5px rgba(0,0,0,0.1);
        }
        .dark .stat-tile {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .action-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }
        .whatsapp-btn {
          background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
        }
        .whatsapp-btn:hover {
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
        }
      `}</style>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/unpaid-bills")}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400"
            data-testid="button-back-to-unpaid"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setCashLoanDialogOpen(true)}
              className="flex items-center gap-2 border-slate-300 dark:border-slate-600"
              data-testid="button-add-cash-loan"
            >
              <Plus className="h-4 w-4" />
              Add Balance
            </Button>
            <Button
              onClick={generateBankStatement}
              className="action-btn text-white border-0"
              data-testid="button-download-statement"
            >
              <Download className="h-4 w-4 mr-2" />
              Statement
            </Button>
            <Button
              onClick={shareToWhatsApp}
              className="whatsapp-btn text-white border-0"
              data-testid="button-share-whatsapp"
            >
              <SiWhatsapp className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        <div className="bank-card rounded-xl p-4 md:p-5 text-white mb-5 shadow-lg">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-blue-200/80 text-[10px] font-semibold tracking-wider uppercase">Account Holder</p>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight" data-testid="text-customer-name">
                    {customerName}
                  </h1>
                  <div className="flex items-center gap-1.5 text-blue-200/80 mt-0.5">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono text-xs tracking-wider" data-testid="text-customer-phone">{customerPhone}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-blue-200/80 text-[10px] font-semibold tracking-wider uppercase">
                  {stats.hasCredit ? "Credit Balance" : "Outstanding Balance"}
                </p>
                <p className={`text-2xl md:text-3xl font-bold tracking-tight tabular-nums ${stats.hasCredit ? "text-emerald-300" : ""}`} data-testid="text-current-balance">
                  <span className="text-base md:text-lg font-normal opacity-60">Rs.</span> {stats.displayOutstanding.toLocaleString()}
                </p>
                <p className="text-blue-300/70 text-[10px] mt-0.5">
                  As of {formatDateShort(new Date().toISOString())}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-tile p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Bills</p>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white" data-testid="text-total-bills">
              {stats.totalBills}
            </p>
          </div>
          <div className="stat-tile p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Purchases</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white" data-testid="text-total-purchases">
              Rs. {stats.totalPurchases.toLocaleString()}
            </p>
          </div>
          <div className="stat-tile p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Paid</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-total-paid">
              Rs. {stats.totalPaid.toLocaleString()}
            </p>
          </div>
          <div className="stat-tile p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.hasCredit ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-rose-50 dark:bg-rose-900/30"}`}>
                <AlertCircle className={`h-5 w-5 ${stats.hasCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {stats.hasCredit ? "Credit" : "Due"}
              </p>
            </div>
            <p className={`text-2xl font-bold ${stats.hasCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} data-testid="text-outstanding">
              Rs. {stats.displayOutstanding.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Returns Summary Card */}
        {stats.totalReturnCredits > 0 && (
          <div className="mb-6">
            <Card className="border-0 shadow-lg bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Total Returns</p>
                      <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
                        {stats.totalReturns} return{stats.totalReturns !== 1 ? 's' : ''} processed
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Return Credits</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                      Rs. {Math.round(stats.totalReturnCredits).toLocaleString()}
                    </p>
                    <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
                      Deducted from outstanding balance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <TabsTrigger 
              value="transactions" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm" 
              data-testid="tab-transactions"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger 
              value="paid-bills" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm" 
              data-testid="tab-paid-bills"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Paid</span> ({paidSales.length})
            </TabsTrigger>
            <TabsTrigger 
              value="unpaid-bills" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm" 
              data-testid="tab-unpaid-bills"
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Unpaid</span> ({unpaidSales.length})
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm" 
              data-testid="tab-scheduled"
            >
              <CalendarClock className="h-4 w-4" />
              <span className="hidden sm:inline">Due</span> ({scheduledPayments.length})
            </TabsTrigger>
            <TabsTrigger 
              value="returns" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm"
              data-testid="tab-returns"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Returns</span> ({customerReturns.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 rounded-xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <History className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <TableHead className="w-[100px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Date</TableHead>
                        <TableHead className="w-[90px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Details</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Debit</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Credit</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Balance</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                            <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No transactions found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((txn) => {
                          const hasItems = txn.items && txn.items.length > 0
                          const isExpanded = expandedRows.has(txn.id)
                          return (
                            <Fragment key={txn.id}>
                              <TableRow
                                className={`border-b border-slate-50 dark:border-slate-700/50 transition-colors ${
                                  txn.type === "payment"
                                    ? "bg-emerald-50/30 dark:bg-emerald-900/10"
                                    : txn.type === "cash_loan"
                                      ? "bg-amber-50/30 dark:bg-amber-900/10"
                                      : txn.type === "return"
                                        ? "bg-orange-50/30 dark:bg-orange-900/10"
                                        : "hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                                } ${hasItems ? "cursor-pointer" : ""}`}
                                onClick={() => hasItems && toggleRowExpand(txn.id)}
                                data-testid={`row-transaction-${txn.id}`}
                              >
                                <TableCell className="font-medium text-slate-600 dark:text-slate-400">
                                  <div className="flex items-center gap-1">
                                    {hasItems &&
                                      (isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                      ))}
                                    <span className="font-mono text-sm">{formatDateShort(txn.date)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getTransactionBadge(txn.type)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{txn.description}</p>
                                    {hasItems && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                        {txn.items!.length} item{txn.items!.length > 1 ? "s" : ""} - Click to expand
                                      </p>
                                    )}
                                    {txn.status && txn.type !== "payment" && txn.type !== "return" && (
                                      <Badge
                                        variant="outline"
                                        className={`mt-1 text-xs ${
                                          txn.status === "paid"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            : txn.status === "partial"
                                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                        }`}
                                      >
                                        {txn.status.toUpperCase()}
                                      </Badge>
                                    )}
                                    {txn.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{txn.notes}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300">
                                  {txn.type === "payment" || txn.type === "return" ? (
                                    <span className="text-slate-400">-</span>
                                  ) : (
                                    <span className="font-mono">Rs. {Math.round(txn.totalAmount).toLocaleString()}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                  {txn.credit > 0 ? (
                                    <span className="font-mono">Rs. {Math.round(txn.credit).toLocaleString()}</span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-800 dark:text-white">
                                  <span className="font-mono">Rs. {Math.round(txn.balance).toLocaleString()}</span>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {txn.type === "bill" || txn.type === "cash_loan" ? (
                                    <Link href={`/bill/${txn.saleId}?from=customer`}>
                                      <Button size="icon" variant="ghost" data-testid={`button-view-${txn.id}`}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  ) : txn.type === "return" ? (
                                    txn.saleId ? (
                                      <Link href={`/bill/${txn.saleId}?from=customer`}>
                                        <Button size="icon" variant="ghost" data-testid={`button-view-return-${txn.id}`}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </Link>
                                    ) : null
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const payment = paymentHistory.find((p) => `payment-${p.id}` === txn.id)
                                        if (payment) openEditPayment(payment)
                                      }}
                                      data-testid={`button-edit-${txn.id}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                              {hasItems && isExpanded && (
                                <TableRow
                                  key={`${txn.id}-items`}
                                  className="bg-slate-50/50 dark:bg-slate-800/30"
                                >
                                  <TableCell colSpan={7} className="p-0">
                                    <div className="mx-4 my-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                      <div className="bg-slate-800 dark:bg-slate-700 px-4 py-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-white" />
                                            <span className="text-sm font-semibold text-white">
                                              Items Detail
                                            </span>
                                          </div>
                                          <span className="text-xs text-slate-300">
                                            {txn.items!.length} item{txn.items!.length !== 1 ? "s" : ""}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {txn.items!.map((item, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-800 dark:text-white">{item.productName}</span>
                                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                                <span className="text-slate-600 dark:text-slate-400">{item.variantName}</span>
                                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                                <span className="text-slate-500 dark:text-slate-500">{item.colorName}</span>
                                                {item.colorCode && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs border-slate-300 dark:border-slate-600"
                                                  >
                                                    {item.colorCode}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-right">
                                              <div className="text-sm font-mono">
                                                <span className="text-slate-600 dark:text-slate-400 font-medium">{item.quantity}</span>
                                                <span className="text-slate-400 mx-1">x</span>
                                                <span className="text-slate-600 dark:text-slate-400">
                                                  Rs. {Math.round(item.rate).toLocaleString()}
                                                </span>
                                              </div>
                                              <div className="font-bold text-slate-800 dark:text-white min-w-[100px] text-right font-mono">
                                                Rs. {Math.round(item.subtotal).toLocaleString()}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="bg-slate-100 dark:bg-slate-900/50 px-4 py-3 flex justify-end border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                          <span className="text-sm text-slate-600 dark:text-slate-400">Total:</span>
                                          <span className="font-bold text-lg text-slate-800 dark:text-white font-mono">
                                            Rs. {Math.round(txn.totalAmount).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid-bills">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 rounded-xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Completed Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {paidSales.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No completed payments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paidSales.map((sale) => {
                      const saleReturns = getSaleReturns(sale.id)
                      const total = safeParseFloat(sale.totalAmount)
                      const paid = safeParseFloat(sale.amountPaid)
                      const outstanding = roundNumber(total - paid - saleReturns)
                      
                      return (
                        <div
                          key={sale.id}
                          className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:shadow-md transition-shadow"
                          data-testid={`card-paid-${sale.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                sale.isManualBalance 
                                  ? "bg-amber-50 dark:bg-amber-900/20" 
                                  : "bg-emerald-50 dark:bg-emerald-900/20"
                              }`}
                            >
                              {sale.isManualBalance ? (
                                <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                  {sale.isManualBalance ? "Manual Balance" : `Bill #${sale.id.slice(0, 8)}`}
                                </p>
                                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  PAID
                                </Badge>
                                {saleReturns > 0 && (
                                  <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    Return: Rs. {Math.round(saleReturns).toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">{formatDateShort(sale.createdAt)}</p>
                              {sale.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{sale.notes}</p>}
                              {saleReturns > 0 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                  Returns deducted: Rs. {Math.round(saleReturns).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</p>
                              <p className="text-xl font-bold text-slate-800 dark:text-white font-mono">
                                Rs. {Math.round(safeParseFloat(sale.totalAmount)).toLocaleString()}
                              </p>
                              <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                                <div>Paid: Rs. {Math.round(safeParseFloat(sale.amountPaid)).toLocaleString()}</div>
                                {saleReturns > 0 && (
                                  <div className="text-orange-600 dark:text-orange-400">
                                    Returns: Rs. {Math.round(saleReturns).toLocaleString()}
                                  </div>
                                )}
                                <div className="font-bold mt-1">
                                  Balance: Rs. {Math.round(outstanding).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <Link href={`/bill/${sale.id}?from=customer`}>
                              <Button size="icon" variant="outline" className="border-slate-200 dark:border-slate-600" data-testid={`button-view-paid-${sale.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 rounded-xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Return History
                  {customerReturns.length > 0 && (
                    <Badge variant="outline" className="ml-2 border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      Total: Rs. {Math.round(stats.totalReturnCredits).toLocaleString()}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {customerReturns.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No returns recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerReturns.map((ret) => {
                      const refundAmount = safeParseFloat(ret.totalRefund)
                      const returnItems = ret.returnItems?.map((item: any) => ({
                        productName: item.color?.variant?.product?.productName || "Product",
                        variantName: item.color?.variant?.packingSize || "Variant",
                        colorName: item.color?.colorName || "Color",
                        colorCode: item.color?.colorCode || "",
                        quantity: item.quantity,
                        rate: safeParseFloat(item.rate),
                        subtotal: safeParseFloat(item.subtotal),
                      })) || []

                      return (
                        <div
                          key={ret.id}
                          className="p-4 rounded-xl border border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:shadow-md transition-shadow"
                          data-testid={`card-return-${ret.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                              <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                  {ret.returnType === "bill" ? "Full Bill Return" : "Item Return"}
                                </p>
                                <Badge variant="outline" className="border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                  REFUND
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {formatDateShort(ret.createdAt)}
                              </p>
                              {ret.reason && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                  <span className="font-medium">Reason:</span> {ret.reason}
                                </p>
                              )}
                              {returnItems.length > 0 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                  {returnItems.length} item{returnItems.length > 1 ? 's' : ''} returned
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Refund Amount</p>
                              <p className="text-xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                                Rs. {Math.round(refundAmount).toLocaleString()}
                              </p>
                              <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-0.5">
                                Deducted from bill balance
                              </p>
                            </div>
                            {ret.saleId && (
                              <Link href={`/bill/${ret.saleId}?from=customer`}>
                                <Button size="icon" variant="outline" className="border-orange-300 dark:border-orange-600">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 rounded-xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  Due Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {scheduledPayments.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No scheduled payments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scheduledPayments.map((payment) => {
                      const status = getDueDateStatus(payment.dueDate)
                      return (
                        <div
                          key={payment.id}
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all ${
                            status === "overdue"
                              ? "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-900/20"
                              : status === "due_soon"
                                ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                                : "border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800/50"
                          }`}
                          data-testid={`card-scheduled-${payment.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                status === "overdue"
                                  ? "bg-rose-100 dark:bg-rose-900/30"
                                  : status === "due_soon"
                                    ? "bg-amber-100 dark:bg-amber-900/30"
                                    : "bg-slate-100 dark:bg-slate-700"
                              }`}
                            >
                              <Calendar
                                className={`h-5 w-5 ${
                                  status === "overdue"
                                    ? "text-rose-600 dark:text-rose-400"
                                    : status === "due_soon"
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-slate-600 dark:text-slate-400"
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                  {payment.isManualBalance ? "Manual Balance" : `Bill #${payment.id.slice(0, 8)}`}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={
                                    status === "overdue"
                                      ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                      : status === "due_soon"
                                        ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                  }
                                >
                                  {status === "overdue" ? "OVERDUE" : status === "due_soon" ? "DUE SOON" : "UPCOMING"}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">Due: {formatDateShort(payment.dueDate)}</p>
                              {payment.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{payment.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Outstanding</p>
                              <p className="text-2xl font-bold text-slate-800 dark:text-white font-mono">
                                Rs. {Math.round(payment.outstanding).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedSaleId(payment.id)
                                  setPaymentAmount("")
                                  setPaymentDialogOpen(true)
                                }}
                                className="border-slate-200 dark:border-slate-600"
                                data-testid={`button-pay-${payment.id}`}
                              >
                                <Wallet className="h-4 w-4 mr-2" />
                                Pay
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedSaleId(payment.id)
                                  setPaymentAmount(String(Math.round(payment.outstanding)))
                                  setPaymentDialogOpen(true)
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                data-testid={`button-pay-full-scheduled-${payment.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Pay Full
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unpaid-bills">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 rounded-xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                      <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    Outstanding Bills
                    {unpaidSales.length > 0 && (
                      <Badge variant="outline" className="ml-2 border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                        {unpaidSales.length} bill{unpaidSales.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </CardTitle>
                  {unpaidSales.length > 0 && (
                    <Button
                      onClick={() => setClearAccountDialogOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="button-pay-full-account"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Pay Full (Rs. {Math.round(stats.totalOutstanding).toLocaleString()})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {unpaidSales.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-400 opacity-50" />
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium">All bills are paid!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unpaidSales.map((sale) => {
                      const saleReturns = getSaleReturns(sale.id)
                      const total = safeParseFloat(sale.totalAmount)
                      const paid = safeParseFloat(sale.amountPaid)
                      const outstanding = roundNumber(total - paid - saleReturns)
                      const paidPercent = (paid / total) * 100
                      return (
                        <div
                          key={sale.id}
                          className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:shadow-md transition-shadow"
                          data-testid={`card-unpaid-${sale.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                sale.isManualBalance 
                                  ? "bg-amber-50 dark:bg-amber-900/20" 
                                  : "bg-blue-50 dark:bg-blue-900/20"
                              }`}
                            >
                              {sale.isManualBalance ? (
                                <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                  {sale.isManualBalance ? "Manual Balance" : `Bill #${sale.id.slice(0, 8)}`}
                                </p>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    sale.paymentStatus === "partial" 
                                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                  }
                                >
                                  {sale.paymentStatus.toUpperCase()}
                                </Badge>
                                {saleReturns > 0 && (
                                  <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    Return: Rs. {Math.round(saleReturns).toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {formatDateShort(sale.createdAt)}
                                {sale.dueDate && <span className="text-slate-400 dark:text-slate-500"> | Due: {formatDateShort(sale.dueDate)}</span>}
                              </p>
                              {sale.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{sale.notes}</p>}
                              {saleReturns > 0 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                  Returns deducted: Rs. {Math.round(saleReturns).toLocaleString()}
                                </p>
                              )}
                              <div className="w-40 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                                  style={{ width: `${paidPercent}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                Rs. {Math.round(paid).toLocaleString()} / Rs. {Math.round(total).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Outstanding</p>
                              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                                Rs. {Math.round(outstanding).toLocaleString()}
                              </p>
                              {saleReturns > 0 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                                  (Incl. Rs. {Math.round(saleReturns).toLocaleString()} returns)
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Link href={`/bill/${sale.id}?from=customer`}>
                                <Button size="icon" variant="outline" className="border-slate-200 dark:border-slate-600" data-testid={`button-view-bill-${sale.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedSaleId(sale.id)
                                  setPaymentAmount("")
                                  setPaymentDialogOpen(true)
                                }}
                                className="border-slate-200 dark:border-slate-600"
                                data-testid={`button-receive-payment-${sale.id}`}
                              >
                                <Wallet className="h-4 w-4 mr-2" />
                                Pay
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Receive Payment
            </DialogTitle>
            <DialogDescription>
              Outstanding: Rs. {Math.round(selectedSaleOutstanding).toLocaleString()}
              {selectedSaleReturns > 0 && (
                <span className="text-orange-600 ml-2">
                  (Returns: Rs. {Math.round(selectedSaleReturns).toLocaleString()} deducted)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                data-testid="input-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                data-testid="input-edit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger data-testid="select-edit-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editPaymentNotes}
                onChange={(e) => setEditPaymentNotes(e.target.value)}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (editingPayment) {
                  setPaymentToDelete(editingPayment)
                  setEditPaymentDialogOpen(false)
                  setDeletePaymentDialogOpen(true)
                }
              }}
              data-testid="button-delete-payment"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePayment}
                disabled={updatePaymentMutation.isPending}
                data-testid="button-update-payment"
              >
                {updatePaymentMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePaymentDialogOpen} onOpenChange={setDeletePaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Payment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment of Rs.{" "}
              {paymentToDelete ? Math.round(safeParseFloat(paymentToDelete.amount)).toLocaleString() : 0}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (paymentToDelete) {
                  deletePaymentMutation.mutate(paymentToDelete.id)
                }
              }}
              disabled={deletePaymentMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashLoanDialogOpen} onOpenChange={setCashLoanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Add Manual Balance
            </DialogTitle>
            <DialogDescription>Add a manual balance entry to the customer's account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={cashLoanAmount}
                onChange={(e) => setCashLoanAmount(e.target.value)}
                data-testid="input-loan-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date (Optional)</Label>
              <Input
                type="date"
                value={cashLoanDueDate}
                onChange={(e) => setCashLoanDueDate(e.target.value)}
                data-testid="input-loan-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={cashLoanNotes}
                onChange={(e) => setCashLoanNotes(e.target.value)}
                data-testid="input-loan-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashLoanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCashLoan} disabled={addCashLoanMutation.isPending} data-testid="button-add-loan">
              {addCashLoanMutation.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Full Account Dialog */}
      <Dialog open={clearAccountDialogOpen} onOpenChange={setClearAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Pay Full Account
            </DialogTitle>
            <DialogDescription>
              Pay all outstanding bills at once to clear the customer's account balance. 
              The selected payment method and notes will be applied to each bill.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Customer</span>
                <span className="font-semibold text-slate-800 dark:text-white">{customerName}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Unpaid Bills</span>
                <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                  {unpaidSales.length} bill{unpaidSales.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Total Returns</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  Rs. {Math.round(stats.totalReturnCredits).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-600">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Outstanding</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  Rs. {Math.round(stats.totalOutstanding).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={clearAccountMethod} onValueChange={setClearAccountMethod}>
                <SelectTrigger data-testid="select-clear-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes for this full account clearance..."
                value={clearAccountNotes}
                onChange={(e) => setClearAccountNotes(e.target.value)}
                data-testid="input-clear-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearAccountDialogOpen(false)} disabled={clearAccountProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleClearFullAccount}
              disabled={clearAccountProcessing || unpaidSales.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-confirm-pay-full"
            >
              {clearAccountProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pay Full (Rs. {Math.round(stats.totalOutstanding).toLocaleString()})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}