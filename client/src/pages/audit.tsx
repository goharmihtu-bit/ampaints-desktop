import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Calendar,
  Package,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  X,
  Lock,
  Settings,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Wallet,
  RotateCcw,
  DollarSign,
  Receipt,
  Database,
  Trash2,
  Edit,
  Cloud,
  Upload,
  Check,
  XCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import jsPDF from "jspdf";
import type { ColorWithVariantAndProduct, Sale, StockInHistory, Product, PaymentHistory, Return, Settings as AppSettings } from "@shared/schema";
import { format, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";

interface StockInHistoryWithColor extends StockInHistory {
  color: ColorWithVariantAndProduct;
}

interface StockOutItem {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color: ColorWithVariantAndProduct;
  sale: Sale;
  soldAt: Date;
  customerName: string;
  customerPhone: string;
}

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

interface ConsolidatedCustomer {
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  sales: Sale[];
}

// Helper function to format phone number for WhatsApp
function formatPhoneForWhatsApp(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid Indian phone number (10 digits)
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  
  // Check if it's already in international format
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  
  return null;
}

// Helper function to generate statement PDF blob
function generateStatementPDFBlob(customer: ConsolidatedCustomer): Blob {
  const pdf = new jsPDF();
  
  // Add basic statement content
  pdf.text(`Statement for ${customer.customerName}`, 20, 20);
  pdf.text(`Phone: ${customer.customerPhone}`, 20, 30);
  pdf.text(`Total Amount: Rs. ${Math.round(customer.totalAmount).toLocaleString()}`, 20, 40);
  pdf.text(`Total Paid: Rs. ${Math.round(customer.totalPaid).toLocaleString()}`, 20, 50);
  pdf.text(`Outstanding: Rs. ${Math.round(customer.totalOutstanding).toLocaleString()}`, 20, 60);
  
  // Convert to blob
  const pdfBlob = pdf.output('blob');
  return pdfBlob;
}

export default function Audit() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { toast } = useToast();

  const [isVerified, setIsVerified] = useState(false);
  const [auditToken, setAuditToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [isDefaultPin, setIsDefaultPin] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(true);
  
  const [activeTab, setActiveTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Cloud Sync State
  const [cloudUrl, setCloudUrl] = useState("");
  const [showCloudUrl, setShowCloudUrl] = useState(false);
  const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "exporting" | "importing">("idle");
  const [lastExportCounts, setLastExportCounts] = useState<any>(null);
  const [lastImportCounts, setLastImportCounts] = useState<any>(null);

  const { data: hasPin } = useQuery<{ hasPin: boolean }>({
    queryKey: ["/api/audit/has-pin"],
    enabled: !isVerified,
  });

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: isVerified,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isVerified,
  });

  const { data: stockInHistory = [], isLoading: stockInLoading } = useQuery<StockInHistoryWithColor[]>({
    queryKey: ["/api/stock-in-history"],
    enabled: isVerified,
  });

  const { data: stockOutHistory = [], isLoading: stockOutLoading } = useQuery<StockOutItem[]>({
    queryKey: ["/api/audit/stock-out", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: async () => {
      if (!auditToken) throw new Error("No audit token");
      const response = await fetch("/api/audit/stock-out", {
        headers: { "X-Audit-Token": auditToken },
      });
      if (!response.ok) throw new Error("Failed to fetch stock out history");
      return response.json();
    },
  });

  const { data: allSales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: isVerified,
  });

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  });

  const { data: unpaidBills = [], isLoading: unpaidLoading } = useQuery<Sale[]>({
    queryKey: ["/api/audit/unpaid-bills", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: async () => {
      if (!auditToken) throw new Error("No audit token");
      const response = await fetch("/api/audit/unpaid-bills", {
        headers: { "X-Audit-Token": auditToken },
      });
      if (!response.ok) throw new Error("Failed to fetch unpaid bills");
      return response.json();
    },
  });

  const { data: auditPayments = [], isLoading: auditPaymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/audit/payments", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: async () => {
      if (!auditToken) throw new Error("No audit token");
      const response = await fetch("/api/audit/payments", {
        headers: { "X-Audit-Token": auditToken },
      });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const { data: auditReturns = [], isLoading: returnsLoading } = useQuery<Return[]>({
    queryKey: ["/api/audit/returns", auditToken],
    enabled: isVerified && !!auditToken,
    queryFn: async () => {
      if (!auditToken) throw new Error("No audit token");
      const response = await fetch("/api/audit/returns", {
        headers: { "X-Audit-Token": auditToken },
      });
      if (!response.ok) throw new Error("Failed to fetch returns");
      return response.json();
    },
  });

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: Partial<AppSettings>) => {
      const response = await apiRequest("PATCH", "/api/settings", permissions);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Permissions Updated",
        description: "Access control settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Update",
        description: "Could not save permission settings.",
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (key: keyof AppSettings, value: boolean) => {
    updatePermissionsMutation.mutate({ [key]: value });
  };

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await apiRequest("POST", "/api/audit/verify", { pin });
      const data = await response.json();
      return data;
    },
    onSuccess: (data: { ok: boolean; isDefault?: boolean; auditToken?: string }) => {
      if (data.ok && data.auditToken) {
        setIsVerified(true);
        setAuditToken(data.auditToken);
        setShowPinDialog(false);
        setIsDefaultPin(data.isDefault || false);
        setPinError("");
        if (data.isDefault) {
          toast({
            title: "Default PIN Used",
            description: "Please change your PIN in the Settings tab for security.",
            variant: "destructive",
          });
        }
        sessionStorage.setItem("auditVerified", "true");
        sessionStorage.setItem("auditToken", data.auditToken);
      }
    },
    onError: () => {
      setPinError("Invalid PIN. Please try again.");
      setPinInput(["", "", "", ""]);
    },
  });

  const changePinMutation = useMutation({
    mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      const response = await apiRequest("PATCH", "/api/audit/pin", { currentPin, newPin });
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      toast({
        title: "PIN Changed",
        description: "Your audit PIN has been successfully updated.",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setIsDefaultPin(false);
      queryClient.invalidateQueries({ queryKey: ["/api/audit/has-pin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "PIN Change Failed",
        description: error.message || "Failed to change PIN. Please check your current PIN.",
        variant: "destructive",
      });
    },
  });

  // Cloud Sync Functions
  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter a PostgreSQL connection URL.",
        variant: "destructive",
      });
      return;
    }

    setCloudConnectionStatus("testing");
    try {
      const response = await fetch("/api/cloud/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Token": auditToken || "",
        },
        body: JSON.stringify({ connectionUrl: cloudUrl }),
      });
      const data = await response.json();
      if (data.ok) {
        setCloudConnectionStatus("success");
        toast({
          title: "Connection Successful",
          description: "Successfully connected to cloud database.",
        });
      } else {
        setCloudConnectionStatus("error");
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setCloudConnectionStatus("error");
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to cloud database.",
        variant: "destructive",
      });
    }
  };

  const handleSaveCloudSettings = async () => {
    try {
      const response = await fetch("/api/cloud/save-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Token": auditToken || "",
        },
        body: JSON.stringify({ connectionUrl: cloudUrl, syncEnabled: true }),
      });
      const data = await response.json();
      if (data.ok) {
        toast({
          title: "Settings Saved",
          description: "Cloud database settings saved successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      }
    } catch (error: any) {
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save cloud settings.",
        variant: "destructive",
      });
    }
  };

  const handleExportToCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    // First save settings if not already saved
    await handleSaveCloudSettings();

    setCloudSyncStatus("exporting");
    try {
      const response = await fetch("/api/cloud/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Token": auditToken || "",
        },
      });
      const data = await response.json();
      if (data.ok) {
        setLastExportCounts(data.counts);
        toast({
          title: "Export Successful",
          description: `Exported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales to cloud.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      } else {
        toast({
          title: "Export Failed",
          description: data.error || "Could not export to cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Could not export to cloud database.",
        variant: "destructive",
      });
    } finally {
      setCloudSyncStatus("idle");
    }
  };

  const handleImportFromCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    // First save settings if not already saved
    await handleSaveCloudSettings();

    setCloudSyncStatus("importing");
    try {
      const response = await fetch("/api/cloud/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Token": auditToken || "",
        },
      });
      const data = await response.json();
      if (data.ok) {
        setLastImportCounts(data.counts);
        toast({
          title: "Import Successful",
          description: `Imported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales from cloud.`,
        });
        // Invalidate all data queries to refresh
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Could not import from cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import from cloud database.",
        variant: "destructive",
      });
    } finally {
      setCloudSyncStatus("idle");
    }
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken");
    if (sessionStorage.getItem("auditVerified") === "true" && storedToken) {
      setIsVerified(true);
      setAuditToken(storedToken);
      setShowPinDialog(false);
    }
  }, []);

  // Initialize cloud URL from settings when they load
  useEffect(() => {
    if (appSettings?.cloudDatabaseUrl && !cloudUrl) {
      setCloudUrl(appSettings.cloudDatabaseUrl);
      if (appSettings.cloudSyncEnabled) {
        setCloudConnectionStatus("success");
      }
    }
  }, [appSettings?.cloudDatabaseUrl, appSettings?.cloudSyncEnabled]);

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPinInput = [...pinInput];
    newPinInput[index] = value.slice(-1);
    setPinInput(newPinInput);
    setPinError("");

    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    if (index === 3 && value) {
      const fullPin = newPinInput.join("");
      if (fullPin.length === 4) {
        verifyPinMutation.mutate(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pinInput[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePinChange = () => {
    if (newPin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "New PIN and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    changePinMutation.mutate({
      currentPin: currentPin || "0000",
      newPin: newPin,
    });
  };

  const companies = useMemo(() => {
    const uniqueCompanies = new Set(products.map(p => p.company));
    return Array.from(uniqueCompanies).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (companyFilter === "all") return products;
    return products.filter(p => p.company === companyFilter);
  }, [products, companyFilter]);

  const stockMovements = useMemo(() => {
    const movements: {
      id: string;
      date: Date;
      type: "IN" | "OUT";
      company: string;
      product: string;
      variant: string;
      colorCode: string;
      colorName: string;
      quantity: number;
      previousStock?: number;
      newStock?: number;
      reference: string;
      customer?: string;
      notes?: string;
    }[] = [];

    stockInHistory.forEach(record => {
      movements.push({
        id: record.id,
        date: new Date(record.createdAt),
        type: "IN",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        previousStock: record.previousStock,
        newStock: record.newStock,
        reference: `Stock In: ${record.stockInDate}`,
        notes: record.notes || undefined,
      });
    });

    stockOutHistory.forEach(record => {
      movements.push({
        id: record.id,
        date: new Date(record.soldAt),
        type: "OUT",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        reference: `Bill #${record.saleId.slice(0, 8).toUpperCase()}`,
        customer: record.customerName,
      });
    });

    return movements.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [stockInHistory, stockOutHistory]);

  const filteredStockMovements = useMemo(() => {
    let filtered = [...stockMovements];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.colorCode.toLowerCase().includes(query) ||
        m.colorName.toLowerCase().includes(query) ||
        m.product.toLowerCase().includes(query) ||
        m.company.toLowerCase().includes(query) ||
        (m.customer && m.customer.toLowerCase().includes(query))
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter(m => !isBefore(m.date, fromDate));
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter(m => !isAfter(m.date, toDate));
    }

    if (companyFilter !== "all") {
      filtered = filtered.filter(m => m.company === companyFilter);
    }

    if (productFilter !== "all") {
      filtered = filtered.filter(m => m.product === productFilter);
    }

    if (movementTypeFilter !== "all") {
      filtered = filtered.filter(m => m.type === movementTypeFilter);
    }

    return filtered;
  }, [stockMovements, searchQuery, dateFrom, dateTo, companyFilter, productFilter, movementTypeFilter]);

  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.customerName.toLowerCase().includes(query) ||
        sale.customerPhone.includes(query) ||
        sale.id.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !isBefore(saleDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !isAfter(saleDate, toDate);
      });
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allSales, searchQuery, dateFrom, dateTo]);

  const stockSummary = useMemo(() => {
    const totalIn = stockInHistory.reduce((acc, r) => acc + r.quantity, 0);
    const totalOut = stockOutHistory.reduce((acc, r) => acc + r.quantity, 0);
    const currentStock = colors.reduce((acc, c) => acc + c.stockQuantity, 0);
    return { totalIn, totalOut, currentStock };
  }, [stockInHistory, stockOutHistory, colors]);

  const salesSummary = useMemo(() => {
    const totalSales = allSales.reduce((acc, s) => acc + parseFloat(s.totalAmount), 0);
    const totalPaid = allSales.reduce((acc, s) => acc + parseFloat(s.amountPaid), 0);
    const totalOutstanding = totalSales - totalPaid;
    const totalBills = allSales.length;
    const paidBills = allSales.filter(s => s.paymentStatus === "paid").length;
    return { totalSales, totalPaid, totalOutstanding, totalBills, paidBills };
  }, [allSales]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setCompanyFilter("all");
    setProductFilter("all");
    setMovementTypeFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || companyFilter !== "all" || productFilter !== "all" || movementTypeFilter !== "all";

  const downloadStockAuditPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("STOCK AUDIT REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos);
    if (dateFrom || dateTo) {
      pdf.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, margin + 80, yPos);
    }
    yPos += 8;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Stock In: ${stockSummary.totalIn}`, margin + 5, yPos + 10);
    pdf.text(`Total Stock Out: ${stockSummary.totalOut}`, margin + 70, yPos + 10);
    pdf.text(`Current Stock: ${stockSummary.currentStock}`, margin + 140, yPos + 10);
    pdf.text(`Net Movement: ${stockSummary.totalIn - stockSummary.totalOut}`, margin + 200, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Type", "Company", "Product", "Size", "Color", "Qty", "Reference", "Customer"];
    const colWidths = [25, 15, 35, 35, 25, 40, 15, 45, 40];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(filteredStockMovements.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const m = filteredStockMovements[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(m.date), xPos, yPos + 4); xPos += colWidths[0];
      
      if (m.type === "IN") {
        pdf.setTextColor(34, 197, 94);
      } else {
        pdf.setTextColor(239, 68, 68);
      }
      pdf.text(m.type, xPos, yPos + 4); xPos += colWidths[1];
      pdf.setTextColor(0, 0, 0);
      
      pdf.text(m.company.substring(0, 15), xPos, yPos + 4); xPos += colWidths[2];
      pdf.text(m.product.substring(0, 15), xPos, yPos + 4); xPos += colWidths[3];
      pdf.text(m.variant, xPos, yPos + 4); xPos += colWidths[4];
      pdf.text(`${m.colorCode} - ${m.colorName}`.substring(0, 20), xPos, yPos + 4); xPos += colWidths[5];
      pdf.text(m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`, xPos, yPos + 4); xPos += colWidths[6];
      pdf.text(m.reference.substring(0, 22), xPos, yPos + 4); xPos += colWidths[7];
      pdf.text((m.customer || "-").substring(0, 18), xPos, yPos + 4);
      yPos += 6;
    }

    if (filteredStockMovements.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${filteredStockMovements.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Stock-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Stock Audit Report has been downloaded." });
  };

  const downloadSalesAuditPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("SALES AUDIT REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos);
    if (dateFrom || dateTo) {
      pdf.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, margin + 80, yPos);
    }
    yPos += 8;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Sales: Rs. ${Math.round(salesSummary.totalSales).toLocaleString()}`, margin + 5, yPos + 10);
    pdf.text(`Total Paid: Rs. ${Math.round(salesSummary.totalPaid).toLocaleString()}`, margin + 70, yPos + 10);
    pdf.text(`Outstanding: Rs. ${Math.round(salesSummary.totalOutstanding).toLocaleString()}`, margin + 140, yPos + 10);
    pdf.text(`Bills: ${salesSummary.totalBills} (${salesSummary.paidBills} paid)`, margin + 215, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Bill No", "Customer", "Phone", "Total", "Paid", "Outstanding", "Status"];
    const colWidths = [28, 35, 55, 40, 35, 35, 35, 25];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(filteredSales.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const sale = filteredSales[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(sale.createdAt), xPos, yPos + 4); xPos += colWidths[0];
      pdf.text(`#${sale.id.slice(0, 8).toUpperCase()}`, xPos, yPos + 4); xPos += colWidths[1];
      pdf.text(sale.customerName.substring(0, 25), xPos, yPos + 4); xPos += colWidths[2];
      pdf.text(sale.customerPhone, xPos, yPos + 4); xPos += colWidths[3];
      pdf.text(`Rs. ${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[4];
      pdf.text(`Rs. ${Math.round(parseFloat(sale.amountPaid)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[5];
      
      if (outstanding > 0) {
        pdf.setTextColor(239, 68, 68);
      } else {
        pdf.setTextColor(34, 197, 94);
      }
      pdf.text(`Rs. ${Math.round(outstanding).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[6];
      pdf.text(sale.paymentStatus.toUpperCase(), xPos, yPos + 4);
      pdf.setTextColor(0, 0, 0);
      yPos += 6;
    }

    if (filteredSales.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${filteredSales.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Sales-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Sales Audit Report has been downloaded." });
  };

  const downloadUnpaidPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(239, 68, 68);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("UNPAID BILLS REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid), 0);
    const totalBillAmount = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount), 0);
    const totalPaidSoFar = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.amountPaid), 0);

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Unpaid: Rs. ${Math.round(totalUnpaid).toLocaleString()}`, margin + 5, yPos + 10);
    pdf.text(`Bill Amount: Rs. ${Math.round(totalBillAmount).toLocaleString()}`, margin + 80, yPos + 10);
    pdf.text(`Paid So Far: Rs. ${Math.round(totalPaidSoFar).toLocaleString()}`, margin + 155, yPos + 10);
    pdf.text(`Unpaid Bills: ${unpaidBills.length}`, margin + 225, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Customer", "Phone", "Bill Amount", "Paid", "Outstanding", "Status", "Due Date"];
    const colWidths = [28, 55, 40, 40, 40, 40, 25, 28];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(unpaidBills.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const bill = unpaidBills[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(bill.createdAt), xPos, yPos + 4); xPos += colWidths[0];
      pdf.text(bill.customerName.substring(0, 25), xPos, yPos + 4); xPos += colWidths[1];
      pdf.text(bill.customerPhone, xPos, yPos + 4); xPos += colWidths[2];
      pdf.text(`Rs. ${Math.round(parseFloat(bill.totalAmount)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[3];
      pdf.text(`Rs. ${Math.round(parseFloat(bill.amountPaid)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[4];
      pdf.setTextColor(239, 68, 68);
      pdf.text(`Rs. ${Math.round(outstanding).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[5];
      pdf.setTextColor(0, 0, 0);
      pdf.text(bill.paymentStatus.toUpperCase(), xPos, yPos + 4); xPos += colWidths[6];
      pdf.text(bill.dueDate ? formatDateShort(new Date(bill.dueDate)) : "-", xPos, yPos + 4);
      yPos += 6;
    }

    if (unpaidBills.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${unpaidBills.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Unpaid-Bills-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Unpaid Bills Report has been downloaded." });
  };

  const downloadPaymentsPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(34, 197, 94);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("PAYMENTS HISTORY REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    const totalCollected = auditPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const cashPayments = auditPayments.filter(p => p.paymentMethod === "cash").length;
    const otherPayments = auditPayments.filter(p => p.paymentMethod !== "cash").length;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Collected: Rs. ${Math.round(totalCollected).toLocaleString()}`, margin + 5, yPos + 10);
    pdf.text(`Total Payments: ${auditPayments.length}`, margin + 85, yPos + 10);
    pdf.text(`Cash: ${cashPayments}`, margin + 155, yPos + 10);
    pdf.text(`Other Methods: ${otherPayments}`, margin + 200, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Customer", "Amount", "Method", "Prev Balance", "New Balance", "Notes"];
    const colWidths = [30, 55, 40, 35, 40, 40, 55];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(auditPayments.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const payment = auditPayments[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(payment.createdAt), xPos, yPos + 4); xPos += colWidths[0];
      pdf.text((payment.sale?.customerName || payment.customerPhone).substring(0, 25), xPos, yPos + 4); xPos += colWidths[1];
      pdf.setTextColor(34, 197, 94);
      pdf.text(`Rs. ${Math.round(parseFloat(payment.amount)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[2];
      pdf.setTextColor(0, 0, 0);
      pdf.text(payment.paymentMethod.toUpperCase(), xPos, yPos + 4); xPos += colWidths[3];
      pdf.text(`Rs. ${Math.round(parseFloat(payment.previousBalance)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[4];
      pdf.text(`Rs. ${Math.round(parseFloat(payment.newBalance)).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[5];
      pdf.text((payment.notes || "-").substring(0, 25), xPos, yPos + 4);
      yPos += 6;
    }

    if (auditPayments.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${auditPayments.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Payments-History-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Payments History Report has been downloaded." });
  };

  const downloadReturnsPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(249, 115, 22);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("RETURNS AUDIT REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    const totalRefunded = auditReturns.reduce((sum, r) => sum + parseFloat(r.totalRefund || "0"), 0);
    const billReturns = auditReturns.filter(r => r.returnType === "bill").length;
    const itemReturns = auditReturns.filter(r => r.returnType === "item").length;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Returns: ${auditReturns.length}`, margin + 5, yPos + 10);
    pdf.text(`Total Refunded: Rs. ${Math.round(totalRefunded).toLocaleString()}`, margin + 65, yPos + 10);
    pdf.text(`Bill Returns: ${billReturns}`, margin + 155, yPos + 10);
    pdf.text(`Item Returns: ${itemReturns}`, margin + 210, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Customer", "Phone", "Type", "Refund Amount", "Reason", "Status"];
    const colWidths = [30, 55, 40, 30, 45, 60, 30];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(auditReturns.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const returnItem = auditReturns[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(returnItem.createdAt), xPos, yPos + 4); xPos += colWidths[0];
      pdf.text(returnItem.customerName.substring(0, 25), xPos, yPos + 4); xPos += colWidths[1];
      pdf.text(returnItem.customerPhone, xPos, yPos + 4); xPos += colWidths[2];
      pdf.text(returnItem.returnType === "bill" ? "FULL BILL" : "ITEM", xPos, yPos + 4); xPos += colWidths[3];
      pdf.setTextColor(239, 68, 68);
      pdf.text(`Rs. ${Math.round(parseFloat(returnItem.totalRefund || "0")).toLocaleString()}`, xPos, yPos + 4); xPos += colWidths[4];
      pdf.setTextColor(0, 0, 0);
      pdf.text((returnItem.reason || "-").substring(0, 30), xPos, yPos + 4); xPos += colWidths[5];
      pdf.text(returnItem.status.toUpperCase(), xPos, yPos + 4);
      yPos += 6;
    }

    if (auditReturns.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${auditReturns.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Returns-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Returns Audit Report has been downloaded." });
  };

  // Share Statement via WhatsApp (PDF file sharing)
  const shareStatementToWhatsApp = async (customer: ConsolidatedCustomer) => {
    const whatsappPhone = formatPhoneForWhatsApp(customer.customerPhone);
    
    if (!whatsappPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Customer phone number is invalid for WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const pdfBlob = generateStatementPDFBlob(customer);
    const fileName = `Statement-${customer.customerName.replace(/\s+/g, '_')}-${formatDateShort(new Date()).replace(/\//g, '-')}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Check Electron API
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.shareToWhatsApp) {
      try {
        await electronAPI.shareToWhatsApp(customer.customerPhone, {
          fileName: fileName,
          pdfData: await pdfBlob.arrayBuffer(),
          businessName: receiptSettings.businessName,
          totalAmount: Math.round(customer.totalOutstanding),
          customerName: customer.customerName,
        });
        toast({
          title: "Shared Successfully",
          description: "Statement sent to WhatsApp",
        });
        return;
      } catch (error) {
        console.log('Electron share failed, trying fallback');
      }
    }

    // Try Web Share API
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Statement - ${customer.customerName}`,
          text: `Account Statement from ${receiptSettings.businessName}`
        });
        toast({
          title: "Shared Successfully",
          description: "Statement shared via WhatsApp",
        });
        return;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.log('Web share failed, using text fallback');
        } else {
          return;
        }
      }
    }

    // Fallback: Text message
    const message = `*${receiptSettings.businessName}*\n*ACCOUNT STATEMENT*\n\n${customer.customerName}\n\n*Total:* Rs.${Math.round(customer.totalAmount).toLocaleString()}\n*Paid:* Rs.${Math.round(customer.totalPaid).toLocaleString()}\n*Outstanding:* Rs.${Math.round(customer.totalOutstanding).toLocaleString()}\n\n${receiptSettings.thankYou}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');
    
    toast({
      title: "WhatsApp Opening",
      description: "Statement details sent. Send PDF from your device.",
    });
  };

  if (showPinDialog) {
    return (
      <Dialog open={showPinDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center text-xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Audit PIN Verification
            </DialogTitle>
            <DialogDescription className="text-center">
              Enter your 4-digit PIN to access Audit Reports
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            {!hasPin?.hasPin && (
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

            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}

            {verifyPinMutation.isPending && (
              <div className="flex justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isLoading = colorsLoading || stockInLoading || stockOutLoading || salesLoading || paymentsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit Reports</h1>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48"
              data-testid="input-audit-search"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4">
          <TabsList className="h-12 flex-wrap">
            <TabsTrigger value="stock" className="flex items-center gap-2" data-testid="tab-stock-audit">
              <Package className="h-4 w-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="tab-sales-audit">
              <BarChart3 className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="unpaid" className="flex items-center gap-2" data-testid="tab-unpaid-audit">
              <CreditCard className="h-4 w-4" />
              Unpaid Bills
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2" data-testid="tab-payments-audit">
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex items-center gap-2" data-testid="tab-returns-audit">
              <RotateCcw className="h-4 w-4" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-audit-settings">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stock" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Stock In</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">+{stockSummary.totalIn}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Stock Out</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">-{stockSummary.totalOut}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stockSummary.currentStock}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Movements</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{filteredStockMovements.length}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-40" data-testid="select-company-filter">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-40" data-testid="select-product-filter">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.productName}>{product.productName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger className="w-36" data-testid="select-movement-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="IN">Stock In</SelectItem>
                <SelectItem value="OUT">Stock Out</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button onClick={downloadStockAuditPDF} data-testid="button-download-stock-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredStockMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No stock movements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStockMovements.slice(0, 50).map((m) => (
                      <TableRow key={m.id} data-testid={`row-stock-${m.id}`}>
                        <TableCell>{formatDateShort(m.date)}</TableCell>
                        <TableCell>
                          <Badge variant={m.type === "IN" ? "default" : "destructive"}>
                            {m.type === "IN" ? "Stock In" : "Stock Out"}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.company}</TableCell>
                        <TableCell>{m.product}</TableCell>
                        <TableCell>{m.variant}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{m.colorCode}</span>
                          <span className="text-muted-foreground ml-1">{m.colorName}</span>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${m.type === "IN" ? "text-green-600" : "text-red-600"}`}>
                          {m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`}
                        </TableCell>
                        <TableCell className="text-sm">{m.reference}</TableCell>
                        <TableCell>{m.customer || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">Rs. {Math.round(salesSummary.totalSales).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">Rs. {Math.round(salesSummary.totalPaid).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">Rs. {Math.round(salesSummary.totalOutstanding).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bills</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{salesSummary.totalBills} ({salesSummary.paidBills} paid)</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end">
            <Button onClick={downloadSalesAuditPDF} data-testid="button-download-sales-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No sales found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.slice(0, 50).map((sale) => {
                      const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
                      return (
                        <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                          <TableCell>{formatDateShort(sale.createdAt)}</TableCell>
                          <TableCell className="font-mono">#{sale.id.slice(0, 8).toUpperCase()}</TableCell>
                          <TableCell>
                            {sale.isManualBalance && (
                              <Badge variant="outline" className="mr-2 text-xs">Manual</Badge>
                            )}
                            {sale.customerName}
                          </TableCell>
                          <TableCell>{sale.customerPhone}</TableCell>
                          <TableCell className="text-right font-medium">
                            Rs. {Math.round(parseFloat(sale.totalAmount)).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">
                            Rs. {Math.round(parseFloat(sale.amountPaid)).toLocaleString()}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${outstanding > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            Rs. {Math.round(outstanding).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              sale.paymentStatus === "paid" ? "default" :
                              sale.paymentStatus === "partial" ? "secondary" : "destructive"
                            }>
                              {sale.paymentStatus.toUpperCase()}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid So Far</p>
                    {unpaidLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        Rs. {unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.amountPaid), 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => downloadUnpaidPDF()} data-testid="button-download-unpaid-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Bill Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : unpaidBills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No unpaid bills found
                      </TableCell>
                    </TableRow>
                  ) : (
                    unpaidBills.map((bill) => {
                      const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
                      return (
                        <TableRow key={bill.id}>
                          <TableCell>{formatDateShort(bill.createdAt)}</TableCell>
                          <TableCell>
                            {bill.isManualBalance && <Badge variant="outline" className="mr-2 text-xs">Manual</Badge>}
                            {bill.customerName}
                          </TableCell>
                          <TableCell>{bill.customerPhone}</TableCell>
                          <TableCell className="text-right font-medium">Rs. {Math.round(parseFloat(bill.totalAmount)).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">Rs. {Math.round(parseFloat(bill.amountPaid)).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-red-600 dark:text-red-400">Rs. {Math.round(outstanding).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={bill.paymentStatus === "partial" ? "secondary" : "destructive"}>
                              {bill.paymentStatus.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{bill.dueDate ? formatDateShort(new Date(bill.dueDate)) : "-"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Collected</p>
                    {auditPaymentsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        Rs. {auditPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Payments</p>
                    {auditPaymentsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{auditPayments.length}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cash Payments</p>
                    {auditPaymentsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {auditPayments.filter(p => p.paymentMethod === "cash").length}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Other Methods</p>
                    {auditPaymentsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {auditPayments.filter(p => p.paymentMethod !== "cash").length}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => downloadPaymentsPDF()} data-testid="button-download-payments-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Prev Balance</TableHead>
                    <TableHead className="text-right">New Balance</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditPaymentsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : auditPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payment history found
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDateShort(payment.createdAt)}</TableCell>
                        <TableCell>{payment.sale?.customerName || payment.customerPhone}</TableCell>
                        <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                          Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.paymentMethod.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right">Rs. {Math.round(parseFloat(payment.previousBalance)).toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                    <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Returns</p>
                    {returnsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{auditReturns.length}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Refunded</p>
                    {returnsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        Rs. {auditReturns.reduce((sum, r) => sum + parseFloat(r.totalRefund || "0"), 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bill Returns</p>
                    {returnsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {auditReturns.filter(r => r.returnType === "bill").length}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Item Returns</p>
                    {returnsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {auditReturns.filter(r => r.returnType === "item").length}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => downloadReturnsPDF()} data-testid="button-download-returns-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Refund Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : auditReturns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No returns found
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditReturns.map((returnItem) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>{formatDateShort(returnItem.createdAt)}</TableCell>
                        <TableCell>{returnItem.customerName}</TableCell>
                        <TableCell>{returnItem.customerPhone}</TableCell>
                        <TableCell>
                          <Badge variant={returnItem.returnType === "bill" ? "default" : "secondary"}>
                            {returnItem.returnType === "bill" ? "FULL BILL" : "ITEM"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                          Rs. {Math.round(parseFloat(returnItem.totalRefund || "0")).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{returnItem.reason || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={returnItem.status === "completed" ? "default" : "secondary"}>
                            {returnItem.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-auto p-4">
          <div className="max-w-md mx-auto">
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

            <Card className="mt-4">
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
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Access Control Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Control which actions are allowed in the application. Disabled actions will be hidden throughout the software.
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
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-red-500" />
                            Delete Stock History
                          </Label>
                          <p className="text-xs text-muted-foreground">Allow deleting stock in/out history</p>
                        </div>
                        <Switch
                          checked={appSettings?.permStockHistoryDelete ?? true}
                          onCheckedChange={(checked) => handlePermissionChange("permStockHistoryDelete", checked)}
                          data-testid="switch-perm-stock-history-delete"
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

                  <div>
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Database className="h-4 w-4" />
                      System Access
                    </h4>
                    <div className="space-y-3 pl-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-purple-500" />
                            Database Access
                          </Label>
                          <p className="text-xs text-muted-foreground">Access database tab in settings (requires PIN)</p>
                        </div>
                        <Switch
                          checked={appSettings?.permDatabaseAccess ?? true}
                          onCheckedChange={(checked) => handlePermissionChange("permDatabaseAccess", checked)}
                          data-testid="switch-perm-database-access"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Cloud Database Sync
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Connect to a cloud PostgreSQL database (Neon, Supabase) to sync your data across multiple devices.
                </p>

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
                          setCloudUrl(e.target.value);
                          setCloudConnectionStatus("idle");
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
                      Get your connection URL from Neon (neon.tech) or Supabase (supabase.com)
                    </p>
                  </div>

                  <Button
                    onClick={handleTestConnection}
                    variant="outline"
                    className="w-full"
                    disabled={cloudConnectionStatus === "testing" || !cloudUrl.trim()}
                    data-testid="button-test-connection"
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
                    {cloudConnectionStatus === "testing" ? "Testing..." : 
                     cloudConnectionStatus === "success" ? "Connected" :
                     cloudConnectionStatus === "error" ? "Connection Failed - Retry" :
                     "Test Connection"}
                  </Button>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Sync Actions
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleExportToCloud}
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
                        className="flex items-center gap-2"
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
                        <strong>Export:</strong> Sends your local data to cloud (overwrites cloud data)
                      </p>
                      <p className="flex items-center gap-2">
                        <Download className="h-3 w-3" />
                        <strong>Import:</strong> Downloads cloud data to local (overwrites local data)
                      </p>
                    </div>

                    {lastExportCounts && (
                      <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          Last Export: {lastExportCounts.products} products, {lastExportCounts.variants} variants, 
                          {lastExportCounts.colors} colors, {lastExportCounts.sales} sales
                        </p>
                      </div>
                    )}

                    {lastImportCounts && (
                      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Last Import: {lastImportCounts.products} products, {lastImportCounts.variants} variants, 
                          {lastImportCounts.colors} colors, {lastImportCounts.sales} sales
                        </p>
                      </div>
                    )}

                    {appSettings?.lastSyncTime && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Last sync: {format(new Date(appSettings.lastSyncTime), "dd/MM/yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}