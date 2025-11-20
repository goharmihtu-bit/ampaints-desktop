// unpaid-bills.tsx - Clean PDF with proper WhatsApp sharing
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  User,
  Phone,
  Plus,
  Eye,
  Search,
  Banknote,
  FileText,
  Download,
  Share2,
  CheckCircle2,
  Calendar,
  Package,
  DollarSign,
  Clock,
  FileDigit,
  MoreHorizontal,
  ChevronDown,
  Filter,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, ColorWithVariantAndProduct, PaymentHistoryWithSale } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

// Interfaces
interface ConsolidatedCustomer {
  customerPhone: string;
  customerName: string;
  bills: SaleWithItems[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  oldestBillDate: Date;
  daysOverdue: number;
}

interface SaleItem {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color: {
    id: string;
    colorName: string;
    colorCode: string;
    variant: {
      id: string;
      variantName: string;
      packingSize: string;
      rate: string;
      product: {
        id: string;
        productName: string;
        company: string;
      };
    };
  };
}

interface SaleWithItems extends Sale {
  saleItems?: SaleItem[];
  paymentHistory?: PaymentHistoryWithSale[];
}

// Helper functions
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-PK', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const getDaysOverdue = (createdAt: string | Date) => {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    case "partial":
      return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
    case "unpaid":
      return <Badge className="bg-red-100 text-red-800">Unpaid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Format phone number for WhatsApp
const formatPhoneForWhatsApp = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If number starts with 0, replace with 92
  if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  }
  
  // If number doesn't start with country code, add 92
  if (!cleaned.startsWith('92')) {
    cleaned = '92' + cleaned;
  }
  
  return '+' + cleaned;
};

// Get receipt settings from localStorage
const getReceiptSettings = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedReceiptSettings = localStorage.getItem('posReceiptSettings');
    if (savedReceiptSettings) {
      return JSON.parse(savedReceiptSettings);
    }
  } catch (error) {
    console.error("Error loading receipt settings:", error);
  }
  
  return {
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS",
    fontSize: "11",
    itemFontSize: "12",
    padding: "12"
  };
};

// Bill Item Component
const BillItem = ({ item }: { item: SaleItem }) => {
  return (
    <div className="flex justify-between items-start py-2 border-b last:border-b-0">
      <div className="flex-1">
        <div className="font-medium text-sm">
          {item.color.variant.product.productName} - {item.color.colorName} {item.color.colorCode}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.color.variant.packingSize} • {item.color.variant.product.company}
        </div>
      </div>
      <div className="text-right text-sm">
        <div>Qty: {item.quantity}</div>
        <div>Rate: Rs. {Math.round(parseFloat(item.rate)).toLocaleString()}</div>
        <div className="font-semibold">Rs. {Math.round(parseFloat(item.subtotal)).toLocaleString()}</div>
      </div>
    </div>
  );
};

