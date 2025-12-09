import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { TruckIcon, Search, Plus, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ColorWithVariantAndProduct } from "@shared/schema";
import { formatDateToDDMMYYYY } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const stockInFormSchema = z.object({
  colorId: z.string().min(1, "Color is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
  stockInDate: z.string().min(1, "Date is required").regex(/^\d{2}-\d{2}-\d{4}$/, "Date must be in DD-MM-YYYY format"),
});

export default function StockIn() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);

  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  const stockInForm = useForm<z.infer<typeof stockInFormSchema>>({
    resolver: zodResolver(stockInFormSchema),
    defaultValues: {
      colorId: "",
      quantity: 0,
      notes: "",
      stockInDate: formatDateToDDMMYYYY(new Date()),
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockInFormSchema>) => {
      // Use the correct API endpoint
      return apiRequest("POST", `/api/colors/${data.colorId}/stock-in`, {
        quantity: data.quantity,
        notes: data.notes || "",
        stockInDate: data.stockInDate,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      setIsDialogOpen(false);
      setSelectedColor(null);
      stockInForm.reset({ 
        colorId: "",
        quantity: 0,
        notes: "",
        stockInDate: formatDateToDDMMYYYY(new Date()) 
      });
      toast({
        title: "Stock Added Successfully",
        description: response.message || `${data.quantity} units added to stock`,
      });
    },
    onError: (error: any) => {
      console.error("Stock in error:", error);
      toast({
        title: "Error Adding Stock",
        description: error.message || "Failed to add stock. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredColors = useMemo(() => {
    // Only show items when user searches - don't show all by default
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return colors.filter(color =>
      color.colorCode.toLowerCase().includes(query) ||
      color.colorName.toLowerCase().includes(query) ||
      color.variant.product.company.toLowerCase().includes(query) ||
      color.variant.product.productName.toLowerCase().includes(query) ||
      color.variant.packingSize.toLowerCase().includes(query)
    );
  }, [colors, searchQuery]);

  const getStockBadge = (quantity: number) => {
    if (quantity < 0) return <Badge className="bg-red-500 text-white">Deficit</Badge>;
    if (quantity === 0) return <Badge variant="destructive">Out</Badge>;
    if (quantity <= 5) return <Badge className="bg-amber-500 text-white">Low</Badge>;
    return <Badge className="bg-emerald-500 text-white">In Stock</Badge>;
  };

  // Helper to validate date format
  const isValidDDMMYYYY = (dateStr: string): boolean => {
    const pattern = /^\d{2}-\d{2}-\d{4}$/;
    if (!pattern.test(dateStr)) return false;
    
    const [day, month, year] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  const handleSubmit = async (data: z.infer<typeof stockInFormSchema>) => {
    try {
      // Validate date format
      if (!isValidDDMMYYYY(data.stockInDate)) {
        toast({
          title: "Invalid Date",
          description: "Please enter a valid date in DD-MM-YYYY format",
          variant: "destructive",
        });
        return;
      }

      // Validate quantity
      if (data.quantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: "Quantity must be greater than 0",
          variant: "destructive",
        });
        return;
      }

      // Check if color exists
      if (!selectedColor) {
        toast({
          title: "No Color Selected",
          description: "Please select a color to add stock to",
          variant: "destructive",
        });
        return;
      }

      await stockInMutation.mutateAsync(data);
    } catch (error) {
      console.error("Stock in submission error:", error);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-transparent">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-sm">
                <TruckIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Stock In</h2>
                <p className="text-xs text-slate-500">Add inventory to existing colors</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm border-0"
              data-testid="button-add-stock"
            >
              <ArrowUpCircle className="h-4 w-4 mr-1.5" />
              Add Stock
            </Button>
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
          ) : colors.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                <TruckIcon className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No colors found</h3>
              <p className="text-slate-500 mb-4">Add colors first in Stock Management before using stock in functionality</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by color code, name, company, or product..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 border-slate-200 bg-white rounded-xl"
                  data-testid="input-search-colors"
                />
              </div>

              {filteredColors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery.trim() ? "No colors found matching your search" : "Type to search for colors by code, name, company or product"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredColors.map(color => (
                    <Card
                      key={color.id}
                      className="rounded-2xl p-4 border border-slate-100 bg-slate-50 hover:shadow-lg hover:border-emerald-200 transition-all cursor-pointer group"
                      onClick={() => {
                        stockInForm.setValue("colorId", color.id);
                        stockInForm.setValue("quantity", 0);
                        stockInForm.setValue("notes", "");
                        stockInForm.setValue("stockInDate", formatDateToDDMMYYYY(new Date()));
                        setSelectedColor(color);
                        setIsDialogOpen(true);
                      }}
                      data-testid={`card-color-${color.id}`}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                              style={{ backgroundColor: color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : color.colorCode }}
                            />
                            <div>
                              <h3 className="font-semibold text-slate-900 group-hover:text-green-600 transition-colors">
                                {color.colorName}
                              </h3>
                              <p className="text-sm font-mono text-slate-500">{color.colorCode}</p>
                            </div>
                          </div>
                          {getStockBadge(color.stockQuantity)}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Product</span>
                            <span className="text-slate-400 truncate">{color.variant.product.productName}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Size</span>
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                              {color.variant.packingSize}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Current Stock</span>
                            <span className="font-mono font-semibold text-blue-600">{color.stockQuantity}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Company</span>
                            <span className="text-slate-400">{color.variant.product.company}</span>
                          </div>
                        </div>

                        <Button
                          className="w-full mt-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg"
                          size="sm"
                        >
                          <ArrowUpCircle className="h-4 w-4 mr-1" />
                          Add Stock
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setSelectedColor(null);
          setSearchQuery("");
          stockInForm.reset({ 
            colorId: "",
            quantity: 0,
            notes: "",
            stockInDate: formatDateToDDMMYYYY(new Date()) 
          });
        }
      }}>
        <DialogContent className="bg-white border border-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              Add Stock
            </DialogTitle>
            <DialogDescription>Add quantity to inventory with date tracking</DialogDescription>
          </DialogHeader>

          {!selectedColor ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by color code, name, product, or company..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 border-slate-200"
                  data-testid="input-dialog-search"
                />
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {filteredColors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <TruckIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{searchQuery ? "No colors found matching your search" : "No colors available"}</p>
                  </div>
                ) : (
                  filteredColors.map(color => (
                    <div
                      key={color.id}
                      className="bg-white rounded-xl p-3 border border-slate-200 hover:shadow-md cursor-pointer transition-shadow"
                      onClick={() => {
                        setSelectedColor(color);
                        stockInForm.setValue("colorId", color.id);
                        stockInForm.setValue("quantity", 0);
                        stockInForm.setValue("notes", "");
                        stockInForm.setValue("stockInDate", formatDateToDDMMYYYY(new Date()));
                      }}
                      data-testid={`dialog-color-${color.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold font-mono text-sm">{color.colorCode}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                color.stockQuantity < 0
                                  ? "bg-red-100 text-red-700 border-red-300"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              Stock: {color.stockQuantity}
                              {color.stockQuantity < 0 && " (Deficit)"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">{color.colorName}</p>
                          <p className="text-xs text-slate-500">
                            {color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Form {...stockInForm}>
              <form onSubmit={stockInForm.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-600">Selected Color</Label>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="w-6 h-6 rounded border-2 border-white shadow-sm"
                            style={{ backgroundColor: selectedColor.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : selectedColor.colorCode }}
                          />
                          <span className="font-semibold font-mono text-sm">{selectedColor.colorCode}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              selectedColor.stockQuantity < 0
                                ? "bg-red-100 text-red-700 border-red-300"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            Current: {selectedColor.stockQuantity}
                            {selectedColor.stockQuantity < 0 && " (Deficit)"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{selectedColor.colorName}</p>
                        <p className="text-xs text-slate-500">
                          {selectedColor.variant.product.company} - {selectedColor.variant.product.productName} ({selectedColor.variant.packingSize})
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedColor(null);
                          stockInForm.setValue("colorId", "");
                        }}
                        className="border-slate-200"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                </div>

                <FormField 
                  control={stockInForm.control} 
                  name="quantity" 
                  render={({ field }) => {
                    const quantityValue = Number(field.value) || 0;
                    const currentStock = selectedColor.stockQuantity;
                    const newStock = currentStock + quantityValue;
                    const hasDeficit = currentStock < 0;
                    const deficitAmount = hasDeficit ? Math.abs(currentStock) : 0;

                    return (
                      <FormItem>
                        <FormLabel>Quantity to Add</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Enter quantity"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue = value === "" ? 0 : parseInt(value, 10);
                              field.onChange(isNaN(numValue) ? 0 : numValue);
                            }}
                            className="border-slate-200"
                            data-testid="input-stock-quantity"
                          />
                        </FormControl>
                        <FormMessage />

                        {quantityValue > 0 && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                            <div className="text-sm font-medium text-slate-700">Stock Calculation Preview</div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="text-center p-2 rounded bg-white border border-slate-100">
                                <div className={`font-bold tabular-nums ${hasDeficit ? "text-red-600" : "text-slate-700"}`}>
                                  {currentStock}
                                </div>
                                <div className="text-xs text-slate-500">Previous</div>
                              </div>
                              <div className="text-center p-2 rounded bg-emerald-50 border border-emerald-100">
                                <div className="font-bold text-emerald-600 tabular-nums">+{quantityValue}</div>
                                <div className="text-xs text-slate-500">Adding</div>
                              </div>
                              <div className="text-center p-2 rounded bg-blue-50 border border-blue-100">
                                <div className="font-bold text-blue-600 tabular-nums">{newStock}</div>
                                <div className="text-xs text-slate-500">New Stock</div>
                              </div>
                            </div>

                            {hasDeficit && (
                              <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Deficit Alert:</span> This item has a stock deficit of {deficitAmount} units (from previous sales).
                                  {quantityValue >= deficitAmount
                                    ? ` Adding ${quantityValue} will first cover the deficit, then add ${quantityValue - deficitAmount} to available stock.`
                                    : ` Adding ${quantityValue} will reduce the deficit to ${deficitAmount - quantityValue} units.`
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </FormItem>
                    );
                  }} 
                />

                <FormField control={stockInForm.control} name="stockInDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock In Date (DD-MM-YYYY)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DD-MM-YYYY"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow only numbers and dashes in DD-MM-YYYY format
                          if (/^[\d-]*$/.test(value) && value.length <= 10) {
                            field.onChange(value);
                          }
                        }}
                        className="border-slate-200"
                        data-testid="input-stock-date"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-slate-500 mt-1">
                      Current date: {formatDateToDDMMYYYY(new Date())}
                    </p>
                  </FormItem>
                )} />

                <FormField control={stockInForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this stock addition..."
                        {...field}
                        className="border-slate-200"
                        data-testid="input-stock-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedColor(null);
                      setSearchQuery("");
                      stockInForm.reset({ 
                        colorId: "",
                        quantity: 0,
                        notes: "",
                        stockInDate: formatDateToDDMMYYYY(new Date()) 
                      });
                    }}
                    className="border-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={stockInMutation.isPending || !selectedColor}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    data-testid="button-submit-stock"
                  >
                    {stockInMutation.isPending ? "Adding Stock..." : "Add Stock"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}