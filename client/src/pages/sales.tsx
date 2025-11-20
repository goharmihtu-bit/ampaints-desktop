// sales.tsx - Updated with auto-update and clean PDF features
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt, Calendar, RefreshCw, Download, Share2, FileText, Printer, Eye, Banknote, History, User, Phone, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  amountPaid: string;
  paymentStatus: string;
  createdAt: string;
  dueDate?: string;
  notes?: string;
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

interface PaymentHistory {
  id: string;
  saleId: string;
  amount: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  newBalance: string;
}

interface SaleWithItems extends Sale {
  saleItems?: SaleItem[];
  paymentHistory?: PaymentHistory[];
}

// Format date to dd-mm-yyyy
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format time to hh:mm
const formatTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-PK', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

// Format phone number for WhatsApp
const formatPhoneForWhatsApp = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  }
  
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

// Sale Card Actions Component
const SaleCardActions = ({ sale, onView, onDownload, onShare, onPrint }: { 
  sale: SaleWithItems;
  onView: (sale: SaleWithItems) => void;
  onDownload: (sale: SaleWithItems) => void;
  onShare: (sale: SaleWithItems) => void;
  onPrint: (sale: SaleWithItems) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <FileText className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onView(sale)}>
        <Eye className="h-4 w-4 mr-2" />
        View Bill
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onView(sale)}>
        <FileText className="h-4 w-4 mr-2" />
        View Statement
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDownload(sale)}>
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onShare(sale)}>
        <Share2 className="h-4 w-4 mr-2" />
        Share via WhatsApp
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onPrint(sale)}>
        <Printer className="h-4 w-4 mr-2" />
        Print Bill
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default function Sales() {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-refresh sales data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

  const { data: sales = [], isLoading, refetch } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch detailed sale data when a sale is selected
  const { data: saleDetails } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", selectedSale?.id],
    enabled: !!selectedSale?.id && (showSaleDetails || showPaymentHistory),
  });

  // Add refresh function
  const refreshSales = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/sales", selectedSale?.id] });
    toast({ title: "Sales data refreshed" });
  };

  // Generate clean sale bill PDF
  const generateSalePDF = (sale: SaleWithItems) => {
    const receiptSettings = getReceiptSettings();
    const saleDate = new Date(sale.createdAt);
    const formattedDate = formatDate(saleDate);
    const formattedTime = formatTime(saleDate);
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Sale Bill - ${sale.id.slice(-8)}</title>
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
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
          }
          
          .info-card {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .info-card h3 {
            margin: 0 0 15px 0;
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
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
          
          .amount-section {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .amount-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
          }
          
          .amount-item {
            padding: 15px;
          }
          
          .amount-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
            font-weight: 500;
          }
          
          .amount-value {
            font-size: 18px;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            color: #1f2937;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 11px;
          }
          
          .notes-section {
            background: #eff6ff;
            padding: 12px 16px;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
            margin: 15px 0;
            font-size: 12px;
            color: #1e40af;
          }
          
          .payment-history {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Sale Bill</h1>
          <p class="subtitle">Generated on ${formattedDate} at ${formattedTime}</p>
        </div>

        <div class="store-info">
          <h2>${receiptSettings.businessName}</h2>
          <p>${receiptSettings.address}</p>
          <p><strong>${receiptSettings.dealerText}</strong> ${receiptSettings.dealerBrands}</p>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h3>Bill Information</h3>
            <div class="info-item">
              <span class="info-label">Bill ID:</span>
              <span class="info-value">${sale.id.slice(-8).toUpperCase()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Time:</span>
              <span class="info-value">${formattedTime}</span>
            </div>
            ${sale.dueDate ? `
            <div class="info-item">
              <span class="info-label">Due Date:</span>
              <span class="info-value">${formatDate(sale.dueDate)}</span>
            </div>
            ` : ''}
          </div>

          <div class="info-card">
            <h3>Customer Information</h3>
            <div class="info-item">
              <span class="info-label">Name:</span>
              <span class="info-value">${sale.customerName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone:</span>
              <span class="info-value">${sale.customerPhone}</span>
            </div>
          </div>
        </div>
    `;

    // Notes Section
    if (sale.notes) {
      pdfHTML += `
        <div class="notes-section">
          <strong>Additional Notes:</strong> ${sale.notes}
        </div>
      `;
    }

    // Items Table
    if (sale.saleItems && sale.saleItems.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">Items Details • ${sale.saleItems.length} Items</div>
          <table>
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Qty</th>
                <th class="amount">Rate</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      sale.saleItems.forEach((item) => {
        const productLine = `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
        
        pdfHTML += `
              <tr>
                <td>${productLine}</td>
                <td>${item.quantity}</td>
                <td class="amount">Rs. ${parseFloat(item.rate).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="amount">Rs. ${parseFloat(item.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
        `;
      });
      
      pdfHTML += `
              <tr class="total-row">
                <td colspan="3"><strong>GRAND TOTAL</strong></td>
                <td class="amount"><strong>Rs. ${parseFloat(sale.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Payment History Section
    if (sale.paymentHistory && sale.paymentHistory.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">Payment History • ${sale.paymentHistory.length} Payments</div>
          <table>
            <thead>
              <tr>
                <th>Payment Date</th>
                <th>Time</th>
                <th>Method</th>
                <th class="amount">Amount Paid</th>
                <th class="amount">New Balance</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      sale.paymentHistory.forEach((payment) => {
        pdfHTML += `
              <tr>
                <td>${formatDate(payment.createdAt)}</td>
                <td>${formatTime(payment.createdAt)}</td>
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

    // Amount Summary
    const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
    const statusClass = sale.paymentStatus === 'paid' ? 'status-paid' : 
                       sale.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid';
    
    pdfHTML += `
      <div class="amount-section">
        <div class="amount-grid">
          <div class="amount-item">
            <div class="amount-label">Total Amount</div>
            <div class="amount-value">Rs. ${parseFloat(sale.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="amount-item">
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">Rs. ${parseFloat(sale.amountPaid).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="amount-item">
            <div class="amount-label">Balance Due</div>
            <div class="amount-value">Rs. ${outstanding.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 15px;">
          <span class="status ${statusClass}">
            ${sale.paymentStatus.toUpperCase()} 
            ${sale.paymentStatus === 'partial' ? 'PAYMENT' : ''}
          </span>
        </div>
      </div>

      <div class="footer">
        <p>${receiptSettings.businessName} • ${receiptSettings.address}</p>
        <p>Generated on ${formatDate(new Date())} • This is a computer-generated bill</p>
        <p><strong>${receiptSettings.thankYou}</strong></p>
      </div>
    </body>
    </html>
    `;

    return pdfHTML;
  };

  // Download PDF for individual sale
  const downloadSalePDF = (sale: SaleWithItems) => {
    const pdfHTML = generateSalePDF(sale);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_${sale.customerName}_${sale.id.slice(-8)}_${formatDate(new Date()).replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "PDF Downloaded", 
      description: `Bill for ${sale.customerName} has been downloaded` 
    });
  };

  // View PDF for individual sale
  const viewSalePDF = (sale: SaleWithItems) => {
    const pdfHTML = generateSalePDF(sale);
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
      description: `Bill for ${sale.customerName} is ready for viewing` 
    });
  };

  // Print bill directly
  const printSaleBill = (sale: SaleWithItems) => {
    const pdfHTML = generateSalePDF(sale);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Share bill via WhatsApp with PDF
  const shareBillViaWhatsApp = (sale: SaleWithItems) => {
    // Generate and download PDF first
    const pdfHTML = generateSalePDF(sale);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    const fileName = `Bill_${sale.customerName}_${sale.id.slice(-8)}.html`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneForWhatsApp(sale.customerPhone);
    
    const message = `🛍️ *Sale Bill - ${receiptSettings.businessName}*

I've generated your sale bill PDF. The file "${fileName}" has been downloaded and is ready to be shared.

*Bill Summary:*
📄 Bill ID: ${sale.id.slice(-8).toUpperCase()}
👤 Customer: ${sale.customerName}
📞 Phone: ${sale.customerPhone}
📅 Date: ${formatDate(sale.createdAt)}
⏰ Time: ${formatTime(sale.createdAt)}

*Amount Details:*
💰 Total Amount: Rs. ${parseFloat(sale.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💳 Amount Paid: Rs. ${parseFloat(sale.amountPaid).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⚖️ Balance Due: Rs. ${(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
📊 Status: ${sale.paymentStatus.toUpperCase()}

The PDF contains complete details of all items and payment history. Please check your downloads folder for the file.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({ 
      title: "PDF Shared via WhatsApp", 
      description: `Bill sent to ${formattedPhone}` 
    });

    // Clean up
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  // View sale details
  const handleViewSaleDetails = (sale: Sale) => {
    setSelectedSale(sale as SaleWithItems);
    setShowSaleDetails(true);
  };

  // View payment history
  const handleViewPaymentHistory = (sale: Sale) => {
    setSelectedSale(sale as SaleWithItems);
    setShowPaymentHistory(true);
  };

  const filteredSales = useMemo(() => {
    let filtered = sales;

    // Customer search filter
    if (customerSearchQuery) {
      const query = customerSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((sale) => {
        const customerName = sale.customerName.toLowerCase();
        const customerPhone = sale.customerPhone.toLowerCase();
        return customerName.includes(query) || customerPhone.includes(query);
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= today;
          });
          break;
        
        case "yesterday":
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= yesterday && saleDate < today;
          });
          break;
        
        case "week":
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= weekAgo;
          });
          break;
        
        case "month":
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= monthAgo;
          });
          break;
        
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.createdAt);
              return saleDate >= start && saleDate <= end;
            });
          }
          break;
        
        default:
          break;
      }
    }

    return filtered;
  }, [sales, customerSearchQuery, dateFilter, startDate, endDate]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredSales.reduce((acc, sale) => {
      const total = parseFloat(sale.totalAmount) || 0;
      const paid = parseFloat(sale.amountPaid) || 0;
      const due = total - paid;

      return {
        totalAmount: acc.totalAmount + total,
        totalPaid: acc.totalPaid + paid,
        totalDue: acc.totalDue + due,
        count: acc.count + 1
      };
    }, {
      totalAmount: 0,
      totalPaid: 0,
      totalDue: 0,
      count: 0
    });
  }, [filteredSales]);

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

  // Helper function to get product line
  const getProductLine = (item: SaleItem) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  const receiptSettings = getReceiptSettings();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">View all sales transactions • Auto-updates every 30 seconds</p>
        </div>
        <Button variant="outline" onClick={refreshSales}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search and Filter Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>

                  {dateFilter === "custom" && (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm"
                        placeholder="Start Date"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm"
                        placeholder="End Date"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              {filteredSales.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Sales</div>
                      <div className="text-lg font-semibold">{totals.count}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Amount</div>
                      <div className="text-lg font-semibold">Rs. {Math.round(totals.totalAmount).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Paid</div>
                      <div className="text-lg font-semibold">Rs. {Math.round(totals.totalPaid).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Due</div>
                      <div className="text-lg font-semibold text-red-600">
                        Rs. {Math.round(totals.totalDue).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sales List */}
              {filteredSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {customerSearchQuery || dateFilter !== "all" ? "No sales found matching your filters." : "No sales yet."}
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {filteredSales.map((sale) => {
                      const totalFloat = parseFloat(sale.totalAmount);
                      const paidFloat = parseFloat(sale.amountPaid);
                      const totalAmount = Math.round(totalFloat);
                      const amountPaid = Math.round(paidFloat);
                      const amountDue = Math.round(totalFloat - paidFloat);

                      return (
                        <Card key={sale.id} className="hover:shadow-lg transition-shadow duration-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Receipt className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{sale.customerName}</span>
                                  {getPaymentStatusBadge(sale.paymentStatus)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span className="font-mono">{sale.customerPhone}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(sale.createdAt)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatTime(sale.createdAt)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="font-semibold">Rs. {totalAmount.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Paid: </span>
                                    <span className="font-semibold text-green-600">Rs. {amountPaid.toLocaleString()}</span>
                                  </div>
                                  {amountDue > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Due: </span>
                                      <span className="font-semibold text-red-600">Rs. {amountDue.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <SaleCardActions
                                  sale={sale as SaleWithItems}
                                  onView={handleViewSaleDetails}
                                  onDownload={downloadSalePDF}
                                  onShare={shareBillViaWhatsApp}
                                  onPrint={printSaleBill}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewSaleDetails(sale)}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  View Bill
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Results Summary */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredSales.length} of {sales.length} sales
                      {dateFilter !== "all" && ` • Filtered by ${dateFilter}`}
                    </p>
                    
                    {/* Grand Totals */}
                    <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                      <div>
                        <span className="text-muted-foreground">Grand Total: </span>
                        <span>Rs. {Math.round(totals.totalAmount).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Paid: </span>
                        <span>Rs. {Math.round(totals.totalPaid).toLocaleString()}</span>
                      </div>
                      {totals.totalDue > 0 && (
                        <div>
                          <span className="text-muted-foreground">Total Due: </span>
                          <span className="text-red-600">Rs. {Math.round(totals.totalDue).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={showSaleDetails} onOpenChange={setShowSaleDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              Complete bill information for {selectedSale?.customerName}
            </DialogDescription>
          </DialogHeader>
          
          {saleDetails && (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{saleDetails.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{saleDetails.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Bill Date</p>
                    <p className="font-medium">{formatDate(saleDetails.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Bill Time</p>
                    <p className="font-medium">{formatTime(saleDetails.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-medium">Items ({saleDetails.saleItems?.length || 0})</h3>
                {saleDetails.saleItems && saleDetails.saleItems.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {saleDetails.saleItems.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="text-sm font-medium">
                                {getProductLine(item)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.color.variant.product.company}
                              </div>
                            </div>
                            <div className="text-right space-y-1 text-sm font-mono">
                              <div>Qty: {item.quantity}</div>
                              <div>Rate: Rs. {Math.round(parseFloat(item.rate)).toLocaleString()}</div>
                              <div className="font-semibold">Total: Rs. {Math.round(parseFloat(item.subtotal)).toLocaleString()}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No items found</p>
                )}
              </div>

              {/* Payment History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Payment History ({saleDetails.paymentHistory?.length || 0})</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewPaymentHistory(saleDetails)}
                  >
                    <History className="h-4 w-4 mr-1" />
                    View Full History
                  </Button>
                </div>
                
                {saleDetails.paymentHistory && saleDetails.paymentHistory.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {saleDetails.paymentHistory.slice(0, 3).map((payment) => (
                      <Card key={payment.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {formatDate(payment.createdAt)}
                                </Badge>
                                <Badge variant="secondary">
                                  {payment.paymentMethod}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatTime(payment.createdAt)}
                              </div>
                              {payment.notes && (
                                <div className="text-xs text-muted-foreground">
                                  Notes: {payment.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <div className="font-mono font-medium text-green-600">
                                +Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Balance: Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {saleDetails.paymentHistory.length > 3 && (
                      <div className="text-center text-sm text-muted-foreground py-2">
                        + {saleDetails.paymentHistory.length - 3} more payments
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount Summary */}
              <div className="p-4 bg-muted rounded-md space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span>Rs. {Math.round(parseFloat(saleDetails.totalAmount)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="text-green-600">Rs. {Math.round(parseFloat(saleDetails.amountPaid)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-base text-red-600 border-t border-border pt-2">
                  <span>Balance Due:</span>
                  <span>Rs. {Math.round(parseFloat(saleDetails.totalAmount) - parseFloat(saleDetails.amountPaid)).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaleDetails(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => viewSalePDF(saleDetails)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Statement
                </Button>
                <Button
                  onClick={() => printSaleBill(saleDetails)}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Complete payment history for {selectedSale?.customerName}
            </DialogDescription>
          </DialogHeader>

          {saleDetails && (
            <div className="space-y-4">
              {saleDetails.paymentHistory && saleDetails.paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {saleDetails.paymentHistory.map((payment) => (
                    <Card key={payment.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {formatDate(payment.createdAt)}
                              </Badge>
                              <Badge variant="secondary">
                                {payment.paymentMethod}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatTime(payment.createdAt)}
                            </div>
                            {payment.notes && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Notes: </span>
                                {payment.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right space-y-2">
                            <div className="font-mono text-lg font-bold text-green-600">
                              +Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              New Balance: Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payment history found</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowPaymentHistory(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}