import { useState, useMemo, useDeferredValue } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, MoreVertical, Trash2, Eye, Printer, RotateCcw, Calendar, TrendingUp, Wallet, AlertCircle, ChevronRight, Receipt } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  amountPaid: string;
  paymentStatus: string;
  createdAt: string;
}

interface Return {
  id: string;
  saleId: string | null;
  customerName: string;
  customerPhone: string;
  returnType: string;
  totalRefund: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

export default function Sales() {
  const { formatDateShort } = useDateFormat();
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);

  const debouncedSearchQuery = useDebounce(customerSearchQuery, 300);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDeleteSales } = usePermissions();

  const { data: salesRaw = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const sales = useDeferredValue(salesRaw);

  const { data: returnsRaw = [] } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
  });

  const returns = useDeferredValue(returnsRaw);

  const returnsBySaleId = useMemo(() => {
    const map = new Map<string, Return[]>();
    returns.forEach((ret) => {
      if (ret.saleId) {
        const existing = map.get(ret.saleId) || [];
        existing.push(ret);
        map.set(ret.saleId, existing);
      }
    });
    return map;
  }, [returns]);

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      return await apiRequest("DELETE", `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Sale deleted successfully" });
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete sale", 
        description: error.message || "Permission denied or sale not found",
        variant: "destructive" 
      });
    },
  });

  const refreshSales = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    toast({ title: "Sales data refreshed" });
  };

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (saleToDelete) {
      deleteSaleMutation.mutate(saleToDelete.id);
    }
  };

  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((sale) => {
        const customerName = sale.customerName.toLowerCase();
        const customerPhone = sale.customerPhone.toLowerCase();
        return customerName.includes(query) || customerPhone.includes(query);
      });
    }

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
  }, [sales, debouncedSearchQuery, dateFilter, startDate, endDate]);

  const visibleSales = useMemo(() => {
    return filteredSales.slice(0, visibleLimit);
  }, [filteredSales, visibleLimit]);

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

  const refundTotals = useMemo(() => {
    return returns.reduce((acc, ret) => {
      if (ret.status === "completed") {
        const refund = parseFloat(ret.totalRefund) || 0;
        return {
          totalRefund: acc.totalRefund + refund,
          count: acc.count + 1
        };
      }
      return acc;
    }, {
      totalRefund: 0,
      count: 0
    });
  }, [returns]);

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="status-paid">Paid</span>;
      case "partial":
        return <span className="status-partial">Partial</span>;
      case "unpaid":
        return <span className="status-unpaid">Unpaid</span>;
      default:
        return <span className="status-partial">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight" data-testid="text-sales-title">
              Sales
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {sales.length} transactions recorded
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={refreshSales}
            className="border-slate-200 dark:border-slate-700"
            data-testid="button-refresh-sales"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {totals.count}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  Rs. {Math.round(totals.totalAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Received</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  Rs. {Math.round(totals.totalPaid).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Due</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
                  Rs. {Math.round(totals.totalDue).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Refunds</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono">
                  Rs. {Math.round(refundTotals.totalRefund).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500">{refundTotals.count} returns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by customer name or phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700"
                data-testid="input-sales-search"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-[150px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700" data-testid="select-date-filter">
                  <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {dateFilter === "custom" && (
                <>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[140px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-sm"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[140px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-sm"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-8 w-8 text-slate-400" />
              </div>
              <p className="font-medium text-slate-700 dark:text-slate-300">No sales found</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                {customerSearchQuery || dateFilter !== "all" 
                  ? "Try adjusting your filters" 
                  : "Sales will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {visibleSales.map((sale) => {
                  const totalFloat = parseFloat(sale.totalAmount);
                  const paidFloat = parseFloat(sale.amountPaid);
                  const totalAmount = Math.round(totalFloat);
                  const amountPaid = Math.round(paidFloat);
                  const amountDue = Math.round(totalFloat - paidFloat);
                  const saleReturns = returnsBySaleId.get(sale.id) || [];
                  const totalRefund = saleReturns.reduce((sum, r) => sum + parseFloat(r.totalRefund || "0"), 0);

                  return (
                    <div
                      key={sale.id}
                      className="group p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      data-testid={`card-sale-${sale.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Left - Customer Info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                              {sale.customerName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-800 dark:text-white truncate">
                                {sale.customerName}
                              </span>
                              <Badge 
                                variant="outline"
                                className={
                                  sale.paymentStatus === "paid"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : sale.paymentStatus === "partial"
                                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                }
                              >
                                {sale.paymentStatus.toUpperCase()}
                              </Badge>
                              {saleReturns.length > 0 && (
                                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  {saleReturns.length}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                              <span className="font-mono">{sale.customerPhone}</span>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <span>{formatDateShort(sale.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Center - Amount Info */}
                        <div className="hidden md:flex items-center gap-8 text-sm">
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Total</p>
                            <p className="font-bold text-slate-800 dark:text-white font-mono">Rs. {totalAmount.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Paid</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              Rs. {amountPaid.toLocaleString()}
                            </p>
                          </div>
                          {amountDue > 0 && (
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Due</p>
                              <p className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                                Rs. {amountDue.toLocaleString()}
                              </p>
                            </div>
                          )}
                          {totalRefund > 0 && (
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Refund</p>
                              <p className="font-bold text-orange-600 dark:text-orange-400 font-mono">
                                Rs. {Math.round(totalRefund).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Mobile Amount Info */}
                        <div className="md:hidden text-right">
                          <p className="font-bold text-slate-800 dark:text-white font-mono">Rs. {totalAmount.toLocaleString()}</p>
                          {amountDue > 0 && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                              Due: Rs. {amountDue.toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* Right - Actions */}
                        <div className="flex items-center gap-1">
                          <Link href={`/bill/${sale.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            >
                              <span className="text-xs mr-1 hidden sm:inline">View</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                data-testid={`button-sale-menu-${sale.id}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem asChild>
                                <Link href={`/bill/${sale.id}`} className="flex items-center gap-2 cursor-pointer">
                                  <Eye className="h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/bill/${sale.id}`} className="flex items-center gap-2 cursor-pointer">
                                  <Printer className="h-4 w-4" />
                                  Print Bill
                                </Link>
                              </DropdownMenuItem>
                              {canDeleteSales && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                                    onClick={() => handleDeleteClick(sale)}
                                    data-testid={`button-delete-sale-${sale.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Load More Button */}
              {filteredSales.length > visibleLimit && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                    className="border-slate-200 dark:border-slate-700"
                    data-testid="button-load-more-sales"
                  >
                    Load More ({filteredSales.length - visibleLimit} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Summary */}
        {filteredSales.length > 0 && (
          <div className="bg-white dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                Showing {visibleSales.length} of {filteredSales.length}
                {debouncedSearchQuery && <span className="text-slate-400"> (filtered from {sales.length})</span>}
                {dateFilter !== "all" && <span className="text-slate-400"> - {dateFilter}</span>}
              </span>
              <div className="flex items-center gap-4 font-medium">
                <span className="text-slate-700 dark:text-slate-300 font-mono">
                  Total: <span className="text-slate-900 dark:text-white">Rs. {Math.round(totals.totalAmount).toLocaleString()}</span>
                </span>
                {totals.totalDue > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-mono">
                    Due: Rs. {Math.round(totals.totalDue).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Delete Sale</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this sale for <strong className="text-slate-900 dark:text-white">{saleToDelete?.customerName}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Delete all items from this sale</li>
                <li>Restore stock quantities to inventory</li>
                <li>Delete all payment history for this sale</li>
              </ul>
              <br />
              <strong className="text-rose-600 dark:text-rose-400">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleteSaleMutation.isPending}
            >
              {deleteSaleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
