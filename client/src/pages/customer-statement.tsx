import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  Phone,
  Calendar,
  Receipt,
  Wallet,
  CheckCircle,
  Clock,
  AlertCircle,
  Banknote,
  Download,
  History,
  FileText,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  StickyNote,
  Share2,
  MessageCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  CircleDollarSign,
  Landmark,
  CalendarClock,
  Eye,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Sale, PaymentHistory, SaleWithItems } from "@shared/schema";
import jsPDF from "jspdf";

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale;
}

type TransactionType = 'bill' | 'payment' | 'cash_loan';

interface SaleItemDisplay {
  productName: string;
  variantName: string;
  colorName: string;
  colorCode: string;
  quantity: number;
  rate: number;
  subtotal: number;
}

interface Transaction {
  id: string;
  date: Date;
  type: TransactionType;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  paid: number;
  totalAmount: number;
  outstanding: number;
  notes?: string;
  dueDate?: Date | null;
  status?: string;
  saleId?: string;
  items?: SaleItemDisplay[];
}

// Utility function to safely parse numbers
const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

// Utility function to round numbers for display
const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100;
};

export default function CustomerStatement() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const params = useParams<{ phone: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const customerPhone = params.phone || "";

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryWithSale | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editPaymentNotes, setEditPaymentNotes] = useState("");

  const [cashLoanDialogOpen, setCashLoanDialogOpen] = useState(false);
  const [cashLoanAmount, setCashLoanAmount] = useState("");
  const [cashLoanNotes, setCashLoanNotes] = useState("");
  const [cashLoanDueDate, setCashLoanDueDate] = useState("");

  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentHistoryWithSale | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpand = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const { data: allSalesWithItems = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales/customer", customerPhone, "with-items"],
    queryFn: async () => {
      const res = await fetch(`/api/sales/customer/${encodeURIComponent(customerPhone)}/with-items`);
      if (!res.ok) throw new Error("Failed to fetch customer sales");
      return res.json();
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
  });

  const allSales = allSalesWithItems as Sale[];

  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history/customer", customerPhone],
    queryFn: async () => {
      const res = await fetch(`/api/payment-history/customer/${encodeURIComponent(customerPhone)}`);
      if (!res.ok) throw new Error("Failed to fetch payment history");
      return res.json();
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/sales/${data.saleId}/payment`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/payment-history/${data.id}`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] });
      setEditPaymentDialogOpen(false);
      setEditingPayment(null);
      toast({
        title: "Payment Updated",
        description: "Payment has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/payment-history/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] });
      setDeletePaymentDialogOpen(false);
      setPaymentToDelete(null);
      toast({
        title: "Payment Deleted",
        description: "Payment record has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      });
    },
  });

  const addCashLoanMutation = useMutation({
    mutationFn: async (data: { amount: string; notes: string; dueDate: string | null }) => {
      const customerName = allSales[0]?.customerName || "Customer";
      const response = await apiRequest("POST", "/api/sales/manual-balance", {
        customerName,
        customerPhone,
        totalAmount: data.amount,
        dueDate: data.dueDate,
        notes: data.notes || `Cash loan of Rs. ${data.amount}`,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setCashLoanDialogOpen(false);
      setCashLoanAmount("");
      setCashLoanNotes("");
      setCashLoanDueDate("");
      toast({
        title: "Manual Balance Added",
        description: "Manual balance has been added to customer account.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add cash loan",
        variant: "destructive",
      });
    },
  });

  const paidSales = useMemo(() => allSales.filter(s => s.paymentStatus === "paid"), [allSales]);
  const unpaidSales = useMemo(() => allSales.filter(s => s.paymentStatus !== "paid"), [allSales]);
  
  const customerName = allSales[0]?.customerName || "Customer";

  // Corrected and improved stats calculations
  const stats = useMemo(() => {
    const totalPurchases = allSales.reduce((sum, s) => sum + safeParseFloat(s.totalAmount), 0);
    const totalPaid = allSales.reduce((sum, s) => sum + safeParseFloat(s.amountPaid), 0);
    const totalOutstanding = Math.max(0, totalPurchases - totalPaid);
    const totalPaymentsReceived = paymentHistory.reduce((sum, p) => sum + safeParseFloat(p.amount), 0);
    
    return {
      totalBills: allSales.length,
      paidBills: paidSales.length,
      unpaidBills: unpaidSales.length,
      totalPurchases: roundNumber(totalPurchases),
      totalPaid: roundNumber(totalPaid),
      totalOutstanding: roundNumber(totalOutstanding),
      totalPaymentsReceived: roundNumber(totalPaymentsReceived),
    };
  }, [allSales, paidSales, unpaidSales, paymentHistory]);

  // Corrected and improved transactions calculation
  const transactions = useMemo((): Transaction[] => {
    const txns: Transaction[] = [];

    // Calculate total payments per sale
    const paymentsBySale = new Map<string, number>();
    paymentHistory.forEach(payment => {
      const current = paymentsBySale.get(payment.saleId) || 0;
      paymentsBySale.set(payment.saleId, current + safeParseFloat(payment.amount));
    });

    // Process sales as bills or cash loans
    allSalesWithItems.forEach(sale => {
      const saleItems: SaleItemDisplay[] = sale.saleItems?.map(item => ({
        productName: item.color?.variant?.product?.productName || 'Product',
        variantName: item.color?.variant?.packingSize || 'Variant',
        colorName: item.color?.colorName || 'Color',
        colorCode: item.color?.colorCode || '',
        quantity: item.quantity,
        rate: safeParseFloat(item.rate),
        subtotal: safeParseFloat(item.subtotal),
      })) || [];

      const totalAmt = safeParseFloat(sale.totalAmount);
      const paidAmt = safeParseFloat(sale.amountPaid);
      const recordedPayments = paymentsBySale.get(sale.id) || 0;
      
      // Calculate initial payment made at sale creation
      const paidAtSale = Math.max(0, paidAmt - recordedPayments);
      const outstandingAmt = Math.max(0, totalAmt - paidAmt);

      txns.push({
        id: `bill-${sale.id}`,
        date: new Date(sale.createdAt),
        type: sale.isManualBalance ? 'cash_loan' : 'bill',
        description: sale.isManualBalance ? 'Manual Balance' : `Bill #${sale.id.slice(0, 8)}`,
        reference: sale.id.slice(0, 8).toUpperCase(),
        debit: totalAmt,
        credit: 0,
        balance: 0,
        paid: paidAtSale,
        totalAmount: totalAmt,
        outstanding: outstandingAmt,
        notes: sale.notes || undefined,
        dueDate: sale.dueDate ? new Date(sale.dueDate) : null,
        status: sale.paymentStatus,
        saleId: sale.id,
        items: saleItems.length > 0 ? saleItems : undefined,
      });
    });

    // Process payments
    paymentHistory.forEach(payment => {
      txns.push({
        id: `payment-${payment.id}`,
        date: new Date(payment.createdAt),
        type: 'payment',
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
      });
    });

    // Sort transactions by date (oldest first)
    txns.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance correctly
    let runningBalance = 0;
    txns.forEach(txn => {
      if (txn.type === 'payment') {
        // Payments reduce the balance
        runningBalance -= txn.credit;
      } else {
        // Bills and cash loans increase the balance by the outstanding amount
        runningBalance += (txn.debit - txn.paid);
      }
      txn.balance = runningBalance;
    });

    // Return in reverse order (newest first)
    return txns.reverse();
  }, [allSalesWithItems, paymentHistory]);

  const scheduledPayments = useMemo(() => {
    const now = new Date();
    return unpaidSales
      .filter(s => s.dueDate)
      .map(s => ({
        ...s,
        dueDate: new Date(s.dueDate!),
        outstanding: safeParseFloat(s.totalAmount) - safeParseFloat(s.amountPaid),
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [unpaidSales]);

  const getDueDateStatus = (dueDate: Date | null) => {
    if (!dueDate) return "none";
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "overdue";
    if (diffDays <= 7) return "due_soon";
    return "normal";
  };

  const handleRecordPayment = () => {
    if (!selectedSaleId || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    recordPaymentMutation.mutate({
      saleId: selectedSaleId,
      amount,
      paymentMethod,
      notes: paymentNotes,
    });
  };

  const handleUpdatePayment = () => {
    if (!editingPayment || !editPaymentAmount) return;
    
    const amount = parseFloat(editPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    updatePaymentMutation.mutate({
      id: editingPayment.id,
      amount,
      paymentMethod: editPaymentMethod,
      notes: editPaymentNotes,
    });
  };

  const handleAddCashLoan = () => {
    if (!cashLoanAmount) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount for the cash loan",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(cashLoanAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    addCashLoanMutation.mutate({
      amount: cashLoanAmount,
      notes: cashLoanNotes,
      dueDate: cashLoanDueDate || null,
    });
  };

  const openEditPayment = (payment: PaymentHistoryWithSale) => {
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount);
    setEditPaymentMethod(payment.paymentMethod);
    setEditPaymentNotes(payment.notes || "");
    setEditPaymentDialogOpen(true);
  };

  const selectedSale = selectedSaleId ? allSales.find(s => s.id === selectedSaleId) : null;
  const selectedSaleOutstanding = selectedSale 
    ? safeParseFloat(selectedSale.totalAmount) - safeParseFloat(selectedSale.amountPaid)
    : 0;

  const generateBankStatement = async () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    const drawHeader = () => {
      pdf.setFillColor(102, 126, 234);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ACCOUNT STATEMENT', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(receiptSettings.businessName, pageWidth / 2, 23, { align: 'center' });
      pdf.text(receiptSettings.address, pageWidth / 2, 29, { align: 'center' });
      
      pdf.setTextColor(0, 0, 0);
      yPos = 45;
    };

    const addSectionHeader = (text: string) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, 'F');
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(text, margin + 3, yPos + 2);
      yPos += 10;
    };

    drawHeader();

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Account Holder:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customerName, margin + 35, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Phone:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customerPhone, margin + 35, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Statement Date:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(new Date()), margin + 35, yPos);
    yPos += 10;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    addSectionHeader('ACCOUNT SUMMARY');
    
    const summaryData = [
      ['Total Bills:', stats.totalBills.toString(), 'Total Purchases:', `Rs. ${stats.totalPurchases.toLocaleString()}`],
      ['Paid Bills:', stats.paidBills.toString(), 'Total Paid:', `Rs. ${stats.totalPaid.toLocaleString()}`],
      ['Unpaid Bills:', stats.unpaidBills.toString(), 'Outstanding:', `Rs. ${stats.totalOutstanding.toLocaleString()}`],
    ];

    pdf.setFontSize(9);
    summaryData.forEach(row => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(row[0], margin + 5, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row[1], margin + 35, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(row[2], margin + 70, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row[3], margin + 105, yPos);
      yPos += 6;
    });
    yPos += 8;

    addSectionHeader('TRANSACTION HISTORY');
    
    const addLedgerRow = (cols: string[], isHeader: boolean = false, bgColor?: [number, number, number]) => {
      if (yPos > pageHeight - 15) {
        pdf.addPage();
        yPos = margin + 5;
      }
      
      const colWidths = [22, 45, 25, 25, 25, 28];
      let xPos = margin;
      
      if (bgColor) {
        pdf.setFillColor(...bgColor);
        pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
      }
      
      pdf.setFontSize(isHeader ? 8 : 7);
      pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
      
      cols.forEach((col, i) => {
        const align = i >= 2 ? 'right' : 'left';
        const textX = align === 'right' ? xPos + colWidths[i] - 2 : xPos + 2;
        pdf.text(col, textX, yPos, { align: align as 'left' | 'right' });
        xPos += colWidths[i];
      });
      
      yPos += 6;
    };
    
    addLedgerRow(['DATE', 'DESCRIPTION', 'AMOUNT', 'PAID', 'DUE', 'BALANCE'], true, [220, 220, 220]);

    for (const txn of transactions) {
      const dateStr = formatDateShort(txn.date);
      const outstanding = txn.type !== 'payment' ? Math.max(0, txn.totalAmount - txn.paid) : 0;
      
      let amountStr = '-';
      let paidStr = '-';
      let dueStr = '-';
      
      if (txn.type === 'payment') {
        paidStr = `Rs. ${Math.round(txn.credit).toLocaleString()}`;
      } else {
        amountStr = `Rs. ${Math.round(txn.totalAmount).toLocaleString()}`;
        paidStr = txn.paid > 0 ? `Rs. ${Math.round(txn.paid).toLocaleString()}` : '-';
        dueStr = outstanding > 0 ? `Rs. ${Math.round(outstanding).toLocaleString()}` : 'CLEAR';
      }
      
      const balanceStr = `Rs. ${Math.round(txn.balance).toLocaleString()}`;
      
      const bgColor: [number, number, number] = 
        txn.type === 'payment' ? [220, 245, 220] : 
        txn.type === 'cash_loan' ? [255, 240, 210] : 
        txn.status === 'paid' ? [210, 235, 255] : 
        [245, 245, 250];
      
      addLedgerRow([dateStr, txn.description, amountStr, paidStr, dueStr, balanceStr], false, bgColor);
      
      if (txn.items && txn.items.length > 0) {
        const items = txn.items;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (yPos > pageHeight - 15) {
            pdf.addPage();
            yPos = margin + 5;
          }
          
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 5, 'F');
          
          pdf.setTextColor(50, 50, 70);
          const productInfo = `     - ${item.productName} | ${item.variantName} | ${item.colorName}${item.colorCode ? ` [${item.colorCode}]` : ''}    ${item.quantity} x Rs.${Math.round(item.rate).toLocaleString()} = Rs.${Math.round(item.subtotal).toLocaleString()}`;
          pdf.text(productInfo, margin + 5, yPos);
          yPos += 4;
        }
        pdf.setTextColor(0, 0, 0);
      }
      
      if (txn.notes && txn.type !== 'payment') {
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 5, 'F');
        
        pdf.setFontSize(6);
        pdf.setTextColor(70, 70, 70);
        pdf.text(`     Note: ${txn.notes}`, margin + 5, yPos);
        pdf.setTextColor(0, 0, 0);
        yPos += 5;
      }
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
      yPos += 2;
    }

    yPos += 10;
    pdf.setDrawColor(100, 100, 100);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const closingBalance = transactions.length > 0 ? transactions[0].balance : 0;
    pdf.text(`CLOSING BALANCE: Rs. ${Math.round(closingBalance).toLocaleString()}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 15;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('This is a computer-generated statement and does not require a signature.', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });

    pdf.save(`Statement-${customerName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);

    toast({
      title: "Statement Downloaded",
      description: "Bank-style statement has been downloaded as PDF.",
    });
  };

  const formatPhoneForWhatsApp = (phone: string): string | null => {
    if (!phone || phone.trim().length < 10) {
      return null;
    }
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) {
      return null;
    }
    if (cleaned.startsWith('0')) {
      cleaned = '92' + cleaned.slice(1);
    } else if (!cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
      cleaned = '92' + cleaned;
    }
    cleaned = cleaned.replace(/^\+/, '');
    if (cleaned.length < 12) {
      return null;
    }
    return cleaned;
  };

  const generateStatementPDFBlob = (): Blob | null => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    const drawHeader = () => {
      pdf.setFillColor(102, 126, 234);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ACCOUNT STATEMENT', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(receiptSettings.businessName, pageWidth / 2, 23, { align: 'center' });
      pdf.text(receiptSettings.address, pageWidth / 2, 29, { align: 'center' });
      
      pdf.setTextColor(0, 0, 0);
      yPos = 45;
    };

    drawHeader();

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Account Holder:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customerName, margin + 35, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Phone:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customerPhone, margin + 35, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Statement Date:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(new Date()), margin + 35, yPos);
    yPos += 10;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 20, 'F');
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    const colWidth = (pageWidth - 2 * margin) / 3;
    pdf.text('Total Purchases', margin + colWidth / 2, yPos, { align: 'center' });
    pdf.text('Total Paid', margin + colWidth + colWidth / 2, yPos, { align: 'center' });
    pdf.text('Balance Due', margin + 2 * colWidth + colWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    pdf.setFontSize(11);
    pdf.text(`Rs. ${stats.totalPurchases.toLocaleString()}`, margin + colWidth / 2, yPos, { align: 'center' });
    pdf.text(`Rs. ${stats.totalPaid.toLocaleString()}`, margin + colWidth + colWidth / 2, yPos, { align: 'center' });
    pdf.text(`Rs. ${stats.totalOutstanding.toLocaleString()}`, margin + 2 * colWidth + colWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATE', margin + 3, yPos + 5.5);
    pdf.text('DESCRIPTION', margin + 35, yPos + 5.5);
    pdf.text('DEBIT', pageWidth - margin - 55, yPos + 5.5, { align: 'right' });
    pdf.text('CREDIT', pageWidth - margin - 30, yPos + 5.5, { align: 'right' });
    pdf.text('BALANCE', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const sortedTransactions = [...transactions].reverse();
    sortedTransactions.forEach((tx, index) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }
      
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 8, 'F');
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDateShort(tx.date), margin + 3, yPos + 2);
      
      const desc = tx.description.length > 35 ? tx.description.substring(0, 35) + '...' : tx.description;
      pdf.text(desc, margin + 35, yPos + 2);
      
      pdf.text(tx.debit > 0 ? `Rs. ${Math.round(tx.debit).toLocaleString()}` : '-', pageWidth - margin - 55, yPos + 2, { align: 'right' });
      pdf.text(tx.credit > 0 ? `Rs. ${Math.round(tx.credit).toLocaleString()}` : '-', pageWidth - margin - 30, yPos + 2, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Rs. ${Math.round(tx.balance).toLocaleString()}`, pageWidth - margin - 3, yPos + 2, { align: 'right' });
      
      yPos += 8;
    });

    yPos += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(pageWidth - margin - 70, yPos - 5, 70, 15, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CLOSING BALANCE:', pageWidth - margin - 65, yPos + 3);
    pdf.text(`Rs. ${stats.totalOutstanding.toLocaleString()}`, pageWidth - margin - 5, yPos + 3, { align: 'right' });

    return pdf.output('blob');
  };

  const shareToWhatsApp = async () => {
    const whatsappPhone = formatPhoneForWhatsApp(customerPhone);
    
    if (!whatsappPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Customer phone number is invalid for WhatsApp. Please check the number.",
        variant: "destructive",
      });
      return;
    }

    const pdfBlob = generateStatementPDFBlob();
    if (!pdfBlob) return;

    const fileName = `Statement-${customerName.replace(/\s+/g, '_')}-${formatDateShort(new Date()).replace(/\//g, '-')}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Account Statement - ${customerName}`,
          text: `Account Statement from ${receiptSettings.businessName} - Balance: Rs. ${stats.totalOutstanding.toLocaleString()}`
        });
        toast({
          title: "Shared Successfully",
          description: "Statement PDF shared via WhatsApp.",
        });
        return;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.log('Share failed, falling back to text share');
        } else {
          return;
        }
      }
    }

    const closingBalance = transactions.length > 0 ? transactions[0].balance : 0;
    
    const message = `*ACCOUNT STATEMENT*
${receiptSettings.businessName}

*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Date:* ${formatDateShort(new Date())}

*ACCOUNT SUMMARY*
Total Bills: ${stats.totalBills}
Total Purchases: Rs. ${stats.totalPurchases.toLocaleString()}
Total Paid: Rs. ${stats.totalPaid.toLocaleString()}

*CURRENT BALANCE: Rs. ${Math.round(closingBalance).toLocaleString()}*

Thank you for your business!`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');

    toast({
      title: "WhatsApp Opening",
      description: "Statement summary sent to WhatsApp.",
    });
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'payment':
        return <ArrowDownCircle className="h-5 w-5 text-emerald-600" />;
      case 'bill':
        return <Receipt className="h-5 w-5 text-blue-600" />;
      case 'cash_loan':
        return <Landmark className="h-5 w-5 text-amber-600" />;
    }
  };

  const getTransactionBadge = (type: TransactionType) => {
    switch (type) {
      case 'payment':
        return <Badge className="bg-emerald-100 text-emerald-800 border-0">IN</Badge>;
      case 'bill':
        return <Badge className="bg-blue-100 text-blue-800 border-0">OUT</Badge>;
      case 'cash_loan':
        return <Badge className="bg-amber-100 text-amber-800 border-0">LOAN</Badge>;
    }
  };

  if (salesLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .gradient-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .stat-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
          backdrop-filter: blur(10px);
        }
      `}</style>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/unpaid-bills")}
            className="flex items-center gap-2"
            data-testid="button-back-to-unpaid"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setCashLoanDialogOpen(true)}
              className="flex items-center gap-2"
              data-testid="button-add-cash-loan"
            >
              <Plus className="h-4 w-4" />
              Add Balance
            </Button>
            <Button
              onClick={generateBankStatement}
              className="gradient-header text-white"
              data-testid="button-download-statement"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={shareToWhatsApp}
              className="bg-emerald-600 text-white"
              data-testid="button-share-whatsapp"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="gradient-header p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-customer-name">
                    {customerName}
                  </h1>
                  <div className="flex items-center gap-2 text-white/80 mt-1">
                    <Phone className="h-4 w-4" />
                    <span data-testid="text-customer-phone">{customerPhone}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">Current Balance</p>
                <p className="text-3xl font-bold" data-testid="text-current-balance">
                  Rs. {stats.totalOutstanding.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card p-4 rounded-xl text-center">
                <ShoppingBag className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold text-slate-800" data-testid="text-total-bills">{stats.totalBills}</p>
                <p className="text-xs text-slate-500">Total Bills</p>
              </div>
              <div className="stat-card p-4 rounded-xl text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                <p className="text-xl font-bold text-slate-800" data-testid="text-total-purchases">
                  Rs. {stats.totalPurchases.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total Purchases</p>
              </div>
              <div className="stat-card p-4 rounded-xl text-center">
                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                <p className="text-xl font-bold text-emerald-600" data-testid="text-total-paid">
                  Rs. {stats.totalPaid.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total Paid</p>
              </div>
              <div className="stat-card p-4 rounded-xl text-center">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <p className="text-xl font-bold text-red-600" data-testid="text-outstanding">
                  Rs. {stats.totalOutstanding.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="transactions" className="flex items-center gap-2" data-testid="tab-transactions">
              <History className="h-4 w-4" />
              All Transactions
            </TabsTrigger>
            <TabsTrigger value="paid-bills" className="flex items-center gap-2" data-testid="tab-paid-bills">
              <CheckCircle className="h-4 w-4" />
              Paid Bills ({paidSales.length})
            </TabsTrigger>
            <TabsTrigger value="unpaid-bills" className="flex items-center gap-2" data-testid="tab-unpaid-bills">
              <Receipt className="h-4 w-4" />
              Unpaid ({unpaidSales.length})
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2" data-testid="tab-scheduled">
              <CalendarClock className="h-4 w-4" />
              Scheduled ({scheduledPayments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Complete Transaction Ledger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[90px]">Date</TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Bill Amount</TableHead>
                        <TableHead className="text-right text-emerald-600">Paid</TableHead>
                        <TableHead className="text-right text-red-600">Outstanding</TableHead>
                        <TableHead className="text-right font-bold">Balance</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((txn) => {
                          const outstanding = txn.type !== 'payment' ? Math.max(0, txn.totalAmount - txn.paid) : 0;
                          const hasItems = txn.items && txn.items.length > 0;
                          const isExpanded = expandedRows.has(txn.id);
                          return (
                            <Fragment key={txn.id}>
                              <TableRow 
                                className={`${
                                  txn.type === 'payment' ? 'bg-emerald-50/50' :
                                  txn.type === 'cash_loan' ? 'bg-amber-50/50' :
                                  txn.status === 'paid' ? 'bg-blue-50/30' : ''
                                } ${hasItems ? 'cursor-pointer' : ''}`}
                                onClick={() => hasItems && toggleRowExpand(txn.id)}
                                data-testid={`row-transaction-${txn.id}`}
                              >
                                <TableCell className="font-medium text-slate-600">
                                  <div className="flex items-center gap-1">
                                    {hasItems && (
                                      isExpanded ? 
                                        <ChevronDown className="h-4 w-4 text-slate-400" /> : 
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )}
                                    {formatDateShort(txn.date)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {getTransactionIcon(txn.type)}
                                    {getTransactionBadge(txn.type)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{txn.description}</p>
                                    {hasItems && (
                                      <p className="text-xs text-blue-600 mt-0.5">
                                        {txn.items!.length} item{txn.items!.length > 1 ? 's' : ''} - Click to view
                                      </p>
                                    )}
                                    {txn.status && txn.type !== 'payment' && (
                                      <Badge 
                                        variant={txn.status === 'paid' ? 'default' : txn.status === 'partial' ? 'secondary' : 'destructive'}
                                        className="mt-1 text-xs"
                                      >
                                        {txn.status.toUpperCase()}
                                      </Badge>
                                    )}
                                    {txn.notes && (
                                      <p className="text-xs text-slate-500 mt-1">{txn.notes}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {txn.type === 'payment' 
                                    ? '-' 
                                    : `Rs. ${Math.round(txn.totalAmount).toLocaleString()}`}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600">
                                  {txn.type === 'payment' 
                                    ? `Rs. ${Math.round(txn.credit).toLocaleString()}`
                                    : txn.paid > 0 
                                      ? `Rs. ${Math.round(txn.paid).toLocaleString()}` 
                                      : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  {txn.type === 'payment' 
                                    ? '-' 
                                    : outstanding > 0 
                                      ? `Rs. ${Math.round(outstanding).toLocaleString()}` 
                                      : <span className="text-emerald-600">CLEARED</span>}
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-800">
                                  Rs. {Math.round(txn.balance).toLocaleString()}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {txn.type === 'bill' || txn.type === 'cash_loan' ? (
                                    <Link href={`/bill/${txn.saleId}?from=customer`}>
                                      <Button size="icon" variant="ghost" data-testid={`button-view-${txn.id}`}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const payment = paymentHistory.find(p => `payment-${p.id}` === txn.id);
                                        if (payment) openEditPayment(payment);
                                      }}
                                      data-testid={`button-edit-${txn.id}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                              {hasItems && isExpanded && (
                                <TableRow key={`${txn.id}-items`} className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
                                  <TableCell colSpan={8} className="p-0">
                                    <div className="mx-4 my-3 bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-white" />
                                            <span className="text-sm font-semibold text-white">
                                              Items for {txn.description}
                                            </span>
                                          </div>
                                          <span className="text-xs text-blue-100">
                                            {txn.items!.length} item{txn.items!.length !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="divide-y divide-slate-100">
                                        {txn.items!.map((item, idx) => (
                                          <div 
                                            key={idx} 
                                            className="flex items-center justify-between p-3 hover:bg-slate-50/50"
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-800">{item.productName}</span>
                                                <span className="text-slate-500">|</span>
                                                <span className="text-slate-600">{item.variantName}</span>
                                                <span className="text-slate-500">|</span>
                                                <span className="text-slate-500">{item.colorName}</span>
                                                {item.colorCode && (
                                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                    {item.colorCode}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-right">
                                              <div className="text-sm">
                                                <span className="text-slate-600 font-medium">{item.quantity}</span>
                                                <span className="text-slate-400 mx-1">x</span>
                                                <span className="text-slate-600">Rs. {Math.round(item.rate).toLocaleString()}</span>
                                              </div>
                                              <div className="font-bold text-slate-800 min-w-[100px] text-right">
                                                Rs. {Math.round(item.subtotal).toLocaleString()}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="bg-slate-50 px-4 py-2 flex justify-end border-t">
                                        <div className="flex items-center gap-3">
                                          <span className="text-sm text-slate-600">Total:</span>
                                          <span className="font-bold text-lg text-slate-800">
                                            Rs. {Math.round(txn.totalAmount).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid-bills">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Paid Bills (Completed)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paidSales.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No paid bills yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paidSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        data-testid={`card-paid-${sale.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${sale.isManualBalance ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                            {sale.isManualBalance ? (
                              <Landmark className="h-5 w-5 text-amber-600" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {sale.isManualBalance ? 'Manual Balance (Cleared)' : `Bill #${sale.id.slice(0, 8)}`}
                              </p>
                              <Badge className="bg-emerald-500 text-white">PAID</Badge>
                            </div>
                            <p className="text-sm text-slate-500">
                              {formatDateShort(sale.createdAt)}
                            </p>
                            {sale.notes && (
                              <p className="text-xs text-slate-400 mt-1">{sale.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-slate-500">Bill Amount</p>
                            <p className="text-lg font-bold text-slate-800">
                              Rs. {Math.round(safeParseFloat(sale.totalAmount)).toLocaleString()}
                            </p>
                            <p className="text-sm text-emerald-600 font-medium">
                              Paid: Rs. {Math.round(safeParseFloat(sale.amountPaid)).toLocaleString()}
                            </p>
                          </div>
                          <Link href={`/bill/${sale.id}?from=customer`}>
                            <Button size="icon" variant="outline" data-testid={`button-view-paid-${sale.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarClock className="h-5 w-5" />
                  Scheduled Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduledPayments.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No scheduled payments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scheduledPayments.map((payment) => {
                      const status = getDueDateStatus(payment.dueDate);
                      return (
                        <div
                          key={payment.id}
                          className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                            status === 'overdue' ? 'border-red-200 bg-red-50' :
                            status === 'due_soon' ? 'border-amber-200 bg-amber-50' :
                            'border-slate-200 bg-white'
                          }`}
                          data-testid={`card-scheduled-${payment.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${
                              status === 'overdue' ? 'bg-red-100' :
                              status === 'due_soon' ? 'bg-amber-100' :
                              'bg-slate-100'
                            }`}>
                              <Calendar className={`h-5 w-5 ${
                                status === 'overdue' ? 'text-red-600' :
                                status === 'due_soon' ? 'text-amber-600' :
                                'text-slate-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-semibold">
                                {payment.isManualBalance ? 'Manual Balance' : `Bill #${payment.id.slice(0, 8)}`}
                              </p>
                              <p className="text-sm text-slate-500">
                                Due: {formatDateShort(payment.dueDate)}
                              </p>
                              {payment.notes && (
                                <p className="text-xs text-slate-400 mt-1">{payment.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              status === 'overdue' ? 'bg-red-500 text-white' :
                              status === 'due_soon' ? 'bg-amber-500 text-white' :
                              'bg-slate-500 text-white'
                            }>
                              {status === 'overdue' ? 'OVERDUE' : status === 'due_soon' ? 'DUE SOON' : 'UPCOMING'}
                            </Badge>
                            <p className="text-xl font-bold mt-2">
                              Rs. {Math.round(payment.outstanding).toLocaleString()}
                            </p>
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setSelectedSaleId(payment.id);
                                setPaymentDialogOpen(true);
                              }}
                              data-testid={`button-pay-${payment.id}`}
                            >
                              <Wallet className="h-4 w-4 mr-1" />
                              Pay Now
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unpaid-bills">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Receipt className="h-5 w-5 text-red-600" />
                  Unpaid Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unpaidSales.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30 text-emerald-500" />
                    <p>All bills are paid!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unpaidSales.map((sale) => {
                      const outstanding = safeParseFloat(sale.totalAmount) - safeParseFloat(sale.amountPaid);
                      const paidPercent = (safeParseFloat(sale.amountPaid) / safeParseFloat(sale.totalAmount)) * 100;
                      return (
                        <div
                          key={sale.id}
                          className="p-4 rounded-xl border bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                          data-testid={`card-unpaid-${sale.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${sale.isManualBalance ? 'bg-amber-100' : 'bg-blue-100'}`}>
                              {sale.isManualBalance ? (
                                <Landmark className="h-5 w-5 text-amber-600" />
                              ) : (
                                <Receipt className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  {sale.isManualBalance ? 'Manual Balance' : `Bill #${sale.id.slice(0, 8)}`}
                                </p>
                                <Badge variant={sale.paymentStatus === 'partial' ? 'secondary' : 'destructive'}>
                                  {sale.paymentStatus.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500">
                                {formatDateShort(sale.createdAt)}
                                {sale.dueDate && ` | Due: ${formatDateShort(sale.dueDate)}`}
                              </p>
                              {sale.notes && (
                                <p className="text-xs text-slate-400 mt-1">{sale.notes}</p>
                              )}
                              <div className="w-48 h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 transition-all"
                                  style={{ width: `${paidPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-slate-500">
                                Rs. {Math.round(safeParseFloat(sale.amountPaid)).toLocaleString()} / Rs. {Math.round(safeParseFloat(sale.totalAmount)).toLocaleString()}
                              </p>
                              <p className="text-xl font-bold text-red-600">
                                Rs. {Math.round(outstanding).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Link href={`/bill/${sale.id}?from=customer`}>
                                <Button size="icon" variant="outline" data-testid={`button-view-bill-${sale.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                onClick={() => {
                                  setSelectedSaleId(sale.id);
                                  setPaymentDialogOpen(true);
                                }}
                                data-testid={`button-receive-payment-${sale.id}`}
                              >
                                <Wallet className="h-4 w-4 mr-1" />
                                Pay
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
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
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
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
                  setPaymentToDelete(editingPayment);
                  setEditPaymentDialogOpen(false);
                  setDeletePaymentDialogOpen(true);
                }
              }}
              data-testid="button-delete-payment"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>Cancel</Button>
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
              Are you sure you want to delete this payment of Rs. {paymentToDelete ? Math.round(safeParseFloat(paymentToDelete.amount)).toLocaleString() : 0}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (paymentToDelete) {
                  deletePaymentMutation.mutate(paymentToDelete.id);
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
            <DialogDescription>
              Add a manual balance entry to the customer's account
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setCashLoanDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddCashLoan}
              disabled={addCashLoanMutation.isPending}
              data-testid="button-add-loan"
            >
              {addCashLoanMutation.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}