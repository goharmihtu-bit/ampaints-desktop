import { useState, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
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
import { History, Search, RefreshCw, Download, FileText, Filter, Trash, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import jsPDF from "jspdf";

const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;

interface StockInHistory {
  id: string;
  colorId: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  stockInDate: string;
  notes: string | null;
  type: string;
  saleId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  color: {
    id: string;
    colorCode: string;
    colorName: string;
    stockQuantity: number;
    variant: {
      id: string;
      packingSize: string;
      rate: string;
      product: {
        id: string;
        company: string;
        productName: string;
      };
    };
  };
}

const stockHistoryEditSchema = z.object({
  quantity: z.string().min(1, "Quantity is required"),
  notes: z.string().optional(),
  stockInDate: z.string().min(1, "Date is required").regex(/^\d{2}-\d{2}-\d{4}$/, "Date must be in DD-MM-YYYY format"),
});

export default function StockHistory() {
  const { toast } = useToast();
  const { formatDateShort } = useDateFormat();
  const { canDeleteStockHistory } = usePermissions();

  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingHistory, setEditingHistory] = useState<StockInHistory | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: historyRaw = [], isLoading, refetch } = useQuery<StockInHistory[]>({
    queryKey: ["/api/stock-in/history"],
  });

  const history = useDeferredValue(historyRaw);

  const companies = useMemo(() => {
    const unique = Array.from(new Set(history.map(h => h.color.variant.product.company)));
    return unique.sort();
  }, [history]);

  const products = useMemo(() => {
    const unique = Array.from(new Set(history.map(h => h.color.variant.product.productName)));
    return unique.sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    let filtered = history;

    if (companyFilter !== "all") {
      filtered = filtered.filter(h => h.color.variant.product.company === companyFilter);
    }

    if (productFilter !== "all") {
      filtered = filtered.filter(h => h.color.variant.product.productName === productFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      filtered = filtered.filter(h => {
        const historyDate = new Date(h.createdAt);
        switch (dateFilter) {
          case "today": return historyDate >= today;
          case "yesterday": return historyDate >= yesterday && historyDate < today;
          case "week": return historyDate >= lastWeek;
          case "month": return historyDate >= lastMonth;
          default: return true;
        }
      });
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(h => new Date(h.createdAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(h => new Date(h.createdAt) <= end);
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(h =>
        h.color.colorCode.toLowerCase().includes(query) ||
        h.color.colorName.toLowerCase().includes(query) ||
        h.color.variant.product.company.toLowerCase().includes(query) ||
        h.color.variant.product.productName.toLowerCase().includes(query) ||
        h.stockInDate.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [history, companyFilter, productFilter, dateFilter, debouncedSearchQuery, startDate, endDate]);

  const visibleHistory = useMemo(() => {
    return filteredHistory.slice(0, visibleLimit);
  }, [filteredHistory, visibleLimit]);

  const editForm = useForm<z.infer<typeof stockHistoryEditSchema>>({
    resolver: zodResolver(stockHistoryEditSchema),
    defaultValues: { quantity: "", notes: "", stockInDate: "" },
  });

  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockHistoryEditSchema>) => {
      if (!editingHistory) return;
      return apiRequest(`/api/stock-in/history/${editingHistory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: parseInt(data.quantity),
          notes: data.notes || "",
          stockInDate: data.stockInDate,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setIsEditDialogOpen(false);
      setEditingHistory(null);
      editForm.reset();
      toast({ title: "Updated", description: "Stock history updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/stock-in/history/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setIsEditDialogOpen(false);
      setEditingHistory(null);
      toast({ title: "Deleted", description: "Stock history deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const exportCSV = () => {
    const headers = ["Date", "Color Code", "Color Name", "Company", "Product", "Size", "Previous", "Added", "New", "Type", "Notes"];
    const rows = filteredHistory.map(h => [
      h.stockInDate,
      h.color.colorCode,
      h.color.colorName,
      h.color.variant.product.company,
      h.color.variant.product.productName,
      h.color.variant.packingSize,
      h.previousStock,
      h.quantity,
      h.newStock,
      h.type || "stock_in",
      h.notes || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Stock In History Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Records: ${filteredHistory.length}`, 14, 36);

    let y = 50;
    doc.setFontSize(8);
    doc.text("Date", 14, y);
    doc.text("Color", 40, y);
    doc.text("Product", 80, y);
    doc.text("Prev", 130, y);
    doc.text("Added", 150, y);
    doc.text("New", 170, y);

    y += 6;
    filteredHistory.slice(0, 50).forEach(h => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(h.stockInDate, 14, y);
      doc.text(h.color.colorCode.substring(0, 15), 40, y);
      doc.text(h.color.variant.product.productName.substring(0, 20), 80, y);
      doc.text(String(h.previousStock), 130, y);
      doc.text(String(h.quantity), 150, y);
      doc.text(String(h.newStock), 170, y);
      y += 5;
    });

    doc.save(`stock-history-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const clearFilters = () => {
    setCompanyFilter("all");
    setProductFilter("all");
    setDateFilter("all");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = companyFilter !== "all" || productFilter !== "all" || dateFilter !== "all" || searchQuery || startDate || endDate;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-transparent">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-sm">
                <History className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Stock In History</h2>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-amber-600 tabular-nums">{filteredHistory.length}</span> records found
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-200 text-slate-600" data-testid="button-refresh">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="border-slate-200 text-slate-600" data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} className="border-slate-200 text-slate-600" data-testid="button-export-pdf">
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 && !hasActiveFilters ? (
            <div className="text-center py-12">
              <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                <History className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No stock history found</h3>
              <p className="text-slate-500 mb-4">Stock in history will appear here when you add stock to colors</p>
              <Button onClick={() => refetch()} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh History
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-slate-200 bg-white rounded-lg" data-testid="input-start-date" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-slate-200 bg-white rounded-lg" data-testid="input-end-date" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Company</Label>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="border-slate-200 bg-white rounded-lg" data-testid="select-company">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Product</Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="border-slate-200 bg-white rounded-lg" data-testid="select-product">
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="all">All Products</SelectItem>
                      {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-medium text-slate-600">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search by color code, color name, stock in date..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 border-slate-200 bg-white rounded-xl" data-testid="input-search" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Quick Date Filters</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="border-slate-200 bg-white rounded-lg" data-testid="select-date-filter">
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500">Showing {filteredHistory.length} of {history.length} records</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="border-slate-200 text-slate-600" data-testid="button-clear-filters">
                    <Filter className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                </div>
              )}

              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No history found matching your filters</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleHistory.map(h => {
                      const isReturn = h.type === "return";
                      return (
                        <Card
                          key={h.id}
                          className={`rounded-2xl p-4 border hover:shadow-lg transition-all cursor-pointer group ${isReturn ? "border-amber-300 bg-amber-50/30" : "border-slate-100 bg-slate-50"}`}
                          onClick={() => {
                            if (canDeleteStockHistory) {
                              setEditingHistory(h);
                              editForm.reset({
                                quantity: String(h.quantity),
                                notes: h.notes || "",
                                stockInDate: h.stockInDate,
                              });
                              setIsEditDialogOpen(true);
                            }
                          }}
                          data-testid={`card-history-${h.id}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                                  style={{ backgroundColor: h.color.colorCode.toLowerCase().includes("ral") ? "#f0f0f0" : h.color.colorCode }}
                                />
                                <div>
                                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{h.color.colorName}</h3>
                                  <p className="text-sm font-mono text-slate-500">{h.color.colorCode}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {isReturn && <Badge className="bg-amber-500 text-white text-xs">Returned</Badge>}
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">{h.stockInDate}</Badge>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Product</span>
                                <span className="text-slate-400 truncate">{h.color.variant.product.productName}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Size</span>
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">{h.color.variant.packingSize}</Badge>
                              </div>

                              {isReturn && h.customerName && (
                                <div className="bg-amber-100 p-2 rounded-lg border border-amber-200 space-y-1">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-amber-700 font-medium">Customer</span>
                                    <span className="text-slate-800 font-semibold">{h.customerName}</span>
                                  </div>
                                  {h.customerPhone && (
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-700 font-medium">Phone</span>
                                      <span className="text-slate-600">{h.customerPhone}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-3 gap-2 text-center mt-3 p-2 bg-slate-50 rounded-lg">
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-500">Previous</p>
                                  <p className="font-mono text-sm font-semibold text-orange-600">{h.previousStock}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-500">{isReturn ? "Restored" : "Added"}</p>
                                  <p className={`font-mono text-sm font-semibold ${isReturn ? "text-amber-600" : "text-green-600"}`}>+{h.quantity}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-500">New</p>
                                  <p className="font-mono text-sm font-semibold text-blue-600">{h.newStock}</p>
                                </div>
                              </div>

                              {h.notes && (
                                <div className={`text-xs p-2 rounded-lg mt-2 ${isReturn ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50"}`}>
                                  <p className="line-clamp-2">{h.notes}</p>
                                </div>
                              )}

                              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-200">
                                <span>{formatDateShort(h.createdAt)}</span>
                                <span>{new Date(h.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {filteredHistory.length > visibleLimit && (
                    <div className="flex justify-center mt-4">
                      <Button variant="outline" onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)} className="border-slate-200" data-testid="button-load-more">
                        Load More ({filteredHistory.length - visibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Stock History
            </DialogTitle>
            <DialogDescription>Update or delete this stock history record</DialogDescription>
          </DialogHeader>

          {editingHistory && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(data => editMutation.mutate(data))} className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-sm font-medium">{editingHistory.color.colorCode} - {editingHistory.color.colorName}</p>
                  <p className="text-xs text-slate-500">{editingHistory.color.variant.product.company} - {editingHistory.color.variant.product.productName}</p>
                </div>

                <FormField control={editForm.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} className="border-slate-200" data-testid="input-edit-quantity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={editForm.control} name="stockInDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date (DD-MM-YYYY)</FormLabel>
                    <FormControl>
                      <Input placeholder="DD-MM-YYYY" {...field} className="border-slate-200" data-testid="input-edit-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={editForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="border-slate-200" data-testid="input-edit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter className="flex gap-2">
                  <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate(editingHistory.id)} disabled={deleteMutation.isPending} data-testid="button-delete">
                    <Trash className="h-4 w-4 mr-2" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                  <Button type="submit" disabled={editMutation.isPending} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white" data-testid="button-save">
                    {editMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
