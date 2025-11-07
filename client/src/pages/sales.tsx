import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Receipt, Calendar, MoreVertical, Trash2, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  amountPaid: string;
  paymentStatus: string;
  createdAt: string;
}

export default function Sales() {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const { toast } = useToast();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      // First delete all sale items
      const saleItems = await apiRequest("GET", `/api/sales/${saleId}`);
      const saleData = await saleItems.json();
      
      if (saleData.saleItems) {
        for (const item of saleData.saleItems) {
          await apiRequest("DELETE", `/api/sale-items/${item.id}`);
        }
      }
      
      // Then delete the sale
      return await apiRequest("DELETE", `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Sale deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedSale(null);
    },
    onError: (error: Error) => {
      console.error("Delete sale error:", error);
      toast({ title: "Failed to delete sale", variant: "destructive" });
    },
  });

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
        return <Badge variant="default">Paid</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "unpaid":
        return <Badge variant="outline">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDeleteSale = (sale: Sale) => {
    setSelectedSale(sale);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedSale) {
      deleteSaleMutation.mutate(selectedSale.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-sales-title">Sales</h1>
        <p className="text-sm text-muted-foreground">View all sales transactions</p>
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
                    data-testid="input-sales-search"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
                    data-testid="select-date-filter"
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
                      <div className="text-lg font-semibold text-destructive">
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
                        <Card key={sale.id} className="hover-elevate" data-testid={`card-sale-${sale.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Receipt className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{sale.customerName}</span>
                                  {getPaymentStatusBadge(sale.paymentStatus)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Phone: </span>
                                    <span className="font-mono">{sale.customerPhone}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Date: </span>
                                    <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Time: </span>
                                    <span>{new Date(sale.createdAt).toLocaleTimeString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="font-semibold">Rs. {totalAmount.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Paid: </span>
                                    <span className="font-semibold">Rs. {amountPaid.toLocaleString()}</span>
                                  </div>
                                  {amountDue > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Due: </span>
                                      <span className="font-semibold text-destructive">Rs. {amountDue.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/bill/${sale.id}`}
                                  className="text-sm text-primary hover:underline whitespace-nowrap"
                                  data-testid={`link-view-bill-${sale.id}`}
                                >
                                  View Bill
                                </Link>
                                
                                {/* Three Dots Menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/bill/${sale.id}`} className="flex items-center cursor-pointer">
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Details
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => handleDeleteSale(sale)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Sale
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
                          <span className="text-destructive">Rs. {Math.round(totals.totalDue).toLocaleString()}</span>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sale</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the sale for {selectedSale?.customerName}? 
              This action cannot be undone and all sale items will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteSaleMutation.isPending}
            >
              {deleteSaleMutation.isPending ? "Deleting..." : "Delete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}