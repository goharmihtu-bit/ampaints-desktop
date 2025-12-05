import { useState, useMemo, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";

const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  BarChart3,
  RotateCcw,
  Percent,
  AlertTriangle,
  DollarSign,
  TrendingUp as TrendingUpIcon,
  PieChart,
  Target,
  Activity,
  Banknote,
  Clock,
  Users,
  Filter,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "wouter";
import type { Sale, PaymentHistory, Return, SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, subDays } from "date-fns";
import { useDateFormat } from "@/hooks/use-date-format";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

interface ReturnStats {
  totalReturns: number;
  totalRefunded: number;
  itemReturns: number;
  billReturns: number;
}

type SortField = "date" | "amount" | "customer";
type SortDirection = "asc" | "desc";

// Date presets for quick filtering
const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last7days" },
  { label: "Last 30 days", value: "last30days" },
  { label: "This month", value: "thismonth" },
  { label: "Last month", value: "lastmonth" },
  { label: "Custom", value: "custom" },
] as const;

export default function Reports() {
  const { formatDateShort, parseDate: parseDateFromHook } = useDateFormat();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<string>("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: allSalesRaw = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    refetchOnWindowFocus: true,
  });

  const { data: paymentHistoryRaw = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    refetchOnWindowFocus: true,
  });

  const { data: returnsRaw = [], isLoading: returnsLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
    refetchOnWindowFocus: true,
  });

  const allSales = useDeferredValue(allSalesRaw);
  const paymentHistory = useDeferredValue(paymentHistoryRaw);
  const returns = useDeferredValue(returnsRaw);

  const parseDate = (dateStr: string | Date | null): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) {
        return parseISO(dateStr);
      } else {
        const [day, month, year] = parts.map(Number);
        return new Date(year, month - 1, day);
      }
    }
    return new Date(dateStr);
  };

  const formatDisplayDate = (dateStr: string | Date | null): string => {
    return formatDateShort(dateStr);
  };

  const applyDatePreset = (preset: string) => {
    const today = new Date();
    const todayStart = startOfDay(today);
    
    switch (preset) {
      case "today":
        setDateFrom(format(todayStart, "yyyy-MM-dd"));
        setDateTo(format(todayStart, "yyyy-MM-dd"));
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        setDateFrom(format(yesterday, "yyyy-MM-dd"));
        setDateTo(format(yesterday, "yyyy-MM-dd"));
        break;
      case "last7days":
        setDateFrom(format(subDays(today, 6), "yyyy-MM-dd"));
        setDateTo(format(todayStart, "yyyy-MM-dd"));
        break;
      case "last30days":
        setDateFrom(format(subDays(today, 29), "yyyy-MM-dd"));
        setDateTo(format(todayStart, "yyyy-MM-dd"));
        break;
      case "thismonth":
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(format(firstDayOfMonth, "yyyy-MM-dd"));
        setDateTo(format(todayStart, "yyyy-MM-dd"));
        break;
      case "lastmonth":
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFrom(format(firstDayOfLastMonth, "yyyy-MM-dd"));
        setDateTo(format(lastDayOfLastMonth, "yyyy-MM-dd"));
        break;
      case "custom":
        // Keep current custom dates
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
    setDatePreset(preset);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setDatePreset("");
    setPaymentStatusFilter("all");
    setShowAdvancedFilters(false);
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || paymentStatusFilter !== "all";

  // Calculate filtered data (same as before, keeping your existing logic)
  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.customerName.toLowerCase().includes(query) ||
          sale.customerPhone.includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isBefore(saleDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isAfter(saleDate, toDate);
      });
    }

    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((sale) => sale.paymentStatus === paymentStatusFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "customer":
          comparison = a.customerName.localeCompare(b.customerName);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [allSales, debouncedSearchQuery, dateFrom, dateTo, paymentStatusFilter, sortField, sortDirection]);
  
  const visibleSales = useMemo(() => {
    return filteredSales.slice(0, visibleLimit);
  }, [filteredSales, visibleLimit]);

  const filteredPayments = useMemo(() => {
    let filtered = [...paymentHistory];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (payment) =>
          payment.customerPhone.includes(query) ||
          (payment.sale?.customerName?.toLowerCase().includes(query))
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isBefore(paymentDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isAfter(paymentDate, toDate);
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case "customer":
          const nameA = a.sale?.customerName || "";
          const nameB = b.sale?.customerName || "";
          comparison = nameA.localeCompare(nameB);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [paymentHistory, debouncedSearchQuery, dateFrom, dateTo, sortField, sortDirection]);
  
  const visiblePayments = useMemo(() => {
    return filteredPayments.slice(0, visibleLimit);
  }, [filteredPayments, visibleLimit]);

  const filteredReturns = useMemo(() => {
    let filtered = [...returns];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (ret) =>
          ret.customerName.toLowerCase().includes(query) ||
          ret.customerPhone.includes(query) ||
          ret.id.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter((ret) => {
        const returnDate = parseDate(ret.createdAt);
        return returnDate && !isBefore(returnDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter((ret) => {
        const returnDate = parseDate(ret.createdAt);
        return returnDate && !isAfter(returnDate, toDate);
      });
    }

    filtered.sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      const comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [returns, debouncedSearchQuery, dateFrom, dateTo, sortDirection]);
  
  const visibleReturns = useMemo(() => {
    return filteredReturns.slice(0, visibleLimit);
  }, [filteredReturns, visibleLimit]);

  // Keep all your existing useMemo calculations...
  const unpaidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus !== "paid");
  }, [filteredSales]);

  const paidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus === "paid");
  }, [filteredSales]);

  const filteredSalesTotal = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [filteredSales]);

  const filteredSalesPaid = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [filteredSales]);

  const filteredSalesOutstanding = useMemo(() => {
    return filteredSalesTotal - filteredSalesPaid;
  }, [filteredSalesTotal, filteredSalesPaid]);

  const unpaidSalesTotal = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [unpaidSales]);

  const unpaidSalesPaid = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [unpaidSales]);

  const unpaidSalesOutstanding = useMemo(() => {
    return unpaidSalesTotal - unpaidSalesPaid;
  }, [unpaidSalesTotal, unpaidSalesPaid]);

  const filteredPaymentsTotal = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }, [filteredPayments]);

  const filteredReturnsTotal = useMemo(() => {
    return filteredReturns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
  }, [filteredReturns]);

  const returnStats: ReturnStats = useMemo(() => {
    return {
      totalReturns: filteredReturns.length,
      totalRefunded: filteredReturnsTotal,
      itemReturns: filteredReturns.filter((ret) => ret.returnType === "item").length,
      billReturns: filteredReturns.filter((ret) => ret.returnType === "full_bill").length,
    };
  }, [filteredReturns, filteredReturnsTotal]);

  const stats = useMemo(() => {
    const totalSalesAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalPaidAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
    const totalUnpaidAmount = totalSalesAmount - totalPaidAmount;
    const totalRecoveryPayments = paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    const totalReturnsAmount = returns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    const returnsCount = returns.length;
    
    const unpaidBillsCount = allSales.filter((sale) => sale.paymentStatus !== "paid").length;
    const paidBillsCount = allSales.filter((sale) => sale.paymentStatus === "paid").length;
    const totalBillsCount = allSales.length;

    const uniqueCustomers = new Set(allSales.map((sale) => sale.customerPhone)).size;

    return {
      totalSalesAmount,
      totalPaidAmount,
      totalUnpaidAmount,
      totalRecoveryPayments,
      totalReturnsAmount,
      returnsCount,
      unpaidBillsCount,
      paidBillsCount,
      totalBillsCount,
      totalPaymentRecords: paymentHistory.length,
      uniqueCustomers,
    };
  }, [allSales, paymentHistory, returns]);

  const totalCollectedAmount = useMemo(() => {
    return filteredSalesPaid + filteredPaymentsTotal;
  }, [filteredSalesPaid, filteredPaymentsTotal]);

  const collectionRate = useMemo(() => {
    return filteredSalesTotal > 0 ? (totalCollectedAmount / filteredSalesTotal) * 100 : 0;
  }, [filteredSalesTotal, totalCollectedAmount]);

  const refundRate = useMemo(() => {
    return filteredSalesTotal > 0 ? (filteredReturnsTotal / filteredSalesTotal) * 100 : 0;
  }, [filteredSalesTotal, filteredReturnsTotal]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0 h-5 border border-emerald-200 dark:border-emerald-700">Paid</Badge>;
      case "partial":
        return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs px-2 py-0 h-5 border border-amber-200 dark:border-amber-700">Partial</Badge>;
      case "unpaid":
        return <Badge className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs px-2 py-0 h-5 border border-rose-200 dark:border-rose-700">Unpaid</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0 h-5">{status}</Badge>;
    }
  };

  const getReturnTypeBadge = (type: string) => {
    switch (type) {
      case "full_bill":
        return <Badge className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs px-2 py-0 h-5 border border-rose-200 dark:border-rose-700">Full Bill</Badge>;
      case "item":
        return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs px-2 py-0 h-5 border border-amber-200 dark:border-amber-700">Item</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0 h-5">{type}</Badge>;
    }
  };

  const TableSummary = ({ tab }: { tab: string }) => {
    // Keep existing TableSummary implementation...
    switch (tab) {
      case "all-sales":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredSales.length}</span> bills
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {filteredSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {filteredSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {filteredSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "unpaid-bills":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{unpaidSales.length}</span> unpaid bills
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Bill Total:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {unpaidSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {unpaidSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {unpaidSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "recovery-payments":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredPayments.length}</span> payment records
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total Recovery:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {filteredPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "returns":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredReturns.length}</span> returns
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total Refunded:</span>
                <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  {filteredReturnsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Item Returns:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {returnStats.itemReturns}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Bill Returns:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {returnStats.billReturns}
                </span>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const isLoading = salesLoading || historyLoading || returnsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="p-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight" data-testid="text-reports-title">
                  Financial Reports
                </h1>
                <p className="text-white/70 text-xs">Real-time financial overview and analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                className="text-white/80 hover:text-white hover:bg-white/10 text-xs"
              >
                {showDetailedMetrics ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                {showDetailedMetrics ? "Hide Details" : "Show Details"}
              </Button>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5 blur-lg" />
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/5 blur-md" />
        </div>

        {/* Key Metrics - Compact Glass Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs hover:shadow-sm transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Sales</span>
                <div className="p-1.5 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
                  <Receipt className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {Math.round(stats.totalSalesAmount).toLocaleString("en-IN")}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">{stats.totalBillsCount} bills</p>
                <Badge variant="outline" className="text-xs h-5 px-1.5 bg-white/50 dark:bg-zinc-800/50">
                  {stats.uniqueCustomers} customers
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs hover:shadow-sm transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Collected</span>
                <div className="p-1.5 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg">
                  <TrendingUpIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {Math.round(stats.totalPaidAmount).toLocaleString("en-IN")}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">{stats.paidBillsCount} paid bills</p>
                <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                  {stats.totalSalesAmount > 0 ? ((stats.totalPaidAmount / stats.totalSalesAmount) * 100).toFixed(1) : "0.0"}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs hover:shadow-sm transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Outstanding</span>
                <div className="p-1.5 bg-rose-100/50 dark:bg-rose-900/20 rounded-lg">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              <div className="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                {Math.round(stats.totalUnpaidAmount).toLocaleString("en-IN")}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">{stats.unpaidBillsCount} unpaid bills</p>
                <div className="text-xs text-rose-500 dark:text-rose-400 font-medium">
                  {stats.totalPaymentRecords} payments
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs hover:shadow-sm transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Revenue</span>
                <div className="p-1.5 bg-purple-100/50 dark:bg-purple-900/20 rounded-lg">
                  <Activity className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                {Math.round(stats.totalSalesAmount - stats.totalReturnsAmount).toLocaleString("en-IN")}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">{stats.returnsCount} returns</p>
                <div className="text-xs text-rose-500 dark:text-rose-400 font-medium">
                  {stats.totalReturnsAmount.toLocaleString("en-IN")} refunded
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Filters Section */}
        <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs">
          <CardContent className="p-5">
            <div className="flex flex-col space-y-4">
              {/* Main Filter Row */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search customers, phone numbers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm h-10 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50 rounded-lg focus:ring-2 focus:ring-blue-500/20"
                      data-testid="input-search"
                    />
                  </div>

                  {/* Date Presets */}
                  <div className="flex items-center gap-2">
                    <Select value={datePreset} onValueChange={applyDatePreset}>
                      <SelectTrigger className="w-36 text-sm h-10 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50 rounded-lg">
                        <SelectValue placeholder="Date range" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                        <SelectItem value="" className="text-sm">All time</SelectItem>
                        {DATE_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value} className="text-sm">
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Advanced Filters Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="text-xs h-9 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                    {showAdvancedFilters ? "Hide Filters" : "More Filters"}
                  </Button>

                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters} 
                      data-testid="button-clear-filters"
                      className="text-xs h-9 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>

              {/* Advanced Filters - Collapsible */}
              {showAdvancedFilters && (
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 animate-in slide-in-from-top duration-200">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Custom Date Range */}
                    <div className="flex-1">
                      <Label htmlFor="date-range" className="text-xs font-medium mb-2 block text-slate-600 dark:text-slate-400">
                        Custom Date Range
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="date-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                              setDateFrom(e.target.value);
                              setDatePreset("custom");
                            }}
                            className="pl-9 text-sm h-9 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50 rounded-lg"
                            data-testid="input-date-from"
                          />
                        </div>
                        <span className="text-xs text-slate-400">to</span>
                        <div className="relative flex-1">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="date-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                              setDateTo(e.target.value);
                              setDatePreset("custom");
                            }}
                            className="pl-9 text-sm h-9 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50 rounded-lg"
                            data-testid="input-date-to"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Payment Status Filter */}
                    {(activeTab === "all-sales" || activeTab === "unpaid-bills") && (
                      <div className="md:w-48">
                        <Label htmlFor="payment-status" className="text-xs font-medium mb-2 block text-slate-600 dark:text-slate-400">
                          Payment Status
                        </Label>
                        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                          <SelectTrigger 
                            id="payment-status"
                            className="text-sm h-9 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50 rounded-lg" 
                            data-testid="select-payment-status"
                          >
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                            <SelectItem value="all" className="text-sm">All Status</SelectItem>
                            <SelectItem value="paid" className="text-sm">Paid</SelectItem>
                            <SelectItem value="partial" className="text-sm">Partial</SelectItem>
                            <SelectItem value="unpaid" className="text-sm">Unpaid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Tabs Navigation */}
        <div className="relative">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="sticky top-0 z-10 bg-gradient-to-b from-slate-50/95 via-white/95 to-slate-50/95 dark:from-zinc-950/95 dark:via-zinc-950/95 dark:to-zinc-900/95 backdrop-blur-sm py-2 -mx-6 px-6">
              <TabsList className="grid w-full grid-cols-5 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm rounded-lg p-0.5 border border-slate-200/50 dark:border-slate-800/50 shadow-xs">
                <TabsTrigger 
                  value="overview" 
                  data-testid="tab-overview"
                  className={cn(
                    "rounded-md text-xs py-2.5 transition-all",
                    "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
                    "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/50 dark:data-[state=active]:border-slate-700/50",
                    "hover:bg-white/20 dark:hover:bg-zinc-800/20"
                  )}
                >
                  <PieChart className="h-3.5 w-3.5 mr-1.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="all-sales" 
                  data-testid="tab-all-sales"
                  className={cn(
                    "rounded-md text-xs py-2.5 transition-all",
                    "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
                    "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/50 dark:data-[state=active]:border-slate-700/50",
                    "hover:bg-white/20 dark:hover:bg-zinc-800/20"
                  )}
                >
                  <Receipt className="h-3.5 w-3.5 mr-1.5" />
                  <span className="truncate">Sales</span>
                  <Badge variant="outline" className="ml-1.5 h-4 w-4 p-0 text-[10px] bg-white/50 dark:bg-zinc-800/50">
                    {filteredSales.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="unpaid-bills" 
                  data-testid="tab-unpaid-bills"
                  className={cn(
                    "rounded-md text-xs py-2.5 transition-all",
                    "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
                    "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/50 dark:data-[state=active]:border-slate-700/50",
                    "hover:bg-white/20 dark:hover:bg-zinc-800/20"
                  )}
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  <span className="truncate">Unpaid</span>
                  <Badge variant="outline" className="ml-1.5 h-4 w-4 p-0 text-[10px] bg-rose-100/50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                    {unpaidSales.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="recovery-payments" 
                  data-testid="tab-recovery-payments"
                  className={cn(
                    "rounded-md text-xs py-2.5 transition-all",
                    "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
                    "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/50 dark:data-[state=active]:border-slate-700/50",
                    "hover:bg-white/20 dark:hover:bg-zinc-800/20"
                  )}
                >
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  <span className="truncate">Recovery</span>
                  <Badge variant="outline" className="ml-1.5 h-4 w-4 p-0 text-[10px] bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {filteredPayments.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="returns" 
                  data-testid="tab-returns"
                  className={cn(
                    "rounded-md text-xs py-2.5 transition-all",
                    "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
                    "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/50 dark:data-[state=active]:border-slate-700/50",
                    "hover:bg-white/20 dark:hover:bg-zinc-800/20"
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  <span className="truncate">Returns</span>
                  <Badge variant="outline" className="ml-1.5 h-4 w-4 p-0 text-[10px] bg-amber-100/50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    {filteredReturns.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="animate-in fade-in-50 duration-200">
              <div className="space-y-4">
                {/* Financial Summary Card */}
                <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg">
                          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Financial Performance</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Based on current filters</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs h-6 px-2 bg-white/50 dark:bg-zinc-800/50">
                        <Filter className="h-3 w-3 mr-1" />
                        {filteredSales.length} bills
                      </Badge>
                    </div>
                    
                    {/* Top Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                      {/* Collected Card */}
                      <Card className="border border-emerald-200/50 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50/30 to-white/30 dark:from-emerald-900/10 dark:to-zinc-900/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-100/50 dark:bg-emerald-900/20 rounded">
                                <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Total Collected</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Paid + Recovery</p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] h-5">
                              {collectionRate.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {totalCollectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </div>
                          <div className="flex justify-between mt-3 text-xs">
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Paid</div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                {filteredSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Recovery</div>
                              <div className="font-medium text-purple-600 dark:text-purple-400 tabular-nums">
                                {filteredPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Outstanding Card */}
                      <Card className="border border-rose-200/50 dark:border-rose-900/30 bg-gradient-to-br from-rose-50/30 to-white/30 dark:from-rose-900/10 dark:to-zinc-900/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-rose-100/50 dark:bg-rose-900/20 rounded">
                                <Clock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Outstanding</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Pending collection</p>
                              </div>
                            </div>
                            <Badge className="bg-rose-100/80 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] h-5">
                              {unpaidSales.length} bills
                            </Badge>
                          </div>
                          <div className="text-xl font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                            {filteredSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </div>
                          <div className="flex justify-between mt-3 text-xs">
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Partial</div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {filteredSales.filter(s => s.paymentStatus === "partial").length}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Unpaid</div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {filteredSales.filter(s => s.paymentStatus === "unpaid").length}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Net Sales Card */}
                      <Card className="border border-blue-200/50 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/30 to-white/30 dark:from-blue-900/10 dark:to-zinc-900/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-100/50 dark:bg-blue-900/20 rounded">
                                <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">Net Sales</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">After returns</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] h-5">
                              {returnStats.totalReturns} returns
                            </Badge>
                          </div>
                          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                            {(filteredSalesTotal - filteredReturnsTotal).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </div>
                          <div className="flex justify-between mt-3 text-xs">
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Gross Sales</div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                {filteredSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 dark:text-slate-400">Refunds</div>
                              <div className="font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                                {filteredReturnsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detailed Metrics - Toggleable */}
                    {showDetailedMetrics && (
                      <>
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                          <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded">
                                <Receipt className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sales</span>
                            </div>
                            <div className="text-base font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                              {filteredSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {filteredSales.length} bills
                            </div>
                          </div>

                          <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-100/50 dark:bg-emerald-900/20 rounded">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Paid</span>
                            </div>
                            <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {filteredSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {paidSales.length} paid bills
                            </div>
                          </div>

                          <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-rose-100/50 dark:bg-rose-900/20 rounded">
                                <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Outstanding</span>
                            </div>
                            <div className="text-base font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                              {filteredSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {unpaidSales.length} unpaid
                            </div>
                          </div>

                          <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-purple-100/50 dark:bg-purple-900/20 rounded">
                                <Wallet className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Recovery</span>
                            </div>
                            <div className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                              {filteredPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {filteredPayments.length} payments
                            </div>
                          </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Collection Rate</span>
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {collectionRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, collectionRate)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Collected {totalCollectedAmount.toLocaleString("en-IN")} of {filteredSalesTotal.toLocaleString("en-IN")}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Refund Rate</span>
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                                {refundRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, refundRate)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {returnStats.totalReturns} returns totaling {filteredReturnsTotal.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Returns Analysis Card */}
                <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="p-2 bg-gradient-to-r from-rose-500/10 to-red-500/10 rounded-lg">
                        <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Returns Analysis</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Return metrics and impact</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-rose-100/50 dark:bg-rose-900/20 rounded">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Returns</span>
                          </div>
                          <div className="text-base font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                            {returnStats.totalReturns}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {returnStats.billReturns} bills, {returnStats.itemReturns} items
                          </div>
                        </div>

                        <div className="space-y-2 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-100/50 dark:bg-amber-900/20 rounded">
                              <DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Refunded</span>
                          </div>
                          <div className="text-base font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                            {returnStats.totalRefunded.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Filtered returns
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/40">
                        <div>
                          <span className="text-xs text-slate-600 dark:text-slate-400">Net Sales</span>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {(filteredSalesTotal - filteredReturnsTotal).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-600 dark:text-slate-400">Refund Impact</span>
                          <div className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                            {refundRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* All Sales Tab */}
            <TabsContent value="all-sales" className="animate-in fade-in-50 duration-200">
              <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Customer <SortIcon field="customer" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Amount <SortIcon field="amount" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Paid</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Date <SortIcon field="date" />
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleSales.map((sale) => (
                        <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                          <TableCell className="py-2.5">
                            <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                              {sale.customerName}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                          <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                            {parseFloat(sale.totalAmount).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                            {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5">{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Receipt className="h-8 w-8 opacity-50" />
                              <p className="text-sm">No sales found matching your filters</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {filteredSales.length > visibleLimit && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                        data-testid="button-load-more-sales-reports"
                        className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                      >
                        Load More ({filteredSales.length - visibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                </div>
                <TableSummary tab="all-sales" />
              </Card>
            </TabsContent>

            {/* Unpaid Bills Tab */}
            <TabsContent value="unpaid-bills" className="animate-in fade-in-50 duration-200">
              <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Customer <SortIcon field="customer" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Bill Amount <SortIcon field="amount" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Paid</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Due Date</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Bill Date <SortIcon field="date" />
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidSales.map((sale) => (
                        <TableRow key={sale.id} data-testid={`row-unpaid-${sale.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                          <TableCell className="py-2.5">
                            <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                              {sale.customerName}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                          <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                            {parseFloat(sale.totalAmount).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-rose-600 dark:text-rose-400 font-medium tabular-nums">
                            {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5">{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.dueDate ? formatDisplayDate(sale.dueDate) : "Not set"}</TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                      {unpaidSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <CreditCard className="h-8 w-8 opacity-50" />
                              <p className="text-sm">No unpaid bills found matching your filters</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <TableSummary tab="unpaid-bills" />
              </Card>
            </TabsContent>

            {/* Recovery Payments Tab */}
            <TabsContent value="recovery-payments" className="animate-in fade-in-50 duration-200">
              <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Customer <SortIcon field="customer" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Payment <SortIcon field="amount" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Prev Balance</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">New Balance</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Method</TableHead>
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Date <SortIcon field="date" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePayments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                          <TableCell className="py-2.5">
                            <Link href={`/customer/${encodeURIComponent(payment.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                              {payment.sale?.customerName || "Unknown"}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{payment.customerPhone}</TableCell>
                          <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                            {parseFloat(payment.amount).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {parseFloat(payment.previousBalance).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                            {parseFloat(payment.newBalance).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge className="text-xs px-1.5 py-0 h-5 bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-0 capitalize">
                              {payment.paymentMethod || "cash"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(payment.createdAt)}</TableCell>
                          <TableCell className="py-2.5 max-w-[150px] truncate text-xs text-slate-500 dark:text-slate-400">
                            {payment.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredPayments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Wallet className="h-8 w-8 opacity-50" />
                              <p className="text-sm">No recovery payments found matching your filters</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {filteredPayments.length > visibleLimit && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                        data-testid="button-load-more-payments-reports"
                        className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                      >
                        Load More ({filteredPayments.length - visibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                </div>
                <TableSummary tab="recovery-payments" />
              </Card>
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns" className="animate-in fade-in-50 duration-200">
              <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                        <TableHead className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Date <SortIcon field="date" />
                          </Button>
                        </TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Return ID</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Customer</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Type</TableHead>
                        <TableHead className="py-3 text-right text-xs text-slate-600 dark:text-slate-400">Refund Amount</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Items</TableHead>
                        <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleReturns.map((ret) => (
                        <TableRow key={ret.id} data-testid={`row-return-${ret.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(ret.createdAt)}</TableCell>
                          <TableCell className="py-2.5 font-mono text-xs font-medium">#{ret.id.slice(0, 6).toUpperCase()}</TableCell>
                          <TableCell className="py-2.5 text-sm font-medium">{ret.customerName}</TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{ret.customerPhone}</TableCell>
                          <TableCell className="py-2.5">{getReturnTypeBadge(ret.returnType)}</TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                            {parseFloat(ret.totalRefund || "0").toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-slate-50/70 dark:bg-slate-800/70">
                              {ret.returnItems.length} items
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant={ret.status === "completed" ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-5 capitalize">
                              {ret.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredReturns.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <RotateCcw className="h-8 w-8 opacity-50" />
                              <p className="text-sm">No returns found matching your filters</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {filteredReturns.length > visibleLimit && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                        data-testid="button-load-more-returns-reports"
                        className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                      >
                        Load More ({filteredReturns.length - visibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                </div>
                <TableSummary tab="returns" />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}