// Payment History Item Component
const PaymentHistoryItem = ({ payment }: { payment: PaymentHistoryWithSale }) => {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {formatDate(payment.createdAt)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {payment.paymentMethod}
          </Badge>
        </div>
        {payment.notes && (
          <div className="text-xs text-muted-foreground">Note: {payment.notes}</div>
        )}
      </div>
      <div className="text-right">
        <div className="font-semibold text-green-600">
          +Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          Balance: Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// Individual Bill Component
const IndividualBill = ({ bill, onViewBill }: { bill: SaleWithItems, onViewBill: (bill: SaleWithItems) => void }) => {
  const totalAmount = parseFloat(bill.totalAmount);
  const amountPaid = parseFloat(bill.amountPaid);
  const outstanding = totalAmount - amountPaid;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileDigit className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Bill #{bill.id.slice(-6)}</span>
              {getPaymentStatusBadge(bill.paymentStatus)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(bill.createdAt)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onViewBill(bill)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        {/* Items Summary */}
        {bill.saleItems && bill.saleItems.length > 0 && (
          <div className="mb-3">
            <div className="text-sm font-medium mb-2">Items:</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {bill.saleItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="truncate flex-1">
                    {item.color.variant.product.productName} - {item.color.colorName}
                  </span>
                  <span className="ml-2 font-mono">
                    {item.quantity} × Rs.{Math.round(parseFloat(item.rate))}
                  </span>
                </div>
              ))}
              {bill.saleItems.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{bill.saleItems.length - 3} more items
                </div>
              )}
            </div>
          </div>
        )}

        {/* Amount Summary */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-semibold">Rs. {Math.round(totalAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid:</span>
            <span className="text-green-600">Rs. {Math.round(amountPaid).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span>Due:</span>
            <span className="font-semibold text-red-600">
              Rs. {Math.round(outstanding).toLocaleString()}
            </span>
          </div>
        </div>

        {bill.notes && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
            <strong>Note:</strong> {bill.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function UnpaidBills() {
  const [selectedCustomer, setSelectedCustomer] = useState<ConsolidatedCustomer | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [billDetailsOpen, setBillDetailsOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<SaleWithItems | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Payment state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedBillsForPayment, setSelectedBillsForPayment] = useState<{ [key: string]: string }>({});

  const { toast } = useToast();

  // Queries
  const { data: unpaidSales = [], isLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales/unpaid"],
  });

  const { data: customerPaymentHistory = [] } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: [`/api/payment-history/customer/${selectedCustomer?.customerPhone}`],
    enabled: !!selectedCustomer?.customerPhone,
  });

  const { data: billDetails } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", selectedBill?.id],
    enabled: !!selectedBill?.id && billDetailsOpen,
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod?: string; notes?: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { 
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/payment-history/customer/${selectedCustomer?.customerPhone}`] });
      toast({ title: "Payment recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  // Memoized computations
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

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return consolidatedCustomers;
    
    const searchLower = searchTerm.toLowerCase();
    return consolidatedCustomers.filter(customer => 
      customer.customerName.toLowerCase().includes(searchLower) ||
      customer.customerPhone.includes(searchTerm)
    );
  }, [consolidatedCustomers, searchTerm]);

  // Payment handlers
  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;

    // Calculate total from individual bill payments
    const totalPayment = Object.values(selectedBillsForPayment).reduce((sum, amount) => {
      return sum + (parseFloat(amount) || 0);
    }, 0);

    if (totalPayment <= 0) {
      toast({ title: "Please enter payment amounts", variant: "destructive" });
      return;
    }

    if (totalPayment > selectedCustomer.totalOutstanding) {
      toast({ title: "Payment amount exceeds outstanding balance", variant: "destructive" });
      return;
    }

    try {
      // Process payments for each selected bill
      for (const [billId, amount] of Object.entries(selectedBillsForPayment)) {
        const paymentAmount = parseFloat(amount);
        if (paymentAmount > 0) {
          await recordPaymentMutation.mutateAsync({
            saleId: billId,
            amount: paymentAmount,
            paymentMethod,
            notes: paymentNotes
          });
        }
      }

      toast({ 
        title: "Payments recorded successfully",
        description: `Total: Rs. ${Math.round(totalPayment).toLocaleString()}`
      });
      
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedBillsForPayment({});
    } catch (error) {
      toast({ title: "Failed to record payments", variant: "destructive" });
    }
  };

  const handleBillPaymentChange = (billId: string, amount: string) => {
    setSelectedBillsForPayment(prev => ({
      ...prev,
      [billId]: amount
    }));
  };

  // View handlers
  const handleViewCustomerDetails = (customer: ConsolidatedCustomer) => {
    setSelectedCustomer(customer);
    setCustomerDetailsOpen(true);
  };

  const handleViewBillDetails = (bill: SaleWithItems) => {
    setSelectedBill(bill);
    setBillDetailsOpen(true);
  };

  const handleRecordPaymentClick = (customer: ConsolidatedCustomer) => {
    setSelectedCustomer(customer);
    // Initialize payment amounts with outstanding balances
    const initialPayments: { [key: string]: string } = {};
    customer.bills.forEach(bill => {
      const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
      if (outstanding > 0) {
        initialPayments[bill.id] = outstanding.toString();
      }
    });
    setSelectedBillsForPayment(initialPayments);
    setPaymentDialogOpen(true);
  };

  // Generate clean PDF for customer statement
  const generateCustomerPDF = (customer: ConsolidatedCustomer) => {
    const receiptSettings = getReceiptSettings();
    const currentDate = formatDate(new Date());
    const currentTime = formatTime(new Date());
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Statement - ${customer.customerName}</title>
        <style>
          @page { 
            size: A4; 
            margin: 20mm;
            @top-left {
              content: "${receiptSettings.businessName}";
              font-size: 10px;
              color: #666;
            }
            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 10px;
              color: #666;
            }
          }
          
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            color: #333; 
            margin: 0; 
            padding: 0;
            line-height: 1.4;
          }
          
          .header {
            text-align: center;
            padding: 25px 0;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 30px;
          }
          
          .header h1 {
            margin: 0 0 8px 0;
            color: #1f2937;
            font-size: 28px;
            font-weight: 600;
          }
          
          .header .subtitle {
            color: #6b7280;
            font-size: 14px;
            margin: 0;
          }
          
          .store-info {
            text-align: center;
            margin-bottom: 25px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          
          .store-info h2 {
            margin: 0 0 8px 0;
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
          }
          
          .store-info p {
            margin: 4px 0;
            color: #6b7280;
            font-size: 13px;
          }
          
          .customer-info {
            margin-bottom: 30px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .customer-info h3 {
            margin: 0 0 15px 0;
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            font-size: 13px;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          
          .info-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-value {
            color: #1f2937;
            font-weight: 600;
          }
          
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          
          .section-title {
            background: #1f2937;
            color: white;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 15px;
            border-radius: 6px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          th {
            background: #f8fafc;
            text-align: left;
            padding: 12px 10px;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          
          td {
            padding: 10px;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: top;
          }
          
          .amount {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 600;
          }
          
          .total-row {
            background: #fefce8;
            font-weight: 700;
          }
          
          .total-row td {
            border-bottom: none;
            border-top: 2px solid #f59e0b;
            color: #92400e;
          }
          
          .status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-align: center;
          }
          
          .status-paid {
            background: #d1fae5;
            color: #065f46;
          }
          
          .status-partial {
            background: #fef3c7;
            color: #92400e;
          }
          
          .status-unpaid {
            background: #fee2e2;
            color: #991b1b;
          }
          
          .items-section {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          
          .bill-header {
            background: #f8fafc;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            font-weight: 600;
            color: #374151;
            border-left: 4px solid #3b82f6;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 11px;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 25px 0;
          }
          
          .summary-card {
            background: #ffffff;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .summary-card h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
          }
          
          .summary-card p {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
          }
          
          .summary-card.outstanding p {
            color: #dc2626;
          }
          
          .notes {
            background: #eff6ff;
            padding: 10px 12px;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
            margin: 8px 0;
            font-size: 11px;
            color: #1e40af;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Customer Statement</h1>
          <p class="subtitle">Generated on ${currentDate} at ${currentTime}</p>
        </div>

        <div class="store-info">
          <h2>${receiptSettings.businessName}</h2>
          <p>${receiptSettings.address}</p>
          <p><strong>${receiptSettings.dealerText}</strong> ${receiptSettings.dealerBrands}</p>
        </div>

        <div class="customer-info">
          <h3>Customer Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Customer Name:</span>
              <span class="info-value">${customer.customerName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone Number:</span>
              <span class="info-value">${customer.customerPhone}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Bills:</span>
              <span class="info-value">${customer.bills.length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Oldest Bill:</span>
              <span class="info-value">${formatDate(customer.oldestBillDate)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Days Overdue:</span>
              <span class="info-value">${customer.daysOverdue} days</span>
            </div>
            <div class="info-item">
              <span class="info-label">Statement Date:</span>
              <span class="info-value">${currentDate}</span>
            </div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Bills</h3>
            <p>${customer.bills.length}</p>
          </div>
          <div class="summary-card">
            <h3>Total Amount</h3>
            <p>Rs. ${customer.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div class="summary-card">
            <h3>Amount Paid</h3>
            <p>Rs. ${customer.totalPaid.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div class="summary-card outstanding">
            <h3>Outstanding Balance</h3>
            <p>Rs. ${customer.totalOutstanding.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Outstanding Bills</div>
          <table>
            <thead>
              <tr>
                <th>Bill Date</th>
                <th>Bill ID</th>
                <th class="amount">Total Amount</th>
                <th class="amount">Amount Paid</th>
                <th class="amount">Balance Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    customer.bills.forEach((bill) => {
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      
      const statusClass = bill.paymentStatus === 'paid' ? 'status-paid' : 
                         bill.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid';
      
      pdfHTML += `
              <tr>
                <td>${formatDate(bill.createdAt)}</td>
                <td>${bill.id.slice(-8)}</td>
                <td class="amount">Rs. ${billTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="amount">Rs. ${billPaid.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="amount">Rs. ${billOutstanding.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><span class="status ${statusClass}">${bill.paymentStatus.toUpperCase()}</span></td>
              </tr>
      `;
    });
    
    pdfHTML += `
              <tr class="total-row">
                <td colspan="2"><strong>TOTAL OUTSTANDING</strong></td>
                <td class="amount"><strong>Rs. ${customer.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="amount"><strong>Rs. ${customer.totalPaid.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="amount"><strong>Rs. ${customer.totalOutstanding.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
    `;

    // Items Details Section
    pdfHTML += `
        <div class="section">
          <div class="section-title">Items Details</div>
    `;
    
    customer.bills.forEach((bill, billIndex) => {
      if (bill.saleItems && bill.saleItems.length > 0) {
        pdfHTML += `
          <div class="items-section">
            <div class="bill-header">
              Bill ${bill.id.slice(-6)} - ${formatDate(bill.createdAt)} - Total: Rs. ${parseFloat(bill.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Color</th>
                  <th>Qty</th>
                  <th class="amount">Rate</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        bill.saleItems.forEach((item) => {
          pdfHTML += `
                <tr>
                  <td>${item.color.variant.product.productName}</td>
                  <td>${item.color.variant.packingSize}</td>
                  <td>${item.color.colorName} ${item.color.colorCode}</td>
                  <td>${item.quantity}</td>
                  <td class="amount">Rs. ${parseFloat(item.rate).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="amount">Rs. ${parseFloat(item.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
          `;
        });
        
        pdfHTML += `
              </tbody>
            </table>
          </div>
        `;
      }
    });

    pdfHTML += `</div>`;

    // Payment History Section
    if (customerPaymentHistory.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">Payment History</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Bill ID</th>
                <th>Method</th>
                <th class="amount">Amount</th>
                <th class="amount">New Balance</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      customerPaymentHistory.forEach((payment) => {
        pdfHTML += `
              <tr>
                <td>${formatDate(payment.createdAt)}</td>
                <td>${formatTime(payment.createdAt)}</td>
                <td>${payment.saleId.slice(-8)}</td>
                <td>${payment.paymentMethod}</td>
                <td class="amount">Rs. ${parseFloat(payment.amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="amount">Rs. ${parseFloat(payment.newBalance).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${payment.notes || '-'}</td>
              </tr>
        `;
      });
      
      pdfHTML += `
            </tbody>
          </table>
        </div>
      `;
    }

    // Footer
    pdfHTML += `
        <div class="footer">
          <p>${receiptSettings.businessName} • ${receiptSettings.address}</p>
          <p>Customer Statement for ${customer.customerName} • Generated on ${currentDate}</p>
          <p><strong>${receiptSettings.thankYou}</strong></p>
        </div>
      </body>
      </html>
    `;

    return pdfHTML;
  };

  // Download PDF for customer
  const downloadCustomerPDF = (customer: ConsolidatedCustomer) => {
    const pdfHTML = generateCustomerPDF(customer);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${customer.customerName}_${formatDate(new Date()).replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "PDF Downloaded", 
      description: `Customer statement for ${customer.customerName} has been downloaded` 
    });
  };

  // Share PDF via WhatsApp
  const shareCustomerPDF = (customer: ConsolidatedCustomer) => {
    const pdfHTML = generateCustomerPDF(customer);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    // Create and download the PDF file
    const a = document.createElement('a');
    a.href = url;
    const fileName = `Statement_${customer.customerName}_${formatDate(new Date()).replace(/\//g, '-')}.html`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneForWhatsApp(customer.customerPhone);
    
    const message = `📊 *Customer Statement - ${customer.customerName}*

I've generated your customer statement PDF. The file "${fileName}" has been downloaded and is ready to be shared.

*Quick Summary:*
📞 Phone: ${customer.customerPhone}
📋 Total Bills: ${customer.bills.length}
💰 Total Amount: Rs. ${customer.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💳 Amount Paid: Rs. ${customer.totalPaid.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⚖️ Outstanding: Rs. ${customer.totalOutstanding.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Please find the attached PDF file in your downloads folder with complete details of all bills, items, and payment history.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({ 
      title: "PDF Shared via WhatsApp", 
      description: `Customer statement sent to ${formattedPhone}` 
    });

    // Clean up
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  // View PDF in new tab
  const viewCustomerPDF = (customer: ConsolidatedCustomer) => {
    const pdfHTML = generateCustomerPDF(customer);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ 
      title: "PDF Opened", 
      description: `Customer statement for ${customer.customerName} is ready for viewing` 
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unpaid Bills</h1>
          <p className="text-sm text-muted-foreground">Manage outstanding customer payments</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchTerm && (
          <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results */}
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
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {searchTerm ? "No customers found" : "No unpaid bills"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "Try adjusting your search" : "All payments are up to date"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredCustomers.map((customer) => (
            <Card key={customer.customerPhone} className="overflow-hidden">
              <CardHeader className="bg-muted/50 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="h-5 w-5 text-muted-foreground" />
                      {customer.customerName}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {customer.customerPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(customer.oldestBillDate)}
                      </div>
                      <Badge variant={customer.daysOverdue > 30 ? "destructive" : "secondary"}>
                        {customer.daysOverdue} days overdue
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCustomerPDF(customer)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareCustomerPDF(customer)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCustomerDetails(customer)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRecordPaymentClick(customer)}
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Record Payment
                    </Button>
                  </div>
                </div>
                
                {/* Customer Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{customer.bills.length}</div>
                    <div className="text-sm text-muted-foreground">Total Bills</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">Rs. {Math.round(customer.totalAmount).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">Rs. {Math.round(customer.totalPaid).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Amount Paid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">Rs. {Math.round(customer.totalOutstanding).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Outstanding</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <Tabs defaultValue="bills" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="bills">Bills ({customer.bills.length})</TabsTrigger>
                    <TabsTrigger value="payments">Payment History ({customerPaymentHistory.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="bills" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {customer.bills.map((bill) => (
                        <IndividualBill 
                          key={bill.id} 
                          bill={bill} 
                          onViewBill={handleViewBillDetails}
                        />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="payments" className="space-y-4">
                    {customerPaymentHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No payment history found
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {customerPaymentHistory.map((payment) => (
                              <PaymentHistoryItem key={payment.id} payment={payment} />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customer Details Dialog */}
      <Dialog open={customerDetailsOpen} onOpenChange={setCustomerDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details - {selectedCustomer?.customerName}</DialogTitle>
            <DialogDescription>
              Complete overview of bills and payment history
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <Tabs defaultValue="bills" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bills">Bills ({selectedCustomer.bills.length})</TabsTrigger>
                <TabsTrigger value="payments">Payment History ({customerPaymentHistory.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="bills" className="space-y-4">
                <div className="grid gap-4">
                  {selectedCustomer.bills.map((bill) => (
                    <Card key={bill.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <FileDigit className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">Bill #{bill.id.slice(-6)}</span>
                              {getPaymentStatusBadge(bill.paymentStatus)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(bill.createdAt)}
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewBillDetails(bill)}
                          >
                            View Details
                          </Button>
                        </div>

                        {/* Items */}
                        {bill.saleItems && bill.saleItems.length > 0 && (
                          <div className="mb-3">
                            <div className="font-medium mb-2">Items:</div>
                            <div className="space-y-2">
                              {bill.saleItems.map((item) => (
                                <BillItem key={item.id} item={item} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Amount Summary */}
                        <div className="space-y-1 text-sm border-t pt-3">
                          <div className="flex justify-between">
                            <span>Total Amount:</span>
                            <span className="font-semibold">
                              Rs. {Math.round(parseFloat(bill.totalAmount)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount Paid:</span>
                            <span className="text-green-600">
                              Rs. {Math.round(parseFloat(bill.amountPaid)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Balance Due:</span>
                            <span className="text-red-600">
                              Rs. {Math.round(parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4">
                {customerPaymentHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payment history found
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {customerPaymentHistory.map((payment) => (
                          <PaymentHistoryItem key={payment.id} payment={payment} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setCustomerDetailsOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => viewCustomerPDF(selectedCustomer!)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              View PDF
            </Button>
            <Button
              onClick={() => shareCustomerPDF(selectedCustomer!)}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payments for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Summary */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <div className="font-semibold">{selectedCustomer.customerName}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <div className="font-semibold">{selectedCustomer.customerPhone}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Outstanding:</span>
                    <div className="font-semibold text-red-600">
                      Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Bills:</span>
                    <div className="font-semibold">{selectedCustomer.bills.length}</div>
                  </div>
                </div>
              </div>

              {/* Individual Bill Payments */}
              <div className="space-y-4">
                <h3 className="font-medium">Select Bills to Pay</h3>
                {selectedCustomer.bills.map((bill) => {
                  const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
                  if (outstanding <= 0) return null;
                  
                  return (
                    <Card key={bill.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">Bill #{bill.id.slice(-6)}</div>
                            <div className="text-sm text-muted-foreground">
                              Due: Rs. {Math.round(outstanding).toLocaleString()} • {formatDate(bill.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={selectedBillsForPayment[bill.id] || ""}
                              onChange={(e) => handleBillPaymentChange(bill.id, e.target.value)}
                              className="w-32"
                              max={outstanding}
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              / {Math.round(outstanding).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Payment Details */}
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="digital">Digital Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes about this payment"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>

                {/* Total Payment Summary */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Total Payment:</span>
                    <span className="text-blue-600">
                      Rs. {Object.values(selectedBillsForPayment).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recordPaymentMutation.isPending}
                >
                  {recordPaymentMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Record Payment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill Details Dialog */}
      <Dialog open={billDetailsOpen} onOpenChange={setBillDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>
              Complete bill information including items and payment history
            </DialogDescription>
          </DialogHeader>

          {billDetails && (
            <div className="space-y-6">
              {/* Bill Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-muted-foreground">Bill ID</p>
                  <p className="font-medium">{billDetails.id.slice(-8)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(billDetails.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{billDetails.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{billDetails.customerPhone}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-medium">Items ({billDetails.saleItems?.length || 0})</h3>
                {billDetails.saleItems && billDetails.saleItems.length > 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {billDetails.saleItems.map((item) => (
                          <BillItem key={item.id} item={item} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No items found</p>
                )}
              </div>

              {/* Payment History */}
              <div className="space-y-3">
                <h3 className="font-medium">Payment History ({billDetails.paymentHistory?.length || 0})</h3>
                {billDetails.paymentHistory && billDetails.paymentHistory.length > 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {billDetails.paymentHistory.map((payment) => (
                          <PaymentHistoryItem key={payment.id} payment={payment} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No payment history found</p>
                )}
              </div>

              {/* Amount Summary */}
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-semibold">Rs. {Math.round(parseFloat(billDetails.totalAmount)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span className="font-semibold text-green-600">Rs. {Math.round(parseFloat(billDetails.amountPaid)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base">
                      <span className="font-semibold">Balance Due:</span>
                      <span className="font-semibold text-red-600">
                        Rs. {Math.round(parseFloat(billDetails.totalAmount) - parseFloat(billDetails.amountPaid)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}