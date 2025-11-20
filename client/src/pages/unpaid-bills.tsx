// unpaid-bills.tsx - Complete Updated Version
import { useState, useMemo } from "react";
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
  MoreHorizontal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, SaleWithItems, ColorWithVariantAndProduct, PaymentHistory } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface CustomerSuggestion {
  customerName: string;
  customerPhone: string;
  lastSaleDate: string;
  totalSpent: number;
}

interface PaymentRecord {
  id: string;
  saleId: string;
  amount: number;
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
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [filterOpen, setFilterOpen] = useState(false);
  
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
  const [viewingNotesSaleId, setViewingNotesSaleId] = useState<string | null>(null);

  // Payment history state
  const [paymentHistoryDialogOpen, setPaymentHistoryDialogOpen] = useState(false);
  const [viewingPaymentHistorySaleId, setViewingPaymentHistorySaleId] = useState<string | null>(null);
  
  const { toast } = useToast();

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

  const { data: unpaidSales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales/unpaid"],
  });

  const { data: saleDetails, isLoading: isLoadingDetails } = useQuery<SaleWithItems>({
    queryKey: [`/api/sales/${selectedSaleId}`],
    enabled: !!selectedSaleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addProductDialogOpen,
  });

  // Fetch payment history for a specific sale
  const { data: paymentHistory = [] } = useQuery<PaymentRecord[]>({
    queryKey: [`/api/sales/${viewingPaymentHistorySaleId}/payments`],
    enabled: !!viewingPaymentHistorySaleId,
  });

  // Fetch balance notes for a specific sale
  const { data: balanceNotes = [] } = useQuery<BalanceNote[]>({
    queryKey: [`/api/sales/${viewingNotesSaleId}/notes`],
    enabled: !!viewingNotesSaleId,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; notes?: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { 
        amount: data.amount,
        notes: data.notes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      if (viewingPaymentHistorySaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${viewingPaymentHistorySaleId}/payments`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
    },
    onError: (error: Error) => {
      console.error("Payment recording error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { saleId: string; note: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/notes`, {
        note: data.note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (viewingNotesSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${viewingNotesSaleId}/notes`] });
      }
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
        title: `Payment amount (Rs. ${Math.round(amount).toLocaleString()}) exceeds outstanding balance (Rs. ${Math.round(selectedCustomer.totalOutstanding).toLocaleString()})`, 
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
          notes: paymentNotes 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      if (viewingPaymentHistorySaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${viewingPaymentHistorySaleId}/payments`] });
      }
      toast({ title: `Payment of Rs. ${Math.round(amount).toLocaleString()} recorded successfully` });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedCustomerPhone(null);
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  const handleAddNote = () => {
    if (!viewingNotesSaleId || !newNote.trim()) {
      toast({ title: "Please enter a note", variant: "destructive" });
      return;
    }

    addNoteMutation.mutate({
      saleId: viewingNotesSaleId,
      note: newNote.trim()
    });
  };

  const getPaymentStatus = (bill: Sale) => {
    const total = parseFloat(bill.totalAmount);
    const paid = parseFloat(bill.amountPaid);
    const outstanding = total - paid;
    
    if (outstanding <= 0) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

  const getDueDateStatus = (dueDate: string | null) => {
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

  const getDueDateBadge = (dueDate: string | null) => {
    const status = getDueDateStatus(dueDate);
    
    switch (status) {
      case "overdue":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>;
      case "due_soon":
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Due Soon
        </Badge>;
      case "future":
        return <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Upcoming
        </Badge>;
      default:
        return <Badge variant="outline">No Due Date</Badge>;
    }
  };

  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    unpaidSales.forEach(sale => {
      const phone = sale.customerPhone;
      const existing = customerMap.get(phone);
      
      const totalAmount = parseFloat(sale.totalAmount);
      const totalPaid = parseFloat(sale.amountPaid);
      const outstanding = totalAmount - totalPaid;
      const billDate = new Date(sale.createdAt);
      const daysOverdue = Math.ceil((new Date().getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
      
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

  const generateDetailedPDFStatement = (customer: ConsolidatedCustomer) => {
    const currentDate = new Date().toLocaleDateString('en-PK');
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Account Statement - ${customer.customerName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; line-height: 1.4; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; font-size: 14px; }
          .customer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { background: #2563eb; color: white; padding: 10px 15px; font-size: 16px; font-weight: bold; margin-bottom: 15px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; font-weight: 600; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
          .amount { text-align: right; font-family: monospace; font-weight: 600; }
          .total-row { background: #fef3c7; font-weight: bold; border-top: 2px solid #2563eb; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
          .badge-danger { background: #fee2e2; color: #991b1b; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-success { background: #d1fae5; color: #065f46; }
          .badge-info { background: #dbeafe; color: #1e40af; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
          .summary-box { display: inline-block; border: 2px solid #e5e7eb; padding: 15px; margin: 10px; border-radius: 8px; min-width: 180px; text-align: center; }
          .summary-box h3 { margin: 0 0 5px 0; font-size: 12px; color: #666; }
          .summary-box p { margin: 0; font-size: 20px; font-weight: bold; color: #2563eb; }
          .notes-section { background: #fffbeb; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .note-item { padding: 8px 0; border-bottom: 1px solid #fef3c7; }
          .note-date { font-size: 10px; color: #666; }
          .payment-history { background: #f0fdf4; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .payment-item { padding: 8px 0; border-bottom: 1px solid #dcfce7; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏪 PaintPulse - Customer Account Statement</h1>
          <p>Generated on ${currentDate}</p>
        </div>
        
        <div class="customer-info">
          <div>
            <strong>Customer Name:</strong> ${customer.customerName}<br>
            <strong>Phone:</strong> ${customer.customerPhone}<br>
            <strong>Total Bills:</strong> ${customer.bills.length}
          </div>
          <div>
            <strong>Statement Period:</strong> ${customer.oldestBillDate.toLocaleDateString()} to ${currentDate}<br>
            <strong>Days Outstanding:</strong> ${customer.daysOverdue} days<br>
            <strong>Status:</strong> ${customer.totalOutstanding > 0 ? 'Pending' : 'Cleared'}
          </div>
        </div>
    `;

    // Summary Section
    pdfHTML += `
      <div class="section">
        <div class="section-title">💰 Account Summary</div>
        <div style="text-align: center;">
          <div class="summary-box">
            <h3>Total Amount</h3>
            <p>Rs. ${customer.totalAmount.toFixed(2)}</p>
          </div>
          <div class="summary-box">
            <h3>Amount Paid</h3>
            <p>Rs. ${customer.totalPaid.toFixed(2)}</p>
          </div>
          <div class="summary-box">
            <h3>Outstanding</h3>
            <p style="color: ${customer.totalOutstanding > 0 ? '#dc2626' : '#2563eb'};">Rs. ${customer.totalOutstanding.toFixed(2)}</p>
          </div>
        </div>
      </div>
    `;

    // Bills Details Section
    pdfHTML += `
      <div class="section">
        <div class="section-title">🧾 Bill Details</div>
        <table>
          <thead>
            <tr>
              <th>Bill Date</th>
              <th>Bill No</th>
              <th>Due Date</th>
              <th class="amount">Total</th>
              <th class="amount">Paid</th>
              <th class="amount">Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    customer.bills.forEach((bill, index) => {
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billDue = billTotal - billPaid;
      const dueDateStatus = getDueDateStatus(bill.dueDate);
      
      let statusBadge = '';
      switch (dueDateStatus) {
        case 'overdue':
          statusBadge = '<span class="badge badge-danger">Overdue</span>';
          break;
        case 'due_soon':
          statusBadge = '<span class="badge badge-warning">Due Soon</span>';
          break;
        case 'future':
          statusBadge = '<span class="badge badge-info">Upcoming</span>';
          break;
        default:
          statusBadge = '<span class="badge">No Due Date</span>';
      }
      
      pdfHTML += `
            <tr>
              <td>${new Date(bill.createdAt).toLocaleDateString()}</td>
              <td>${bill.id.slice(-8)}</td>
              <td>${bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}</td>
              <td class="amount">Rs. ${billTotal.toFixed(2)}</td>
              <td class="amount">Rs. ${billPaid.toFixed(2)}</td>
              <td class="amount">Rs. ${billDue.toFixed(2)}</td>
              <td>${statusBadge}</td>
            </tr>
      `;
    });
    
    pdfHTML += `
            <tr class="total-row">
              <td colspan="3"><strong>Totals</strong></td>
              <td class="amount"><strong>Rs. ${customer.totalAmount.toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${customer.totalPaid.toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${customer.totalOutstanding.toFixed(2)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Payment History Section (if available)
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">💳 Payment History</div>
          <div class="payment-history">
      `;
      
      customer.paymentHistory.forEach(payment => {
        pdfHTML += `
            <div class="payment-item">
              <strong>Rs. ${payment.amount.toFixed(2)}</strong> - 
              ${new Date(payment.paymentDate).toLocaleDateString()} - 
              ${payment.paymentMethod}
              ${payment.notes ? `<br><em>${payment.notes}</em>` : ''}
            </div>
        `;
      });
      
      pdfHTML += `
          </div>
        </div>
      `;
    }

    // Notes Section (if available)
    if (customer.balanceNotes && customer.balanceNotes.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">📝 Account Notes</div>
          <div class="notes-section">
      `;
      
      customer.balanceNotes.forEach(note => {
        pdfHTML += `
            <div class="note-item">
              <div><strong>${new Date(note.createdAt).toLocaleDateString()}:</strong> ${note.note}</div>
              <div class="note-date">By: ${note.createdBy}</div>
            </div>
        `;
      });
      
      pdfHTML += `
          </div>
        </div>
      `;
    }

    pdfHTML += `
        <div class="footer">
          <p>PaintPulse POS System • Customer Account Statement • ${currentDate}</p>
          <p>This is a system-generated report. For any queries, contact support.</p>
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ title: "PDF Statement generated successfully" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Unpaid Bills & Account Statements</h1>
            <p className="text-sm text-muted-foreground">Track pending balances, payment history, and generate statements</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="default" 
              onClick={() => setManualBalanceDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Pending Balance
            </Button>

            <Button 
              variant="outline" 
              onClick={() => generateDetailedPDFStatement(consolidatedCustomers[0])}
              className="flex items-center gap-2"
              disabled={consolidatedCustomers.length === 0}
            >
              <FileText className="h-4 w-4" />
              PDF Statement
            </Button>
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-9"
            />
          </div>

          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Filters</h4>
                  
                  {/* Payment Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm">Payment Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={filters.paymentStatus === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, paymentStatus: "all" }))}
                      >
                        All
                      </Button>
                      <Button
                        variant={filters.paymentStatus === "overdue" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, paymentStatus: "overdue" }))}
                      >
                        Overdue
                      </Button>
                      <Button
                        variant={filters.paymentStatus === "due_soon" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, paymentStatus: "due_soon" }))}
                      >
                        Due Soon
                      </Button>
                      <Button
                        variant={filters.paymentStatus === "no_due_date" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, paymentStatus: "no_due_date" }))}
                      >
                        No Due Date
                      </Button>
                    </div>
                  </div>

                  {/* Amount Range */}
                  <div className="space-y-2">
                    <Label className="text-sm">Amount Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        value={filters.amountRange.min}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          amountRange: { ...prev.amountRange, min: e.target.value }
                        }))}
                        type="number"
                      />
                      <Input
                        placeholder="Max"
                        value={filters.amountRange.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          amountRange: { ...prev.amountRange, max: e.target.value }
                        }))}
                        type="number"
                      />
                    </div>
                  </div>

                  {/* Days Overdue */}
                  <div className="space-y-2">
                    <Label className="text-sm">Minimum Days Overdue</Label>
                    <Input
                      placeholder="e.g., 30"
                      value={filters.daysOverdue}
                      onChange={(e) => setFilters(prev => ({ ...prev, daysOverdue: e.target.value }))}
                      type="number"
                    />
                  </div>

                  {/* Due Date Range */}
                  <div className="space-y-2">
                    <Label className="text-sm">Due Date Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="From"
                        value={filters.dueDate.from}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dueDate: { ...prev.dueDate, from: e.target.value }
                        }))}
                        type="date"
                      />
                      <Input
                        placeholder="To"
                        value={filters.dueDate.to}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dueDate: { ...prev.dueDate, to: e.target.value }
                        }))}
                        type="date"
                      />
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="space-y-2">
                    <Label className="text-sm">Sort By</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={filters.sortBy === "oldest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "oldest" }))}
                      >
                        Oldest First
                      </Button>
                      <Button
                        variant={filters.sortBy === "newest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "newest" }))}
                      >
                        Newest First
                      </Button>
                      <Button
                        variant={filters.sortBy === "highest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "highest" }))}
                      >
                        Highest Amount
                      </Button>
                      <Button
                        variant={filters.sortBy === "lowest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "lowest" }))}
                      >
                        Lowest Amount
                      </Button>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="w-full mt-2"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md flex-wrap">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filters Applied
          </Badge>
          {filters.search && (
            <Badge variant="outline">
              Search: "{filters.search}"
            </Badge>
          )}
          {filters.paymentStatus !== "all" && (
            <Badge variant="outline">
              Status: {filters.paymentStatus.replace('_', ' ')}
            </Badge>
          )}
          {filters.amountRange.min && (
            <Badge variant="outline">
              Min: Rs. {parseFloat(filters.amountRange.min).toLocaleString()}
            </Badge>
          )}
          {filters.amountRange.max && (
            <Badge variant="outline">
              Max: Rs. {parseFloat(filters.amountRange.max).toLocaleString()}
            </Badge>
          )}
          {filters.daysOverdue && (
            <Badge variant="outline">
              {filters.daysOverdue}+ Days Overdue
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto h-6 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedCustomers.length} of {consolidatedCustomers.length} customers
        </p>
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Total Outstanding: Rs. {Math.round(filteredAndSortedCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0)).toLocaleString()}
          </p>
        )}
      </div>

      {/* Customer Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAndSortedCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {hasActiveFilters ? "No customers match your filters" : "No unpaid bills"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "Try adjusting your filters" : "All payments are up to date"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCustomers.map((customer) => {
            const hasOverdue = customer.bills.some(bill => getDueDateStatus(bill.dueDate) === 'overdue');
            const hasDueSoon = customer.bills.some(bill => getDueDateStatus(bill.dueDate) === 'due_soon');
            
            return (
              <Card key={customer.customerPhone} className={`hover-elevate ${hasOverdue ? 'border-destructive/20' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {customer.customerName}
                      {hasOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {hasDueSoon && !hasOverdue && <Clock className="h-4 w-4 text-amber-500" />}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {customer.bills.length > 1 && (
                        <Badge variant="secondary">{customer.bills.length} Bills</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => generateDetailedPDFStatement(customer)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Statement
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedCustomerPhone(customer.customerPhone);
                            setViewingPaymentHistorySaleId(customer.bills[0]?.id);
                            setPaymentHistoryDialogOpen(true);
                          }}>
                            <History className="h-4 w-4 mr-2" />
                            Payment History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedCustomerPhone(customer.customerPhone);
                            setViewingNotesSaleId(customer.bills[0]?.id);
                            setNotesDialogOpen(true);
                          }}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            View Notes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{customer.customerPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{customer.oldestBillDate.toLocaleDateString()}</span>
                      <Badge 
                        variant={customer.daysOverdue > 30 ? "destructive" : "secondary"} 
                        className="ml-auto"
                      >
                        {customer.daysOverdue} days
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span>Rs. {Math.round(customer.totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span>Rs. {Math.round(customer.totalPaid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base text-destructive">
                      <span>Outstanding:</span>
                      <span>Rs. {Math.round(customer.totalOutstanding).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setSelectedCustomerPhone(customer.customerPhone)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => {
                        setSelectedCustomerPhone(customer.customerPhone);
                        setPaymentDialogOpen(true);
                        setPaymentAmount(Math.round(customer.totalOutstanding).toString());
                      }}
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Record Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Customer Bills Details Dialog */}
      <Dialog open={!!selectedCustomerPhone && !paymentDialogOpen} onOpenChange={(open) => !open && setSelectedCustomerPhone(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Bills - {selectedCustomer?.customerName}</DialogTitle>
            <DialogDescription>
              All unpaid bills, payment history, and account notes
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-md text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedCustomer.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Bills</p>
                  <p className="font-medium">{selectedCustomer.bills.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oldest Bill</p>
                  <p className="font-medium">{selectedCustomer.oldestBillDate.toLocaleDateString()}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingPaymentHistorySaleId(selectedCustomer.bills[0]?.id);
                    setPaymentHistoryDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Payment History
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingNotesSaleId(selectedCustomer.bills[0]?.id);
                    setNotesDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  View Notes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDetailedPDFStatement(selectedCustomer)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Generate Statement
                </Button>
              </div>

              {/* Bills List */}
              <div className="space-y-3">
                <h3 className="font-medium">Bills</h3>
                {selectedCustomer.bills.map((bill) => {
                  const billTotal = parseFloat(bill.totalAmount);
                  const billPaid = parseFloat(bill.amountPaid);
                  const billOutstanding = Math.round(billTotal - billPaid);
                  
                  return (
                    <Card key={bill.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {new Date(bill.createdAt).toLocaleDateString()} - {new Date(bill.createdAt).toLocaleTimeString()}
                              </span>
                              {getDueDateBadge(bill.dueDate)}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                              <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span>Rs. {Math.round(billTotal).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Paid: </span>
                                <span>Rs. {Math.round(billPaid).toLocaleString()}</span>
                              </div>
                              {billOutstanding > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Due: </span>
                                  <span className="text-destructive font-semibold">Rs. {billOutstanding.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/bill/${bill.id}`}>
                              <Button variant="outline" size="sm">
                                <Printer className="h-4 w-4 mr-1" />
                                Print
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Consolidated Totals */}
              <div className="p-4 bg-muted rounded-md space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-base text-destructive border-t border-border pt-2">
                  <span>Total Outstanding:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedCustomerPhone(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setPaymentDialogOpen(true);
                    setPaymentAmount(Math.round(selectedCustomer.totalOutstanding).toString());
                  }}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Update payment for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bills:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Outstanding:</span>
                  <span className="font-mono">
                    Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Payment will be applied to oldest bills first
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Add notes about this payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recordPaymentMutation.isPending}
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryDialogOpen} onOpenChange={setPaymentHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              All payment records for this customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {paymentHistory.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Rs. {payment.amount.toFixed(2)}</span>
                            <Badge variant="outline">{payment.paymentMethod}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(payment.paymentDate).toLocaleDateString()} at {new Date(payment.paymentDate).toLocaleTimeString()}
                          </div>
                          {payment.notes && (
                            <div className="text-sm bg-muted p-2 rounded-md mt-2">
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
              <Button variant="outline" onClick={() => setPaymentHistoryDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Balance Notes</DialogTitle>
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
              />
              <Button
                onClick={handleAddNote}
                disabled={addNoteMutation.isPending || !newNote.trim()}
                className="w-full"
              >
                {addNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Button>
            </div>

            {/* Existing Notes */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="font-medium">Previous Notes</h4>
              {balanceNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notes found</p>
                </div>
              ) : (
                balanceNotes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <p className="text-sm">{note.note}</p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>By: {note.createdBy}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Balance Dialog */}
      <Dialog open={manualBalanceDialogOpen} onOpenChange={setManualBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pending Balance</DialogTitle>
            <DialogDescription>
              Add a pending balance for a customer without creating a sale from POS
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer</Label>
              <div className="relative">
                <Input
                  value={manualBalanceForm.customerName}
                  onChange={(e) => setManualBalanceForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="pr-12"
                  placeholder="Type or select customer"
                />
                <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    >
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
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
                              <div className="flex items-center gap-4 text-xs text-muted-foreground w-full pl-6">
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {customer.customerPhone}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(customer.lastSaleDate).toLocaleDateString()}
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Amount</Label>
              <Input
                id="totalAmount"
                type="number"
                placeholder="Enter amount"
                value={manualBalanceForm.totalAmount}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, totalAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={manualBalanceForm.dueDate}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Add notes about this balance"
                value={manualBalanceForm.notes}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
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
              >
                {createManualBalanceMutation.isPending ? "Adding..." : "Add Balance"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}