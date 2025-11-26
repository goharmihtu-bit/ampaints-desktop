import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  IndianRupee,
  Receipt,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  FileText,
  Users,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Link } from "wouter";
import type { Sale, PaymentHistory } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useDateFormat } from "@/hooks/use-date-format";

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

type SortField = "date" | "amount" | "customer";
type SortDirection = "asc" | "desc";

export default function Reports() {
  const { formatDateShort, parseDate: parseDateFromHook } = useDateFormat();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: allSales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    refetchOnWindowFocus: true,
  });

  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    refetchOnWindowFocus: true,
  });

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

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPaymentStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || paymentStatusFilter !== "all";

  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
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
  }, [allSales, searchQuery, dateFrom, dateTo, paymentStatusFilter, sortField, sortDirection]);

  const filteredPayments = useMemo(() => {
    let filtered = [...paymentHistory];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
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
  }, [paymentHistory, searchQuery, dateFrom, dateTo, sortField, sortDirection]);

  const unpaidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus !== "paid");
  }, [filteredSales]);

  const paidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus === "paid");
  }, [filteredSales]);

  const stats = useMemo(() => {
    const totalSalesAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalPaidAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
    const totalUnpaidAmount = totalSalesAmount - totalPaidAmount;
    const totalRecoveryPayments = paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    const unpaidBillsCount = allSales.filter((sale) => sale.paymentStatus !== "paid").length;
    const paidBillsCount = allSales.filter((sale) => sale.paymentStatus === "paid").length;
    const totalBillsCount = allSales.length;

    const uniqueCustomers = new Set(allSales.map((sale) => sale.customerPhone)).size;

    return {
      totalSalesAmount,
      totalPaidAmount,
      totalUnpaidAmount,
      totalRecoveryPayments,
      unpaidBillsCount,
      paidBillsCount,
      totalBillsCount,
      totalPaymentRecords: paymentHistory.length,
      uniqueCustomers,
    };
  }, [allSales, paymentHistory]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Paid</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Partial</Badge>;
      case "unpaid":
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Unpaid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isLoading = salesLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">Financial Reports</h1>
          <p className="text-muted-foreground">Complete overview of sales, payments, and unpaid bills</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <Receipt className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <IndianRupee className="h-5 w-5" />
              {stats.totalSalesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalBillsCount} bills total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-paid-amount">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Amount</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1 text-green-600 dark:text-green-400">
              <IndianRupee className="h-5 w-5" />
              {stats.totalPaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.paidBillsCount} paid bills
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-unpaid-amount">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Amount</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1 text-red-600 dark:text-red-400">
              <IndianRupee className="h-5 w-5" />
              {stats.totalUnpaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.unpaidBillsCount} unpaid bills
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-recovery-payments">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recovery Payments</CardTitle>
            <Wallet className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <IndianRupee className="h-5 w-5" />
              {stats.totalRecoveryPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalPaymentRecords} payment records
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-auto"
                data-testid="input-date-from"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-auto"
                data-testid="input-date-to"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab !== "recovery-payments" && (
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-payment-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="all-sales" data-testid="tab-all-sales">
            <Receipt className="h-4 w-4 mr-2" />
            All Sales ({filteredSales.length})
          </TabsTrigger>
          <TabsTrigger value="unpaid-bills" data-testid="tab-unpaid-bills">
            <CreditCard className="h-4 w-4 mr-2" />
            Unpaid Bills ({unpaidSales.length})
          </TabsTrigger>
          <TabsTrigger value="recovery-payments" data-testid="tab-recovery-payments">
            <Wallet className="h-4 w-4 mr-2" />
            Recovery ({filteredPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Customers</span>
                  <span className="font-semibold">{stats.uniqueCustomers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customers with Unpaid</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {new Set(allSales.filter(s => s.paymentStatus !== "paid").map(s => s.customerPhone)).size}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Bill Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bills</span>
                  <span className="font-semibold">{stats.totalBillsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid Bills</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{stats.paidBillsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unpaid Bills</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{stats.unpaidBillsCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collection Rate</span>
                  <span className="font-semibold">
                    {stats.totalSalesAmount > 0
                      ? ((stats.totalPaidAmount / stats.totalSalesAmount) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Bill Amount</span>
                  <span className="font-semibold">
                    Rs {stats.totalBillsCount > 0 ? (stats.totalSalesAmount / stats.totalBillsCount).toFixed(0) : 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Unpaid Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Bill Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidSales.slice(0, 5).map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:underline">
                          {sale.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.customerPhone}</TableCell>
                      <TableCell>Rs {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">
                        Rs {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-red-600 dark:text-red-400 font-semibold">
                        Rs {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                      <TableCell>{formatDisplayDate(sale.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {unpaidSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No unpaid bills found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-sales">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center">
                        Customer <SortIcon field="customer" />
                      </Button>
                    </TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center">
                        Amount <SortIcon field="amount" />
                      </Button>
                    </TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center">
                        Date <SortIcon field="date" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:underline">
                          {sale.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.customerPhone}</TableCell>
                      <TableCell>Rs {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">
                        Rs {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">
                        Rs {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                      <TableCell>{formatDisplayDate(sale.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No sales found matching your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid-bills">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center">
                        Customer <SortIcon field="customer" />
                      </Button>
                    </TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center">
                        Bill Amount <SortIcon field="amount" />
                      </Button>
                    </TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center">
                        Bill Date <SortIcon field="date" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-unpaid-${sale.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:underline">
                          {sale.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.customerPhone}</TableCell>
                      <TableCell>Rs {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">
                        Rs {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-red-600 dark:text-red-400 font-semibold">
                        Rs {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                      <TableCell>{sale.dueDate ? formatDisplayDate(sale.dueDate) : "Not set"}</TableCell>
                      <TableCell>{formatDisplayDate(sale.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {unpaidSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No unpaid bills found matching your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery-payments">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center">
                        Customer <SortIcon field="customer" />
                      </Button>
                    </TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center">
                        Payment Amount <SortIcon field="amount" />
                      </Button>
                    </TableHead>
                    <TableHead>Previous Balance</TableHead>
                    <TableHead>New Balance</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center">
                        Date <SortIcon field="date" />
                      </Button>
                    </TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/customer/${encodeURIComponent(payment.customerPhone)}`} className="text-blue-600 hover:underline">
                          {payment.sale?.customerName || "Unknown"}
                        </Link>
                      </TableCell>
                      <TableCell>{payment.customerPhone}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400 font-semibold">
                        Rs {parseFloat(payment.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        Rs {parseFloat(payment.previousBalance).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        Rs {parseFloat(payment.newBalance).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {payment.paymentMethod || "cash"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDisplayDate(payment.createdAt)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {payment.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No recovery payments found matching your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
