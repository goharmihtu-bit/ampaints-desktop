// unpaid-bills.tsx - Fixed Calculation Version
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  CreditCard, 
  Calendar, 
  User, 
  Phone, 
  Plus, 
  Trash2, 
  Eye, 
  Search, 
  Banknote, 
  Printer, 
  Receipt,
  Filter,
  X,
  ChevronDown,
  FileText,
  History,
  MessageSquare,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  BarChart3,
  Wallet,
  IndianRupee,
  SortAsc,
  SortDesc
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import jsPDF from "jspdf";

interface CustomerSuggestion {
  customerName: string;
  customerPhone: string;
  lastSaleDate: string;
  totalSpent: number;
}

interface PaymentRecord {
  id: string;
  saleId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
}

interface BalanceNote {
  id: string;
  saleId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

type ConsolidatedCustomer = {
  customerPhone: string;
  customerName: string;
  bills: Sale[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  oldestBillDate: Date;
  daysOverdue: number;
  paymentHistory: PaymentRecord[];
  balanceNotes: BalanceNote[];
};

type FilterType = {
  search: string;
  amountRange: {
    min: string;
    max: string;
  };
  daysOverdue: string;
  dueDate: {
    from: string;
    to: string;
  };
  sortBy: "oldest" | "newest" | "highest" | "lowest" | "name";
  paymentStatus: "all" | "overdue" | "due_soon" | "no_due_date";
};

export default function UnpaidBills() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const [, setLocation] = useLocation();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  
  // Manual balance state
  const [manualBalanceDialogOpen, setManualBalanceDialogOpen] = useState(false);
  const [manualBalanceForm, setManualBalanceForm] = useState({
    customerName: "",
    customerPhone: "",
    totalAmount: "",
    dueDate: "",
    notes: ""
  });
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  
  // Due date edit state
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [dueDateForm, setDueDateForm] = useState({
    dueDate: "",
    notes: ""
  });

  // Notes state
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [viewingNotesCustomerPhone, setViewingNotesCustomerPhone] = useState<string | null>(null);

  // Payment history state
  const [paymentHistoryDialogOpen, setPaymentHistoryDialogOpen] = useState(false);
  const [viewingPaymentHistoryCustomerPhone, setViewingPaymentHistoryCustomerPhone] = useState<string | null>(null);
  
  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  
  const { toast } = useToast();
  const { canEditPayment, canDeletePayment, canEditSales } = usePermissions();

  const { data: customerSuggestions = [] } = useQuery<CustomerSuggestion[]>({
    queryKey: ["/api/customers/suggestions"],
  });

  const [filters, setFilters] = useState<FilterType>({
    search: "",
    amountRange: {
      min: "",
      max: ""
    },
    daysOverdue: "",
    dueDate: {
      from: "",
      to: ""
    },
    sortBy: "oldest",
    paymentStatus: "all"
  });

  const { data: unpaidSales = [], isLoading, refetch: refetchUnpaidSales } = useQuery<Sale[]>({
    queryKey: ["/api/sales/unpaid"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when tab becomes active
  });

  // Fetch payment history for a specific customer
  const { data: paymentHistory = [], refetch: refetchPaymentHistory } = useQuery<PaymentRecord[]>({
    queryKey: [`/api/payment-history/customer/${viewingPaymentHistoryCustomerPhone}`],
    enabled: !!viewingPaymentHistoryCustomerPhone,
  });

  // Fetch balance notes for all sales of a customer
  const { data: balanceNotes = [], refetch: refetchBalanceNotes } = useQuery<BalanceNote[]>({
    queryKey: [`/api/customer/${viewingNotesCustomerPhone}/notes`],
    enabled: !!viewingNotesCustomerPhone,
  });

  // Auto-refresh data when dialogs open
  useEffect(() => {
    if (paymentHistoryDialogOpen && viewingPaymentHistoryCustomerPhone) {
      refetchPaymentHistory();
    }
  }, [paymentHistoryDialogOpen, viewingPaymentHistoryCustomerPhone]);

  useEffect(() => {
    if (notesDialogOpen && viewingNotesCustomerPhone) {
      refetchBalanceNotes();
    }
  }, [notesDialogOpen, viewingNotesCustomerPhone]);

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod: string; notes?: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { 
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      if (viewingPaymentHistoryCustomerPhone) {
        queryClient.invalidateQueries({ queryKey: [`/api/payment-history/customer/${viewingPaymentHistoryCustomerPhone}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      refetchUnpaidSales();
      toast({ 
        title: "Payment recorded successfully",
        description: `Payment of Rs. ${parseFloat(paymentAmount).toLocaleString()} has been recorded.`
      });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentMethod("cash");
    },
    onError: (error: Error) => {
      console.error("Payment recording error:", error);
      toast({ 
        title: "Failed to record payment", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { customerPhone: string; note: string }) => {
      return await apiRequest("POST", `/api/customer/${data.customerPhone}/notes`, {
        note: data.note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (viewingNotesCustomerPhone) {
        queryClient.invalidateQueries({ queryKey: [`/api/customer/${viewingNotesCustomerPhone}/notes`] });
      }
      refetchUnpaidSales();
      refetchBalanceNotes();
      toast({ title: "Note added successfully" });
      setNotesDialogOpen(false);
      setNewNote("");
    },
    onError: (error: Error) => {
      console.error("Add note error:", error);
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const createManualBalanceMutation = useMutation({
    mutationFn: async (data: { customerName: string; customerPhone: string; totalAmount: string; dueDate?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/sales/manual-balance", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      refetchUnpaidSales();
      toast({ 
        title: "New pending balance added successfully",
        description: "A new separate bill has been created for this customer"
      });
      setManualBalanceDialogOpen(false);
      setManualBalanceForm({
        customerName: "",
        customerPhone: "",
        totalAmount: "",
        dueDate: "",
        notes: ""
      });
    },
    onError: (error: Error) => {
      console.error("Create manual balance error:", error);
      toast({ title: "Failed to add pending balance", variant: "destructive" });
    },
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async (data: { saleId: string; dueDate?: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/sales/${data.saleId}/due-date`, {
        dueDate: data.dueDate || null,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      refetchUnpaidSales();
      toast({ title: "Due date updated successfully" });
      setDueDateDialogOpen(false);
      setEditingSaleId(null);
      setDueDateForm({ dueDate: "", notes: "" });
    },
    onError: (error: Error) => {
      console.error("Update due date error:", error);
      toast({ title: "Failed to update due date", variant: "destructive" });
    },
  });

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      toast({ title: "Please enter payment amount", variant: "destructive" });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast({ title: "Payment amount must be positive", variant: "destructive" });
      return;
    }

    // Check if payment exceeds outstanding
    if (amount > selectedCustomer.totalOutstanding) {
      toast({ 
        title: `Payment amount exceeds outstanding balance`, 
        description: `Payment: Rs. ${Math.round(amount).toLocaleString()} | Outstanding: Rs. ${Math.round(selectedCustomer.totalOutstanding).toLocaleString()}`,
        variant: "destructive" 
      });
      return;
    }

    // Sort bills by date (oldest first) and apply payment
    const sortedBills = [...selectedCustomer.bills].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remainingPayment = amount;
    const paymentsToApply: { saleId: string; amount: number }[] = [];

    for (const bill of sortedBills) {
      if (remainingPayment <= 0) break;
      
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      
      if (billOutstanding > 0) {
        const paymentForThisBill = Math.min(remainingPayment, billOutstanding);
        paymentsToApply.push({ saleId: bill.id, amount: paymentForThisBill });
        remainingPayment -= paymentForThisBill;
      }
    }

    // Apply all payments
    try {
      for (const payment of paymentsToApply) {
        await apiRequest("POST", `/api/sales/${payment.saleId}/payment`, { 
          amount: payment.amount,
          paymentMethod: paymentMethod,
          notes: paymentNotes 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      if (viewingPaymentHistoryCustomerPhone) {
        queryClient.invalidateQueries({ queryKey: [`/api/payment-history/customer/${viewingPaymentHistoryCustomerPhone}`] });
      }
      refetchUnpaidSales();
      refetchPaymentHistory();
      toast({ 
        title: `Payment recorded successfully`,
        description: `Payment of Rs. ${Math.round(amount).toLocaleString()} has been applied to ${paymentsToApply.length} bill(s).`
      });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentMethod("cash");
      setSelectedCustomerPhone(null);
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  const handleAddNote = () => {
    if (!viewingNotesCustomerPhone || !newNote.trim()) {
      toast({ title: "Please enter a note", variant: "destructive" });
      return;
    }

    addNoteMutation.mutate({
      customerPhone: viewingNotesCustomerPhone,
      note: newNote.trim()
    });
  };

  const getDueDateStatus = (dueDate: Date | string | null) => {
    if (!dueDate) return "no_due_date";
    
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "overdue";
    if (diffDays <= 7) return "due_soon";
    return "future";
  };

  const getDueDateBadge = (dueDate: Date | string | null) => {
    const status = getDueDateStatus(dueDate);
    
    switch (status) {
      case "overdue":
        return <Badge variant="destructive" className="flex items-center gap-1 glass-destructive">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>;
      case "due_soon":
        return <Badge variant="secondary" className="flex items-center gap-1 glass-warning">
          <Clock className="h-3 w-3" />
          Due Soon
        </Badge>;
      case "future":
        return <Badge variant="outline" className="flex items-center gap-1 glass-success">
          <Calendar className="h-3 w-3" />
          Upcoming
        </Badge>;
      default:
        return <Badge variant="outline" className="glass-outline">No Due Date</Badge>;
    }
  };

  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    unpaidSales.forEach(sale => {
      const phone = sale.customerPhone;
      const existing = customerMap.get(phone);
      
      const totalAmount = parseFloat(sale.totalAmount || "0");
      const totalPaid = parseFloat(sale.amountPaid || "0");
      const outstanding = totalAmount - totalPaid;
      const billDate = new Date(sale.createdAt);
      const daysOverdue = Math.max(0, Math.ceil((new Date().getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      if (existing) {
        existing.bills.push(sale);
        existing.totalAmount += totalAmount;
        existing.totalPaid += totalPaid;
        existing.totalOutstanding += outstanding;
        if (billDate < existing.oldestBillDate) {
          existing.oldestBillDate = billDate;
          existing.daysOverdue = daysOverdue;
        }
      } else {
        customerMap.set(phone, {
          customerPhone: phone,
          customerName: sale.customerName,
          bills: [sale],
          totalAmount,
          totalPaid,
          totalOutstanding: outstanding,
          oldestBillDate: billDate,
          daysOverdue,
          paymentHistory: [],
          balanceNotes: []
        });
      }
    });
    
    return Array.from(customerMap.values());
  }, [unpaidSales]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...consolidatedCustomers];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(customer => 
        customer.customerName.toLowerCase().includes(searchLower) ||
        customer.customerPhone.includes(searchLower)
      );
    }

    // Apply amount range filter
    if (filters.amountRange.min) {
      const min = parseFloat(filters.amountRange.min);
      filtered = filtered.filter(customer => customer.totalOutstanding >= min);
    }
    if (filters.amountRange.max) {
      const max = parseFloat(filters.amountRange.max);
      filtered = filtered.filter(customer => customer.totalOutstanding <= max);
    }

    // Apply days overdue filter
    if (filters.daysOverdue) {
      const days = parseInt(filters.daysOverdue);
      filtered = filtered.filter(customer => customer.daysOverdue >= days);
    }

    // Apply payment status filter
    if (filters.paymentStatus !== "all") {
      filtered = filtered.filter(customer => {
        return customer.bills.some(bill => {
          const dueDateStatus = getDueDateStatus(bill.dueDate);
          return dueDateStatus === filters.paymentStatus;
        });
      });
    }

    // Apply due date filter
    if (filters.dueDate.from || filters.dueDate.to) {
      const fromDate = filters.dueDate.from ? new Date(filters.dueDate.from) : null;
      const toDate = filters.dueDate.to ? new Date(filters.dueDate.to) : null;
      
      filtered = filtered.filter(customer => {
        return customer.bills.some(bill => {
          if (!bill.dueDate) return false;
          const dueDate = new Date(bill.dueDate);
          
          if (fromDate && toDate) {
            return dueDate >= fromDate && dueDate <= toDate;
          } else if (fromDate) {
            return dueDate >= fromDate;
          } else if (toDate) {
            return dueDate <= toDate;
          }
          return false;
        });
      });
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "newest":
        filtered.sort((a, b) => b.oldestBillDate.getTime() - a.oldestBillDate.getTime());
        break;
      case "highest":
        filtered.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
        break;
      case "lowest":
        filtered.sort((a, b) => a.totalOutstanding - b.totalOutstanding);
        break;
      case "name":
        filtered.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
      case "oldest":
      default:
        filtered.sort((a, b) => a.oldestBillDate.getTime() - b.oldestBillDate.getTime());
        break;
    }

    return filtered;
  }, [consolidatedCustomers, filters]);

  const hasActiveFilters = filters.search || filters.amountRange.min || filters.amountRange.max || 
                          filters.daysOverdue || filters.dueDate.from || filters.dueDate.to || 
                          filters.paymentStatus !== "all";

  const clearFilters = () => {
    setFilters({
      search: "",
      amountRange: { min: "", max: "" },
      daysOverdue: "",
      dueDate: { from: "", to: "" },
      sortBy: "oldest",
      paymentStatus: "all"
    });
  };

  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const selectedCustomer = consolidatedCustomers.find(c => c.customerPhone === selectedCustomerPhone);

  // Refresh data when customer details dialog opens
  useEffect(() => {
    if (selectedCustomerPhone) {
      refetchUnpaidSales();
    }
  }, [selectedCustomerPhone]);

  // Generate PDF Statement as Blob
  const generateStatementPDFBlob = (customer: ConsolidatedCustomer): Blob => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Header
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

    // Customer Info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Customer:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customer.customerName, margin + 25, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Phone:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(customer.customerPhone, margin + 25, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Date:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(new Date()), margin + 25, yPos);
    yPos += 10;

    // Summary Box
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 20, 'F');
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    const colWidth = (pageWidth - 2 * margin) / 3;
    pdf.text('Total Amount', margin + colWidth / 2, yPos, { align: 'center' });
    pdf.text('Amount Paid', margin + colWidth + colWidth / 2, yPos, { align: 'center' });
    pdf.text('Outstanding', margin + 2 * colWidth + colWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    pdf.setFontSize(11);
    pdf.text(`Rs. ${Math.round(customer.totalAmount).toLocaleString()}`, margin + colWidth / 2, yPos, { align: 'center' });
    pdf.text(`Rs. ${Math.round(customer.totalPaid).toLocaleString()}`, margin + colWidth + colWidth / 2, yPos, { align: 'center' });
    pdf.setTextColor(220, 38, 38);
    pdf.text(`Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}`, margin + 2 * colWidth + colWidth / 2, yPos, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPos += 15;

    // Table Header
    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATE', margin + 3, yPos + 5.5);
    pdf.text('BILL NO', margin + 30, yPos + 5.5);
    pdf.text('TOTAL', margin + 70, yPos + 5.5);
    pdf.text('PAID', margin + 100, yPos + 5.5);
    pdf.text('DUE', margin + 130, yPos + 5.5);
    pdf.text('STATUS', pageWidth - margin - 20, yPos + 5.5);
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    // Bill Rows
    customer.bills.forEach((bill, index) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }

      const billTotal = parseFloat(bill.totalAmount || "0");
      const billPaid = parseFloat(bill.amountPaid || "0");
      const billDue = billTotal - billPaid;
      const dueDateStatus = getDueDateStatus(bill.dueDate);
      
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 8, 'F');
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDateShort(new Date(bill.createdAt)), margin + 3, yPos + 2);
      pdf.text(bill.id.slice(-8).toUpperCase(), margin + 30, yPos + 2);
      pdf.text(`Rs. ${Math.round(billTotal).toLocaleString()}`, margin + 70, yPos + 2);
      pdf.text(`Rs. ${Math.round(billPaid).toLocaleString()}`, margin + 100, yPos + 2);
      pdf.text(`Rs. ${Math.round(billDue).toLocaleString()}`, margin + 130, yPos + 2);
      
      const statusText = dueDateStatus === 'overdue' ? 'Overdue' : 
                        dueDateStatus === 'due_soon' ? 'Due Soon' : 
                        dueDateStatus === 'future' ? 'Upcoming' : 'Pending';
      pdf.text(statusText, pageWidth - margin - 20, yPos + 2);
      
      yPos += 8;
    });

    // Footer
    yPos += 10;
    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(pageWidth - margin - 70, yPos - 5, 70, 15, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BALANCE DUE:', pageWidth - margin - 65, yPos + 3);
    pdf.text(`Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}`, pageWidth - margin - 5, yPos + 3, { align: 'right' });

    return pdf.output('blob');
  };

  // Generate PDF Statement with Download functionality
  const generateDetailedPDFStatement = (customer: ConsolidatedCustomer) => {
    const pdfBlob = generateStatementPDFBlob(customer);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement-${customer.customerName.replace(/\s+/g, '_')}-${formatDateShort(new Date()).replace(/\//g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ 
      title: "Statement Downloaded",
      description: `PDF Statement for ${customer.customerName} has been downloaded`
    });
  };

  const glassStyles = `
    .glass-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .glass-destructive {
      background: rgba(239, 68, 68, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .glass-warning {
      background: rgba(245, 158, 11, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .glass-success {
      background: rgba(34, 197, 94, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .glass-outline {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .hover-elevate {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-elevate:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .premium-border {
      border: 1px solid;
      border-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%) 1;
    }
  `;

  const totalOutstanding = consolidatedCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
  const totalCustomers = consolidatedCustomers.length;
  const averageOutstanding = totalCustomers > 0 ? totalOutstanding / totalCustomers : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 space-y-6">
      <style>{glassStyles}</style>
      
      {/* Header Section */}
      <div className="glass-card rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="gradient-bg p-2 rounded-xl">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Account Statements
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Track pending balances, payment history, and generate premium statements
                </p>
              </div>
            </div>
            
            {/* Stats Overview */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-slate-700">
                  <strong>{totalCustomers}</strong> Customers
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-slate-700">
                  Total: <strong>Rs. {Math.round(totalOutstanding).toLocaleString()}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-slate-700">
                  Avg: <strong>Rs. {Math.round(averageOutstanding).toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {canEditSales && (
              <Button 
                variant="outline" 
                onClick={() => setManualBalanceDialogOpen(true)}
                className="flex items-center gap-2 glass-card border-white/20 hover:border-purple-300 transition-all duration-300"
              >
                <Plus className="h-4 w-4" />
                Add Balance
              </Button>
            )}

            <Button 
              className="flex items-center gap-2 gradient-bg text-white hover:shadow-lg transition-all duration-300"
              onClick={() => {
                if (consolidatedCustomers.length > 0) {
                  generateDetailedPDFStatement(consolidatedCustomers[0]);
                }
              }}
              disabled={consolidatedCustomers.length === 0}
            >
              <Download className="h-4 w-4" />
              Download Statement
            </Button>
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customers by name or phone..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 glass-card border-white/20 focus:border-purple-300 transition-colors"
            />
          </div>

          {/* Sort Dropdown */}
          <Select
            value={filters.sortBy}
            onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
          >
            <SelectTrigger className="w-[180px] glass-card border-white/20">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="glass-card border-white/20">
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest Amount</SelectItem>
              <SelectItem value="lowest">Lowest Amount</SelectItem>
              <SelectItem value="name">Customer Name</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Button */}
          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 glass-card border-white/20 hover:border-purple-300">
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 glass-card border-white/20 p-0">
              <div className="p-4 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <h4 className="font-semibold text-slate-800">Advanced Filters</h4>
                </div>
              </div>
              
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Payment Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Payment Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "overdue", label: "Overdue" },
                      { value: "due_soon", label: "Due Soon" },
                      { value: "no_due_date", label: "No Due Date" }
                    ].map((status) => (
                      <Button
                        key={status.value}
                        variant={filters.paymentStatus === status.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, paymentStatus: status.value as any }))}
                        className={`text-xs ${
                          filters.paymentStatus === status.value 
                            ? 'gradient-bg text-white' 
                            : 'glass-card border-white/20'
                        }`}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Amount Range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Amount Range (Rs.)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      value={filters.amountRange.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, min: e.target.value }
                      }))}
                      type="number"
                      className="glass-card border-white/20"
                    />
                    <Input
                      placeholder="Max"
                      value={filters.amountRange.max}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, max: e.target.value }
                      }))}
                      type="number"
                      className="glass-card border-white/20"
                    />
                  </div>
                </div>

                {/* Days Overdue */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Minimum Days Overdue</Label>
                  <Input
                    placeholder="e.g., 30"
                    value={filters.daysOverdue}
                    onChange={(e) => setFilters(prev => ({ ...prev, daysOverdue: e.target.value }))}
                    type="number"
                    className="glass-card border-white/20"
                  />
                </div>

                {/* Due Date Range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Due Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="From"
                      value={filters.dueDate.from}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        dueDate: { ...prev.dueDate, from: e.target.value }
                      }))}
                      type="date"
                      className="glass-card border-white/20"
                    />
                    <Input
                      placeholder="To"
                      value={filters.dueDate.to}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        dueDate: { ...prev.dueDate, to: e.target.value }
                      }))}
                      type="date"
                      className="glass-card border-white/20"
                    />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="p-4 border-t border-white/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full glass-card border-white/20 text-slate-600 hover:text-slate-800"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Summary */}
      {hasActiveFilters && (
        <div className="glass-card rounded-xl p-4 border border-white/20">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="glass-card border-white/20">
              <Filter className="h-3 w-3 mr-1" />
              Active Filters
            </Badge>
            {filters.search && (
              <Badge variant="outline" className="glass-card border-white/20">
                Search: "{filters.search}"
              </Badge>
            )}
            {filters.paymentStatus !== "all" && (
              <Badge variant="outline" className="glass-card border-white/20">
                Status: {filters.paymentStatus.replace('_', ' ')}
              </Badge>
            )}
            {filters.amountRange.min && (
              <Badge variant="outline" className="glass-card border-white/20">
                Min: Rs. {parseFloat(filters.amountRange.min).toLocaleString()}
              </Badge>
            )}
            {filters.amountRange.max && (
              <Badge variant="outline" className="glass-card border-white/20">
                Max: Rs. {parseFloat(filters.amountRange.max).toLocaleString()}
              </Badge>
            )}
            {filters.daysOverdue && (
              <Badge variant="outline" className="glass-card border-white/20">
                {filters.daysOverdue}+ Days Overdue
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto glass-card border-white/20 text-slate-600 hover:text-slate-800"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-800">{filteredAndSortedCustomers.length}</span> of {consolidatedCustomers.length} customers
        </p>
        {hasActiveFilters && (
          <p className="text-sm text-slate-600">
            Filtered Outstanding: <span className="font-semibold text-amber-600">
              Rs. {Math.round(filteredAndSortedCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0)).toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {/* Customer Cards Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-6 border border-white/20">
              <Skeleton className="h-6 w-3/4 mb-4 rounded-lg" />
              <Skeleton className="h-4 w-full mb-2 rounded-lg" />
              <Skeleton className="h-4 w-2/3 mb-4 rounded-lg" />
              <Skeleton className="h-20 w-full rounded-xl mb-4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredAndSortedCustomers.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/20">
          <div className="max-w-md mx-auto">
            <div className="gradient-bg w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {hasActiveFilters ? "No customers match your filters" : "All clear! No unpaid bills"}
            </h3>
            <p className="text-slate-600 mb-6">
              {hasActiveFilters ? "Try adjusting your filter criteria" : "All customer payments are up to date and accounted for"}
            </p>
            {hasActiveFilters && (
              <Button 
                onClick={clearFilters}
                className="gradient-bg text-white hover:shadow-lg transition-all duration-300"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCustomers.map((customer) => {
            const hasOverdue = customer.bills.some(bill => getDueDateStatus(bill.dueDate) === 'overdue');
            const hasDueSoon = customer.bills.some(bill => getDueDateStatus(bill.dueDate) === 'due_soon');
            const hasManualBalance = customer.bills.some(bill => bill.isManualBalance);
            
            return (
              <div 
                key={customer.customerPhone} 
                className="glass-card rounded-2xl p-6 border border-white/20 hover-elevate group cursor-pointer"
                onClick={() => {
                  // Refresh data before opening customer details
                  refetchUnpaidSales();
                  setLocation(`/customer/${encodeURIComponent(customer.customerPhone)}`);
                }}
                data-testid={`card-customer-${customer.customerPhone}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      hasOverdue ? 'bg-red-100 text-red-600' : 
                      hasDueSoon ? 'bg-amber-100 text-amber-600' : 
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                        {customer.customerName}
                      </h3>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.customerPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {customer.bills.length > 1 && (
                      <Badge variant="secondary" className="glass-card border-white/20">
                        {customer.bills.length} bills
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-card border-white/20">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          generateDetailedPDFStatement(customer);
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Statement
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setViewingPaymentHistoryCustomerPhone(customer.customerPhone);
                          setPaymentHistoryDialogOpen(true);
                        }}>
                          <History className="h-4 w-4 mr-2" />
                          Payment History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setViewingNotesCustomerPhone(customer.customerPhone);
                          setNotesDialogOpen(true);
                        }}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          View Notes
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-3 w-3" />
                    {formatDateShort(customer.oldestBillDate)}
                  </div>
                  <Badge 
                    variant={customer.daysOverdue > 30 ? "destructive" : "secondary"} 
                    className="glass-card border-white/20 ml-auto"
                  >
                    {customer.daysOverdue} days
                  </Badge>
                  {hasOverdue && (
                    <Badge variant="destructive" className="glass-destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                  {hasManualBalance && (
                    <Badge variant="outline" className="glass-outline text-blue-600">
                      <Plus className="h-3 w-3 mr-1" />
                      Manual
                    </Badge>
                  )}
                </div>

                {/* Amount Summary */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Total Amount</span>
                    <span className="font-mono font-semibold text-slate-800">
                      Rs. {Math.round(customer.totalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Amount Paid</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      Rs. {Math.round(customer.totalPaid).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base border-t border-slate-200 pt-2">
                    <span className="font-semibold text-slate-800">Outstanding</span>
                    <span className="font-mono font-bold text-red-600">
                      Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 glass-card border-white/20 text-slate-700 hover:border-purple-300 transition-all"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Refresh data before showing details
                      refetchUnpaidSales();
                      setSelectedCustomerPhone(customer.customerPhone);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Bills Details Dialog */}
      <Dialog open={!!selectedCustomerPhone && !paymentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedCustomerPhone(null);
        } else {
          // Refresh data when dialog opens
          refetchUnpaidSales();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Bills - {selectedCustomer?.customerName}
            </DialogTitle>
            <DialogDescription>
              Comprehensive view of all bills, payment history, and account notes
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg text-sm">
                <div>
                  <p className="text-slate-600">Customer</p>
                  <p className="font-medium">{selectedCustomer.customerName}</p>
                </div>
                <div>
                  <p className="text-slate-600">Phone</p>
                  <p className="font-medium">{selectedCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-slate-600">Total Bills</p>
                  <p className="font-medium">{selectedCustomer.bills.length}</p>
                </div>
                <div>
                  <p className="text-slate-600">Oldest Bill</p>
                  <p className="font-medium">{formatDateShort(selectedCustomer.oldestBillDate)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingPaymentHistoryCustomerPhone(selectedCustomer.customerPhone);
                    setPaymentHistoryDialogOpen(true);
                  }}
                  className="flex items-center gap-2 glass-card border-white/20"
                >
                  <History className="h-4 w-4" />
                  Payment History
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingNotesCustomerPhone(selectedCustomer.customerPhone);
                    setNotesDialogOpen(true);
                  }}
                  className="flex items-center gap-2 glass-card border-white/20"
                >
                  <MessageSquare className="h-4 w-4" />
                  View Notes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDetailedPDFStatement(selectedCustomer)}
                  className="flex items-center gap-2 glass-card border-white/20"
                >
                  <Download className="h-4 w-4" />
                  Download Statement
                </Button>
              </div>

              {/* Bills List */}
              <div className="space-y-3">
                <h3 className="font-medium text-slate-800">Bills ({selectedCustomer.bills.length})</h3>
                {selectedCustomer.bills.map((bill) => {
                  const billTotal = parseFloat(bill.totalAmount || "0");
                  const billPaid = parseFloat(bill.amountPaid || "0");
                  const billOutstanding = Math.round(billTotal - billPaid);
                  const isManual = bill.isManualBalance;
                  
                  return (
                    <Card key={bill.id} className={isManual ? "border-blue-200 bg-blue-50" : "glass-card border-white/20"}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-slate-600" />
                              <span className="text-sm font-medium">
                                {formatDateShort(bill.createdAt)} - {new Date(bill.createdAt).toLocaleTimeString()}
                              </span>
                              {getDueDateBadge(bill.dueDate)}
                              {isManual && (
                                <Badge variant="outline" className="glass-outline text-blue-600">
                                  Manual Balance
                                </Badge>
                              )}
                            </div>
                            {bill.notes && isManual && (
                              <div className="text-sm text-slate-600 bg-white p-2 rounded-md">
                                <strong>Notes:</strong> {bill.notes}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                              <div>
                                <span className="text-slate-600">Total: </span>
                                <span>Rs. {Math.round(billTotal).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Paid: </span>
                                <span>Rs. {Math.round(billPaid).toLocaleString()}</span>
                              </div>
                              {billOutstanding > 0 && (
                                <div>
                                  <span className="text-slate-600">Due: </span>
                                  <span className="text-red-600 font-semibold">Rs. {billOutstanding.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!isManual && (
                              <Link href={`/bill/${bill.id}`}>
                                <Button variant="outline" size="sm" className="glass-card border-white/20">
                                  <Printer className="h-4 w-4 mr-1" />
                                  Print
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Consolidated Totals */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Amount:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount Paid:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-base text-red-600 border-t border-slate-300 pt-2">
                  <span>Total Outstanding:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedCustomerPhone(null)} className="glass-card border-white/20">
                  Close
                </Button>
                {canEditPayment && (
                  <Button
                    onClick={() => {
                      setPaymentDialogOpen(true);
                      setPaymentAmount(Math.round(selectedCustomer.totalOutstanding).toString());
                    }}
                    className="gradient-bg text-white"
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Process payment for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Bills:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Already Paid:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-300 pt-2">
                  <span>Total Outstanding:</span>
                  <span className="font-mono text-red-600">
                    Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount (Rs.)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="glass-card border-white/20"
                />
                <p className="text-xs text-slate-600">
                  Payment will be applied to oldest bills first
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="glass-card border-white/20">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-white/20">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Add notes about this payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="glass-card border-white/20"
                />
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setPaymentDialogOpen(false)}
                  className="glass-card border-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recordPaymentMutation.isPending}
                  className="gradient-bg text-white"
                >
                  {recordPaymentMutation.isPending ? "Processing..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryDialogOpen} onOpenChange={setPaymentHistoryDialogOpen}>
        <DialogContent className="max-w-2xl glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment History
            </DialogTitle>
            <DialogDescription>
              All payment records for this customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {paymentHistory.map((payment) => (
                  <Card key={payment.id} className="glass-card border-white/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Rs. {parseFloat(payment.amount).toFixed(2)}</span>
                            <Badge variant="outline" className="glass-card border-white/20">{payment.paymentMethod}</Badge>
                          </div>
                          <div className="text-sm text-slate-600">
                            {formatDateShort(payment.createdAt)} at {new Date(payment.createdAt).toLocaleTimeString()}
                          </div>
                          {payment.notes && (
                            <div className="text-sm bg-slate-50 p-2 rounded-md mt-2">
                              {payment.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setPaymentHistoryDialogOpen(false)}
                className="glass-card border-white/20"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Balance Notes
            </DialogTitle>
            <DialogDescription>
              Add and view notes for this customer's balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add New Note */}
            <div className="space-y-2">
              <Label htmlFor="newNote">Add New Note</Label>
              <Textarea
                id="newNote"
                placeholder="Enter your note here..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="glass-card border-white/20"
              />
              <Button
                onClick={handleAddNote}
                disabled={addNoteMutation.isPending || !newNote.trim()}
                className="w-full gradient-bg text-white"
              >
                {addNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Button>
            </div>

            {/* Existing Notes */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="font-medium text-slate-800">Previous Notes</h4>
              {balanceNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notes found</p>
                </div>
              ) : (
                balanceNotes.map((note) => (
                  <Card key={note.id} className="glass-card border-white/20">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <p className="text-sm">{note.note}</p>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>By: {note.createdBy}</span>
                          <span>{formatDateShort(note.createdAt)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setNotesDialogOpen(false)}
                className="glass-card border-white/20"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Balance Dialog */}
      <Dialog open={manualBalanceDialogOpen} onOpenChange={setManualBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Pending Balance
            </DialogTitle>
            <DialogDescription>
              Create a pending balance entry without POS sale
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer</Label>
              <div className="relative">
                <Input
                  value={manualBalanceForm.customerName}
                  onChange={(e) => setManualBalanceForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="pr-12 glass-card border-white/20"
                  placeholder="Type or select customer"
                />
                <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 glass-card border-white/20" align="start">
                    <Command>
                      <CommandInput placeholder="Search customers..." />
                      <CommandList>
                        <CommandEmpty>No customers found</CommandEmpty>
                        <CommandGroup heading="Recent Customers">
                          {customerSuggestions.map((customer) => (
                            <CommandItem
                              key={customer.customerPhone}
                              onSelect={() => {
                                setManualBalanceForm(prev => ({
                                  ...prev,
                                  customerName: customer.customerName,
                                  customerPhone: customer.customerPhone
                                }));
                                setCustomerSuggestionsOpen(false);
                              }}
                              className="flex flex-col items-start gap-2 py-3 px-4 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <User className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{customer.customerName}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-600 w-full pl-6">
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {customer.customerPhone}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDateShort(customer.lastSaleDate)}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                placeholder="Enter phone number"
                value={manualBalanceForm.customerPhone}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                className="glass-card border-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Amount (Rs.)</Label>
              <Input
                id="totalAmount"
                type="number"
                placeholder="Enter amount"
                value={manualBalanceForm.totalAmount}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                className="glass-card border-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={manualBalanceForm.dueDate}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                className="glass-card border-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this balance"
                value={manualBalanceForm.notes}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="glass-card border-white/20"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setManualBalanceDialogOpen(false);
                  setManualBalanceForm({
                    customerName: "",
                    customerPhone: "",
                    totalAmount: "",
                    dueDate: "",
                    notes: ""
                  });
                }}
                className="glass-card border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!manualBalanceForm.customerName || !manualBalanceForm.customerPhone || !manualBalanceForm.totalAmount) {
                    toast({ title: "Please fill all required fields", variant: "destructive" });
                    return;
                  }
                  createManualBalanceMutation.mutate(manualBalanceForm);
                }}
                disabled={createManualBalanceMutation.isPending}
                className="gradient-bg text-white"
              >
                {createManualBalanceMutation.isPending ? "Adding..." : "Add Balance"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}