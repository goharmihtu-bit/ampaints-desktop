import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, MoreVertical, Trash2, Eye, Printer, RotateCcw, Calendar, TrendingUp, Wallet, AlertCircle, ChevronRight } from "lucide-react";
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
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDeleteSales } = usePermissions();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: returns = [] } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
  });

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

    if (customerSearchQuery) {
      const query = customerSearchQuery.toLowerCase().trim();
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
  }, [sales, customerSearchQuery, dateFilter, startDate, endDate]);

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
    <div className="glass-page">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        
        {/* Header Section - Clean & Minimal */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight" data-testid="text-sales-title">
              Sales
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sales.length} transactions
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={refreshSales}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-refresh-sales"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Glassy Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="glass-metric">
            <div className="flex items-center gap-3">
              <div className="metric-icon-blue">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
                <p className="text-lg font-semibold tabular-nums">
                  {totals.count}
                </p>
              </div>
            </div>
          </div>
          
          <div className="glass-metric">
            <div className="flex items-center gap-3">
              <div className="metric-icon-green">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Amount</p>
                <p className="text-lg font-semibold tabular-nums">
                  Rs. {Math.round(totals.totalAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="glass-metric">
            <div className="flex items-center gap-3">
              <div className="metric-icon-green">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Received</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  Rs. {Math.round(totals.totalPaid).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="glass-metric">
            <div className="flex items-center gap-3">
              <div className="metric-icon-red">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Outstanding</p>
                <p className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
                  Rs. {Math.round(totals.totalDue).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="glass-metric">
            <div className="flex items-center gap-3">
              <div className="metric-icon-orange">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Refunds</p>
                <p className="text-lg font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                  Rs. {Math.round(refundTotals.totalRefund).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{refundTotals.count} returns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Glassy Filter Bar */}
        <div className="glass-toolbar">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-9 bg-white/50 dark:bg-zinc-800/50 border-white/30 dark:border-zinc-700/50 h-9"
                data-testid="input-sales-search"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-white/50 dark:bg-zinc-800/50 border-white/30 dark:border-zinc-700/50 h-9" data-testid="select-date-filter">
                  <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {dateFilter === "custom" && (
                <>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 min-w-[120px] bg-white/50 dark:bg-zinc-800/50 border-white/30 dark:border-zinc-700/50 h-9 text-xs"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 min-w-[120px] bg-white/50 dark:bg-zinc-800/50 border-white/30 dark:border-zinc-700/50 h-9 text-xs"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sales List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-surface p-4">
                <Skeleton className="h-5 w-32 mb-3" />
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="glass-surface p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No sales found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {customerSearchQuery || dateFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Sales will appear here"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSales.map((sale) => {
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
                  className="group glass-card-hover p-4"
                  data-testid={`card-sale-${sale.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left - Customer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground truncate">
                          {sale.customerName}
                        </span>
                        {getPaymentStatusBadge(sale.paymentStatus)}
                        {saleReturns.length > 0 && (
                          <span className="status-return">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {saleReturns.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono">{sale.customerPhone}</span>
                        <span className="opacity-50">|</span>
                        <span>{formatDateShort(sale.createdAt)}</span>
                      </div>
                    </div>

                    {/* Center - Amount Info */}
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                        <p className="font-semibold tabular-nums">Rs. {totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</p>
                        <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          Rs. {amountPaid.toLocaleString()}
                        </p>
                      </div>
                      {amountDue > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</p>
                          <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                            Rs. {amountDue.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {totalRefund > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Refund</p>
                          <p className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                            Rs. {Math.round(totalRefund).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Mobile Amount Info */}
                    <div className="sm:hidden text-right">
                      <p className="font-semibold tabular-nums">Rs. {totalAmount.toLocaleString()}</p>
                      {amountDue > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">
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
                          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="text-xs mr-1">View</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
        )}

        {/* Footer Summary */}
        {filteredSales.length > 0 && (
          <div className="glass-footer">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Showing {filteredSales.length} of {sales.length}
                {dateFilter !== "all" && <span className="opacity-60"> • {dateFilter}</span>}
              </span>
              <div className="flex items-center gap-4 font-medium">
                <span className="tabular-nums">
                  Total: <span className="text-foreground">Rs. {Math.round(totals.totalAmount).toLocaleString()}</span>
                </span>
                {totals.totalDue > 0 && (
                  <span className="tabular-nums text-red-600 dark:text-red-400">
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
        <AlertDialogContent className="glass-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale for <strong>{saleToDelete?.customerName}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Delete all items from this sale</li>
                <li>Restore stock quantities to inventory</li>
                <li>Delete all payment history for this sale</li>
              </ul>
              <br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
