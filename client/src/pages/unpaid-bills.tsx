// unpaid-bills.tsx - Updated with all fixes
import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

// UI Components
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Dialog components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Table components  
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Other UI components
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Icons
import { 
  CreditCard, Calendar, User, Phone, Plus, Trash2, Eye, Search, 
  Banknote, Printer, Receipt, Filter, X, ChevronDown, FileText, 
  Download, Edit, MoreVertical 
} from "lucide-react";

// Utilities
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, SaleWithItems, ColorWithVariantAndProduct, Payment } from "@shared/schema";

// Types
interface CustomerSuggestion {
  customerName: string;
  customerPhone: string;
  lastSaleDate: string;
  totalSpent: number;
}

interface ManualBalanceForm {
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  dueDate: string;
  notes: string;
}

interface EditPaymentForm {
  amount: string;
  paymentDate: string;
  notes: string;
}

interface DueDateForm {
  dueDate: string;
  notes: string;
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
};

export default function UnpaidBills() {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Manual balance state
  const [manualBalanceDialogOpen, setManualBalanceDialogOpen] = useState(false);
  const [manualBalanceForm, setManualBalanceForm] = useState<ManualBalanceForm>({
    customerName: "",
    customerPhone: "",
    totalAmount: "",
    dueDate: "",
    notes: ""
  });
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  
  // Due date edit state
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [dueDateForm, setDueDateForm] = useState<DueDateForm>({
    dueDate: "",
    notes: ""
  });

  // Payment edit state
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState<EditPaymentForm>({
    amount: "",
    paymentDate: "",
    notes: ""
  });

  // Payment history state
  const [paymentHistoryDialogOpen, setPaymentHistoryDialogOpen] = useState(false);
  const [selectedBillForPayments, setSelectedBillForPayments] = useState<string | null>(null);
  
  // Customer selection state - ADDED MISSING STATE
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Customer suggestions
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
    sortBy: "oldest"
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

  // Get payment history for a bill
  const { data: paymentHistory = [] } = useQuery<Payment[]>({
    queryKey: [`/api/sales/${selectedBillForPayments}/payments`],
    enabled: !!selectedBillForPayments,
  });

  // Get customer's all sales for statement
  const { data: customerSales = [] } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales/customer", selectedCustomerPhone],
    enabled: !!selectedCustomerPhone,
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentDate?: string; notes?: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { 
        amount: data.amount,
        paymentDate: data.paymentDate,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedBillForPayments}/payments`] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
    },
    onError: (error: Error) => {
      console.error("Payment recording error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { paymentId: string; amount: number; paymentDate?: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/payments/${data.paymentId}`, { 
        amount: data.amount,
        paymentDate: data.paymentDate,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedBillForPayments}/payments`] });
      toast({ title: "Payment updated successfully" });
      setEditPaymentDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error: Error) => {
      console.error("Payment update error:", error);
      toast({ title: "Failed to update payment", variant: "destructive" });
    },
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return await apiRequest("DELETE", `/api/payments/${paymentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedBillForPayments}/payments`] });
      toast({ title: "Payment deleted successfully" });
    },
    onError: (error: Error) => {
      console.error("Payment delete error:", error);
      toast({ title: "Failed to delete payment", variant: "destructive" });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: { saleId: string; colorId: string; quantity: number; rate: number; subtotal: number }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/items`, {
        colorId: data.colorId,
        quantity: data.quantity,
        rate: data.rate,
        subtotal: data.subtotal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product added to bill" });
      setAddProductDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    },
    onError: (error: Error) => {
      console.error("Add product error:", error);
      toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (saleItemId: string) => {
      return await apiRequest("DELETE", `/api/sale-items/${saleItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product removed from bill" });
    },
    onError: (error: Error) => {
      console.error("Delete item error:", error);
      toast({ title: "Failed to remove product", variant: "destructive" });
    },
  });

  // Create manual balance mutation
  const createManualBalanceMutation = useMutation({
    mutationFn: async (data: ManualBalanceForm) => {
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

  // Update manual balance mutation
  const updateManualBalanceMutation = useMutation({
    mutationFn: async (data: { saleId: string } & ManualBalanceForm) => {
      return await apiRequest("PATCH", `/api/sales/${data.saleId}`, {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        totalAmount: data.totalAmount,
        dueDate: data.dueDate,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ 
        title: "Balance updated successfully",
        description: "Pending balance has been updated"
      });
      setManualBalanceDialogOpen(false);
      setEditingBalanceId(null);
      setManualBalanceForm({
        customerName: "",
        customerPhone: "",
        totalAmount: "",
        dueDate: "",
        notes: ""
      });
    },
    onError: (error: Error) => {
      console.error("Update manual balance error:", error);
      toast({ title: "Failed to update balance", variant: "destructive" });
    },
  });

  // Delete manual balance mutation
  const deleteManualBalanceMutation = useMutation({
    mutationFn: async (saleId: string) => {
      return await apiRequest("DELETE", `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Balance deleted successfully" });
    },
    onError: (error: Error) => {
      console.error("Delete manual balance error:", error);
      toast({ title: "Failed to delete balance", variant: "destructive" });
    },
  });

  // Update due date mutation
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

  // Get selected customer
  const selectedCustomer = useMemo(() => {
    return consolidatedCustomers.find(c => c.customerPhone === selectedCustomerPhone);
  }, [consolidatedCustomers, selectedCustomerPhone]);

  // Edit manual balance
  const handleEditBalance = (sale: Sale) => {
    setEditingBalanceId(sale.id);
    setManualBalanceForm({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      totalAmount: sale.totalAmount,
      dueDate: sale.dueDate || "",
      notes: sale.notes || ""
    });
    setManualBalanceDialogOpen(true);
  };

  // Edit payment
  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setEditPaymentForm({
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      notes: payment.notes || ""
    });
    setEditPaymentDialogOpen(true);
  };

  // View payment history
  const handleViewPaymentHistory = (billId: string) => {
    setSelectedBillForPayments(billId);
    setPaymentHistoryDialogOpen(true);
  };

  // Handle record payment
  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      toast({ title: "Please enter payment amount", variant: "destructive" });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid payment amount", variant: "destructive" });
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

    // Validate that we have payments to apply
    if (paymentsToApply.length === 0) {
      toast({ title: "No outstanding balance to apply payment to", variant: "destructive" });
      return;
    }

    // Apply all payments using the mutation
    try {
      for (const payment of paymentsToApply) {
        await recordPaymentMutation.mutateAsync({
          saleId: payment.saleId,
          amount: payment.amount
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: `Payment of Rs. ${Math.round(amount).toLocaleString()} recorded successfully` });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedCustomerPhone(null);
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  // Handle update payment
  const handleUpdatePayment = async () => {
    if (!editingPayment || !editPaymentForm.amount) {
      toast({ title: "Please enter payment amount", variant: "destructive" });
      return;
    }

    const amount = parseFloat(editPaymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Payment amount must be positive", variant: "destructive" });
      return;
    }

    updatePaymentMutation.mutate({
      paymentId: editingPayment.id,
      amount: amount,
      paymentDate: editPaymentForm.paymentDate,
      notes: editPaymentForm.notes
    });
  };

  // Handle add product
  const handleAddProduct = () => {
    if (!selectedColor || !selectedSaleId) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Quantity must be positive", variant: "destructive" });
      return;
    }

    if (qty > selectedColor.stockQuantity) {
      toast({ title: "Not enough stock available", variant: "destructive" });
      return;
    }

    const rate = parseFloat(selectedColor.variant.rate);
    const subtotal = rate * qty;

    addItemMutation.mutate({
      saleId: selectedSaleId,
      colorId: selectedColor.id,
      quantity: qty,
      rate,
      subtotal,
    });
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">Paid</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "unpaid":
        return <Badge variant="outline">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get days overdue
  const getDaysOverdue = (createdAt: string | Date) => {
    const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter colors based on search
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;

    const query = searchQuery.toLowerCase();
    
    return colors
      .map((color) => {
        let score = 0;
        
        // Exact color code match (highest priority)
        if (color.colorCode.toLowerCase() === query) {
          score += 1000;
        } else if (color.colorCode.toLowerCase().startsWith(query)) {
          score += 500;
        } else if (color.colorCode.toLowerCase().includes(query)) {
          score += 100;
        }
        
        // Color name matching
        if (color.colorName.toLowerCase() === query) {
          score += 200;
        } else if (color.colorName.toLowerCase().includes(query)) {
          score += 50;
        }
        
        // Company and product matching
        if (color.variant.product.company.toLowerCase().includes(query)) {
          score += 30;
        }
        if (color.variant.product.productName.toLowerCase().includes(query)) {
          score += 30;
        }
        
        // Packing size matching
        if (color.variant.packingSize.toLowerCase().includes(query)) {
          score += 20;
        }
        
        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colors, searchQuery]);

  // Current sale
  const currentSale = unpaidSales.find(s => s.id === selectedSaleId);

  // Consolidated customers
  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    unpaidSales.forEach(sale => {
      const phone = sale.customerPhone;
      const existing = customerMap.get(phone);
      
      const totalAmount = parseFloat(sale.totalAmount);
      const totalPaid = parseFloat(sale.amountPaid);
      const outstanding = totalAmount - totalPaid;
      const billDate = new Date(sale.createdAt);
      const daysOverdue = getDaysOverdue(billDate);
      
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
        });
      }
    });
    
    return Array.from(customerMap.values());
  }, [unpaidSales]);

  // Filtered and sorted customers
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

    // Apply due date filter
    if (filters.dueDate.from || filters.dueDate.to) {
      const fromDate = filters.dueDate.from ? new Date(filters.dueDate.from) : null;
      const toDate = filters.dueDate.to ? new Date(filters.dueDate.to) : null;
      
      filtered = filtered.filter(customer => {
        // Check if any bill has a due date in the range
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

  // Check for active filters
  const hasActiveFilters = filters.search || filters.amountRange.min || filters.amountRange.max || filters.daysOverdue || filters.dueDate.from || filters.dueDate.to;

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: "",
      amountRange: { min: "", max: "" },
      daysOverdue: "",
      dueDate: { from: "", to: "" },
      sortBy: "oldest"
    });
  };

  // Select customer from suggestions
  const selectCustomer = (customer: CustomerSuggestion) => {
    setManualBalanceForm(prev => ({
      ...prev,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone
    }));
    setCustomerSuggestionsOpen(false);
  };

  // Generate PDF statement for individual customer
  const generateCustomerPDFStatement = (customer: ConsolidatedCustomer) => {
    const currentDate = new Date().toLocaleDateString('en-PK');
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Account Statement - ${customer.customerName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; font-size: 14px; }
          .customer-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .customer-info h3 { margin: 0 0 10px 0; color: #2563eb; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .section { margin-bottom: 25px; page-break-inside: avoid; }
          .section-title { background: #2563eb; color: white; padding: 8px 12px; font-size: 14px; font-weight: bold; margin-bottom: 12px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
          th { background: #e2e8f0; text-align: left; padding: 8px; border: 1px solid #cbd5e0; font-weight: 600; }
          td { padding: 8px; border: 1px solid #e2e8f0; }
          .amount { text-align: right; font-family: monospace; }
          .total-row { background: #fef3c7; font-weight: bold; }
          .summary-box { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 18px; font-weight: bold; color: #2563eb; }
          .summary-label { font-size: 12px; color: #64748b; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-danger { color: #dc2626; }
          .text-success { color: #16a34a; }
          .status-paid { background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          .status-unpaid { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          .status-partial { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          .notes-section { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin: 10px 0; }
          .notes-title { font-weight: bold; color: #92400e; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Customer Account Statement</h1>
          <p>Generated on ${currentDate}</p>
        </div>

        <div class="customer-info">
          <h3>Customer Information</h3>
          <div class="info-grid">
            <div><strong>Name:</strong> ${customer.customerName}</div>
            <div><strong>Phone:</strong> ${customer.customerPhone}</div>
            <div><strong>Total Bills:</strong> ${customer.bills.length}</div>
            <div><strong>Oldest Bill:</strong> ${customer.oldestBillDate.toLocaleDateString('en-PK')}</div>
          </div>
        </div>

        <!-- Account Summary -->
        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">Rs. ${Math.round(customer.totalAmount).toLocaleString()}</div>
              <div class="summary-label">Total Amount</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">Rs. ${Math.round(customer.totalPaid).toLocaleString()}</div>
              <div class="summary-label">Total Paid</div>
            </div>
            <div class="summary-item">
              <div class="summary-value ${customer.totalOutstanding > 0 ? 'text-danger' : 'text-success'}">
                Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}
              </div>
              <div class="summary-label">Outstanding Balance</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${customer.daysOverdue}</div>
              <div class="summary-label">Days Overdue</div>
            </div>
          </div>
        </div>
    `;

    // Bills History Section
    pdfHTML += `
      <div class="section">
        <div class="section-title">Bills History (${customer.bills.length} Bills)</div>
        <table>
          <thead>
            <tr>
              <th>Bill Date</th>
              <th>Bill ID</th>
              <th class="amount">Total Amount</th>
              <th class="amount">Amount Paid</th>
              <th class="amount">Outstanding</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
    `;

    customer.bills.forEach(bill => {
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      const statusClass = bill.paymentStatus === 'paid' ? 'status-paid' : 
                         bill.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid';
      
      pdfHTML += `
        <tr>
          <td>${new Date(bill.createdAt).toLocaleDateString('en-PK')}</td>
          <td>${bill.id.slice(0, 8).toUpperCase()}</td>
          <td class="amount">Rs. ${Math.round(billTotal).toLocaleString()}</td>
          <td class="amount">Rs. ${Math.round(billPaid).toLocaleString()}</td>
          <td class="amount ${billOutstanding > 0 ? 'text-danger' : 'text-success'}">
            Rs. ${Math.round(billOutstanding).toLocaleString()}
          </td>
          <td><span class="${statusClass}">${bill.paymentStatus.toUpperCase()}</span></td>
          <td>${bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('en-PK') : '-'}</td>
        </tr>
      `;
    });

    pdfHTML += `
        </tbody>
      </table>
    </div>
    `;

    // Notes & Comments Section
    const billsWithNotes = customer.bills.filter(bill => bill.notes && bill.notes.trim() !== '');
    if (billsWithNotes.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">📝 Customer Notes & Comments</div>
          <table>
            <thead>
              <tr>
                <th>Bill Date</th>
                <th>Bill ID</th>
                <th>Notes & Comments</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      billsWithNotes.forEach(bill => {
        pdfHTML += `
          <tr>
            <td>${new Date(bill.createdAt).toLocaleDateString('en-PK')}</td>
            <td>${bill.id.slice(0, 8).toUpperCase()}</td>
            <td>${bill.notes}</td>
          </tr>
        `;
      });
      
      pdfHTML += `
            </tbody>
          </table>
        </div>
      `;
    }

    // Payment History Section
    pdfHTML += `
      <div class="section">
        <div class="section-title">Payment History</div>
        <table>
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Bill ID</th>
              <th class="amount">Amount Paid</th>
              <th>Payment Method</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="5" class="text-center">Payment history data would be displayed here</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Aging Analysis
    const agingAnalysis = {
      current: 0,
      overdue30: 0,
      overdue60: 0,
      overdue90: 0
    };

    customer.bills.forEach(bill => {
      if (bill.paymentStatus !== 'paid') {
        const billDate = new Date(bill.createdAt);
        const today = new Date();
        const diffTime = today.getTime() - billDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 30) agingAnalysis.current += parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
        else if (diffDays <= 60) agingAnalysis.overdue30 += parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
        else if (diffDays <= 90) agingAnalysis.overdue60 += parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
        else agingAnalysis.overdue90 += parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
      }
    });

    pdfHTML += `
      <div class="section">
        <div class="section-title">Aging Analysis</div>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th class="amount">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Current (0-30 days)</td>
              <td class="amount">Rs. ${Math.round(agingAnalysis.current).toLocaleString()}</td>
              <td><span class="status-paid">Current</span></td>
            </tr>
            <tr>
              <td>31-60 Days Overdue</td>
              <td class="amount">Rs. ${Math.round(agingAnalysis.overdue30).toLocaleString()}</td>
              <td><span class="status-partial">Attention Needed</span></td>
            </tr>
            <tr>
              <td>61-90 Days Overdue</td>
              <td class="amount">Rs. ${Math.round(agingAnalysis.overdue60).toLocaleString()}</td>
              <td><span class="status-unpaid">Overdue</span></td>
            </tr>
            <tr>
              <td>90+ Days Overdue</td>
              <td class="amount">Rs. ${Math.round(agingAnalysis.overdue90).toLocaleString()}</td>
              <td><span class="status-unpaid">Critical</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>PaintPulse POS System • Customer Account Statement</p>
        <p>Generated on ${currentDate} • This is a system-generated document</p>
      </div>

      <script>
        // PDF opens for viewing without auto-print
        console.log('Customer account statement ready for viewing');
      </script>
      </body>
      </html>
    `;

    // Create blob and open in new window WITHOUT auto-print
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.focus();
    }
    
    toast({ 
      title: "Customer Statement Generated",
      description: `Account statement for ${customer.customerName} is ready for viewing`
    });
  };

  // Generate PDF statement for all unpaid bills
  const generatePDFStatement = () => {
    const currentDate = new Date().toLocaleDateString('en-PK');
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Unpaid Bills Statement</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #2563eb; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; font-size: 14px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { background: #2563eb; color: white; padding: 10px 15px; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #eee; }
          tr:hover { background: #f9fafb; }
          .amount { text-align: right; font-family: monospace; font-weight: 600; }
          .total-row { background: #fef3c7; font-weight: bold; border-top: 2px solid #2563eb; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
          .badge-danger { background: #fee2e2; color: #991b1b; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-success { background: #d1fae5; color: #065f46; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
          .summary-box { display: inline-block; border: 2px solid #e5e7eb; padding: 15px; margin: 10px; border-radius: 8px; min-width: 180px; }
          .summary-box h3 { margin: 0 0 5px 0; font-size: 12px; color: #666; }
          .summary-box p { margin: 0; font-size: 20px; font-weight: bold; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 PaintPulse Unpaid Bills Statement</h1>
          <p>Generated on ${currentDate}</p>
        </div>
    `;

    // Section 1: Upcoming Dues (bills with due dates that are approaching or overdue)
    const upcomingDues = filteredAndSortedCustomers.filter(customer => 
      customer.bills.some(bill => bill.dueDate)
    );

    if (upcomingDues.length > 0) {
      const totalUpcomingAmount = upcomingDues.reduce((sum, c) => sum + c.totalOutstanding, 0);
      
      pdfHTML += `
        <div class="section">
          <div class="section-title">🔔 Upcoming & Overdue Payments (${upcomingDues.length} Customers)</div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Due Date</th>
                <th class="amount">Outstanding</th>
                <th>Days Until/Overdue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      upcomingDues.forEach(customer => {
        const bill = customer.bills.find(b => b.dueDate) || customer.bills[0];
        
        // Calculate days based on due date, not creation date
        let daysValue = '';
        let statusClass = 'badge-success';
        let status = 'Upcoming';
        
        if (bill.dueDate) {
          const dueDate = new Date(bill.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            // Overdue
            const overdueDays = Math.abs(diffDays);
            daysValue = `${overdueDays} days overdue`;
            statusClass = overdueDays > 30 ? 'badge-danger' : 'badge-warning';
            status = overdueDays > 30 ? 'Critical' : 'Overdue';
          } else if (diffDays === 0) {
            daysValue = 'Due today';
            statusClass = 'badge-warning';
            status = 'Due Today';
          } else {
            daysValue = `${diffDays} days remaining`;
            statusClass = 'badge-success';
            status = 'Upcoming';
          }
        }
        
        pdfHTML += `
              <tr>
                <td>${customer.customerName}</td>
                <td>${customer.customerPhone}</td>
                <td>${bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('en-PK') : '-'}</td>
                <td class="amount">Rs. ${customer.totalOutstanding.toFixed(2)}</td>
                <td>${daysValue}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
              </tr>
        `;
      });
      
      pdfHTML += `
              <tr class="total-row">
                <td colspan="3"><strong>Subtotal</strong></td>
                <td class="amount"><strong>Rs. ${totalUpcomingAmount.toFixed(2)}</strong></td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Section 2: All Unpaid Bills
    const allUnpaid = filteredAndSortedCustomers;
    const totalUnpaidAmount = allUnpaid.reduce((sum, c) => sum + c.totalOutstanding, 0);
    
    pdfHTML += `
      <div class="section">
        <div class="section-title">💰 All Unpaid Bills (${allUnpaid.length} Customers)</div>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th class="amount">Total</th>
              <th class="amount">Paid</th>
              <th class="amount">Outstanding</th>
              <th>Bills</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    allUnpaid.forEach(customer => {
      pdfHTML += `
            <tr>
              <td>${customer.customerName}</td>
              <td>${customer.customerPhone}</td>
              <td class="amount">Rs. ${customer.totalAmount.toFixed(2)}</td>
              <td class="amount">Rs. ${customer.totalPaid.toFixed(2)}</td>
              <td class="amount">Rs. ${customer.totalOutstanding.toFixed(2)}</td>
              <td>${customer.bills.length}</td>
            </tr>
      `;
    });
    
    pdfHTML += `
            <tr class="total-row">
              <td colspan="2"><strong>Grand Total</strong></td>
              <td class="amount"><strong>Rs. ${allUnpaid.reduce((sum, c) => sum + c.totalAmount, 0).toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${allUnpaid.reduce((sum, c) => sum + c.totalPaid, 0).toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${totalUnpaidAmount.toFixed(2)}</strong></td>
              <td><strong>${allUnpaid.reduce((sum, c) => sum + c.bills.length, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Summary boxes
    pdfHTML += `
      <div class="section" style="text-align: center;">
        <div class="summary-box">
          <h3>Total Customers</h3>
          <p>${allUnpaid.length}</p>
        </div>
        <div class="summary-box">
          <h3>Total Outstanding</h3>
          <p>Rs. ${totalUnpaidAmount.toFixed(2)}</p>
        </div>
        <div class="summary-box">
          <h3>With Due Dates</h3>
          <p>${upcomingDues.length}</p>
        </div>
      </div>
    `;

    pdfHTML += `
        <div class="footer">
          <p>PaintPulse POS System • Statement generated on ${currentDate}</p>
          <p>This is a system-generated report</p>
        </div>

        <script>
          // PDF opens for viewing without auto-print
          console.log('Unpaid bills statement ready for viewing');
        </script>
      </body>
      </html>
    `;

    // Create blob and open in new window WITHOUT auto-print
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
    
    toast({ title: "PDF Statement opened for viewing" });
  };

  // Memoized totals for performance
  const totalOutstanding = useMemo(() => {
    return filteredAndSortedCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
  }, [filteredAndSortedCustomers]);

  const customerCount = useMemo(() => {
    return filteredAndSortedCustomers.length;
  }, [filteredAndSortedCustomers]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Title */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-unpaid-bills-title">
              Unpaid Bills
            </h1>
            <p className="text-sm text-muted-foreground">Track and manage outstanding payments</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="default" 
              onClick={() => {
                setEditingBalanceId(null);
                setManualBalanceForm({
                  customerName: "",
                  customerPhone: "",
                  totalAmount: "",
                  dueDate: "",
                  notes: ""
                });
                setManualBalanceDialogOpen(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Pending Balance
            </Button>

            <Button 
              variant="outline" 
              onClick={generatePDFStatement}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF Statement
            </Button>
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-9"
            />
          </div>

          {/* Filter Dropdown */}
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

                  {/* Clear Filters */}
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
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filters Applied
          </Badge>
          {filters.search && (
            <Badge variant="outline">
              Search: "{filters.search}"
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
          Showing {customerCount} of {consolidatedCustomers.length} customers
        </p>
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Total Outstanding: Rs. {Math.round(totalOutstanding).toLocaleString()}
          </p>
        )}
      </div>

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
            // Find if any bill has notes
            const billWithNotes = customer.bills.find(bill => bill.notes);
            
            return (
              <Card key={customer.customerPhone} className="hover-elevate" data-testid={`unpaid-bill-customer-${customer.customerPhone}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{customer.customerName}</CardTitle>
                    {customer.bills.length > 1 && (
                      <Badge variant="secondary">{customer.bills.length} Bills</Badge>
                    )}
                  </div>
                  {/* Show notes if available */}
                  {billWithNotes?.notes && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs text-yellow-800 font-medium">Note: {billWithNotes.notes}</p>
                    </div>
                  )}
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
                        {customer.daysOverdue} days ago
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
                      <span data-testid={`text-outstanding-${customer.customerPhone}`}>
                        Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setSelectedCustomerPhone(customer.customerPhone)}
                      data-testid={`button-view-details-${customer.customerPhone}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => generateCustomerPDFStatement(customer)}
                        data-testid={`button-pdf-statement-${customer.customerPhone}`}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => {
                          setSelectedCustomerPhone(customer.customerPhone);
                          setPaymentDialogOpen(true);
                          setPaymentAmount(Math.round(customer.totalOutstanding).toString());
                        }}
                        data-testid={`button-record-payment-${customer.customerPhone}`}
                      >
                        <Banknote className="h-4 w-4 mr-1" />
                        Payment
                      </Button>
                    </div>
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
            <DialogTitle>Customer Bills</DialogTitle>
            <DialogDescription>
              All unpaid bills for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md text-sm">
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

              {/* Bills List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Bills</h3>
                  <Button
                    variant="outline"
                    onClick={() => generateCustomerPDFStatement(selectedCustomer)}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Download Statement
                  </Button>
                </div>
                {selectedCustomer.bills.map((bill) => {
                  const billTotal = parseFloat(bill.totalAmount);
                  const billPaid = parseFloat(bill.amountPaid);
                  const billOutstanding = Math.round(billTotal - billPaid);
                  
                  return (
                    <Card key={bill.id} data-testid={`bill-card-${bill.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {new Date(bill.createdAt).toLocaleDateString()} - {new Date(bill.createdAt).toLocaleTimeString()}
                              </span>
                              {getPaymentStatusBadge(bill.paymentStatus)}
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
                            {/* Show notes for each bill */}
                            {bill.notes && (
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-xs text-blue-800">
                                  <span className="font-medium">Note:</span> {bill.notes}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditBalance(bill)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Balance
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewPaymentHistory(bill.id)}>
                                  <Banknote className="h-4 w-4 mr-2" />
                                  View Payments
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <Link href={`/bill/${bill.id}`}>
                                  <DropdownMenuItem>
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print Bill
                                  </DropdownMenuItem>
                                </Link>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                  data-testid="button-record-payment-dialog"
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
                  data-testid="input-payment-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Payment will be applied to oldest bills first
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recordPaymentMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update payment details
            </DialogDescription>
          </DialogHeader>
          {editingPayment && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editPaymentAmount">Payment Amount</Label>
                <Input
                  id="editPaymentAmount"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={editPaymentForm.amount}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPaymentDate">Payment Date</Label>
                <Input
                  id="editPaymentDate"
                  type="date"
                  value={editPaymentForm.paymentDate}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPaymentNotes">Notes (Optional)</Label>
                <Input
                  id="editPaymentNotes"
                  placeholder="Add payment notes"
                  value={editPaymentForm.notes}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdatePayment}
                  disabled={updatePaymentMutation.isPending}
                >
                  {updatePaymentMutation.isPending ? "Updating..." : "Update Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryDialogOpen} onOpenChange={setPaymentHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              View and manage payment history for this bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment history found for this bill
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono">
                        Rs. {Math.round(parseFloat(payment.amount))}
                      </TableCell>
                      <TableCell>
                        {payment.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this payment?")) {
                                deletePaymentMutation.mutate(payment.id);
                              }
                            }}
                            disabled={deletePaymentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Balance Dialog */}
      <Dialog open={manualBalanceDialogOpen} onOpenChange={setManualBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBalanceId ? "Edit Pending Balance" : "Add Pending Balance"}
            </DialogTitle>
            <DialogDescription>
              {editingBalanceId ? "Update pending balance details" : "Add a pending balance for a customer without creating a sale from POS"}
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
                              onSelect={() => selectCustomer(customer)}
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
              {editingBalanceId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this balance?")) {
                      deleteManualBalanceMutation.mutate(editingBalanceId);
                      setManualBalanceDialogOpen(false);
                    }
                  }}
                  disabled={deleteManualBalanceMutation.isPending}
                >
                  {deleteManualBalanceMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setManualBalanceDialogOpen(false);
                  setEditingBalanceId(null);
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
                  
                  if (editingBalanceId) {
                    updateManualBalanceMutation.mutate({
                      saleId: editingBalanceId,
                      ...manualBalanceForm
                    });
                  } else {
                    createManualBalanceMutation.mutate(manualBalanceForm);
                  }
                }}
                disabled={createManualBalanceMutation.isPending || updateManualBalanceMutation.isPending}
              >
                {editingBalanceId 
                  ? (updateManualBalanceMutation.isPending ? "Updating..." : "Update Balance")
                  : (createManualBalanceMutation.isPending ? "Adding..." : "Add Balance")
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Due Date Edit Dialog */}
      <Dialog open={dueDateDialogOpen} onOpenChange={setDueDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Due Date</DialogTitle>
            <DialogDescription>
              Set or update the payment due date for this bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDueDate">Due Date</Label>
              <Input
                id="editDueDate"
                type="date"
                value={dueDateForm.dueDate}
                onChange={(e) => setDueDateForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes (Optional)</Label>
              <Input
                id="editNotes"
                placeholder="Add notes about the due date"
                value={dueDateForm.notes}
                onChange={(e) => setDueDateForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDueDateDialogOpen(false);
                  setEditingSaleId(null);
                  setDueDateForm({ dueDate: "", notes: "" });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editingSaleId) return;
                  updateDueDateMutation.mutate({
                    saleId: editingSaleId,
                    dueDate: dueDateForm.dueDate || undefined,
                    notes: dueDateForm.notes || undefined
                  });
                }}
                disabled={updateDueDateMutation.isPending}
              >
                {updateDueDateMutation.isPending ? "Updating..." : "Update Due Date"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product to Bill</DialogTitle>
            <DialogDescription>
              Search and select a product to add to the bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by color code, name, company, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-colors"
                className="pl-9"
              />
            </div>

            {/* Color Selection */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredColors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No colors found matching your search" : "Start typing to search for colors"}
                </p>
              ) : (
                filteredColors.slice(0, 20).map((color) => (
                  <Card
                    key={color.id}
                    className={`hover-elevate cursor-pointer ${selectedColor?.id === color.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedColor(color)}
                    data-testid={`color-option-${color.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{color.variant.product.company}</Badge>
                            <span className="font-medium">{color.variant.product.productName}</span>
                            <Badge variant="outline">{color.variant.packingSize}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{color.colorName}</span>
                            <Badge variant="secondary">{color.colorCode}</Badge>
                            <Badge variant={color.stockQuantity > 0 ? "default" : "destructive"}>
                              Stock: {color.stockQuantity}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">Rs. {Math.round(parseFloat(color.variant.rate))}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Quantity */}
            {selectedColor && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedColor.stockQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
                <p className="text-xs text-muted-foreground">
                  Available stock: {selectedColor.stockQuantity} units
                </p>
                {selectedColor && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex justify-between font-mono">
                      <span>Subtotal:</span>
                      <span>Rs. {Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0"))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAddProductDialogOpen(false);
                  setSelectedColor(null);
                  setQuantity("1");
                  setSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={!selectedColor || addItemMutation.isPending}
                data-testid="button-confirm-add-product"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}