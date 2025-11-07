import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2, Check, X, TrendingUp, Search, Filter, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { VariantWithProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function RateManagement() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const { toast } = useToast();

  // Enhanced query with proper error handling and real-time updates
  const { 
    data: variants = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
    retry: 3, // Retry 3 times on failure
  });

  const updateRateMutation = useMutation({
    mutationFn: async (data: { id: string; rate: number }) => {
      const response = await fetch(`/api/variants/${data.id}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: data.rate })
      });
      if (!response.ok) throw new Error("Failed to update rate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ 
        title: "Rate updated successfully",
        description: "The new rate has been saved and will be reflected immediately."
      });
      setEditingId(null);
      setEditRate("");
    },
    onError: (error: Error) => {
      console.error("Update rate error:", error);
      toast({ 
        title: "Failed to update rate", 
        description: "Please check your connection and try again.",
        variant: "destructive" 
      });
    },
  });

  const startEditing = (id: string, currentRate: string) => {
    setEditingId(id);
    setEditRate(Math.round(parseFloat(currentRate)).toString());
  };

  const saveRate = (id: string) => {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate <= 0) {
      toast({ 
        title: "Invalid rate", 
        description: "Please enter a valid positive number.",
        variant: "destructive" 
      });
      return;
    }
    updateRateMutation.mutate({ id, rate });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditRate("");
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({ 
        title: "Rates refreshed",
        description: "Latest rates loaded successfully."
      });
    } catch (error) {
      toast({ 
        title: "Refresh failed", 
        description: "Could not load the latest rates.",
        variant: "destructive" 
      });
    }
  };

  // Enhanced data processing with error handling
  const uniqueCompanies = useMemo(() => {
    if (!variants || variants.length === 0) return [];
    const companies = variants.map(v => v.product?.company).filter(Boolean) as string[];
    return Array.from(new Set(companies)).sort();
  }, [variants]);

  const uniqueProducts = useMemo(() => {
    if (!variants || variants.length === 0) return [];
    const products = variants.map(v => v.product?.productName).filter(Boolean) as string[];
    return Array.from(new Set(products)).sort();
  }, [variants]);

  const uniqueSizes = useMemo(() => {
    if (!variants || variants.length === 0) return [];
    const sizes = variants.map(v => v.packingSize).filter(Boolean) as string[];
    return Array.from(new Set(sizes)).sort();
  }, [variants]);

  // Enhanced filtering with proper null checks
  const filteredVariants = useMemo(() => {
    let filtered = [...variants];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((variant) => {
        const company = variant.product?.company?.toLowerCase() || "";
        const productName = variant.product?.productName?.toLowerCase() || "";
        const packingSize = variant.packingSize?.toLowerCase() || "";
        
        return company.includes(query) || 
               productName.includes(query) || 
               packingSize.includes(query);
      });
    }

    // Apply company filter
    if (companyFilter !== "all") {
      filtered = filtered.filter(variant => variant.product?.company === companyFilter);
    }

    // Apply product filter
    if (productFilter !== "all") {
      filtered = filtered.filter(variant => variant.product?.productName === productFilter);
    }

    // Apply size filter
    if (sizeFilter !== "all") {
      filtered = filtered.filter(variant => variant.packingSize === sizeFilter);
    }

    return filtered;
  }, [variants, searchQuery, companyFilter, productFilter, sizeFilter]);

  // Enhanced grouping with proper error handling
  const groupedVariants = filteredVariants.reduce((acc, variant) => {
    const company = variant.product?.company || "Unknown Company";
    const productName = variant.product?.productName || "Unknown Product";
    const key = `${company}|${productName}`;
    
    if (!acc[key]) {
      acc[key] = {
        company,
        productName,
        variants: [],
      };
    }
    acc[key].variants.push(variant);
    return acc;
  }, {} as Record<string, { company: string; productName: string; variants: VariantWithProduct[] }>);

  const groupedArray = Object.values(groupedVariants);

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-1">Error Loading Rates</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error.message || "Failed to load product variants from the server."}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="default">
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-rate-management-title">
            Rate Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage pricing for {variants.length} product variants across {uniqueCompanies.length} companies
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, product name, or packing size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-rates"
              className="pl-9"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Company</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger data-testid="select-company-filter">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies ({uniqueCompanies.length})</SelectItem>
                  {uniqueCompanies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger data-testid="select-product-filter">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products ({uniqueProducts.length})</SelectItem>
                  {uniqueProducts.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Packing Size</label>
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger data-testid="select-size-filter">
                  <SelectValue placeholder="All Sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes ({uniqueSizes.length})</SelectItem>
                  {uniqueSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Showing {filteredVariants.length} of {variants.length} variants
              {searchQuery && ` for "${searchQuery}"`}
              {companyFilter !== "all" && ` in ${companyFilter}`}
              {productFilter !== "all" && ` • ${productFilter}`}
              {sizeFilter !== "all" && ` • ${sizeFilter}`}
            </p>
            {(searchQuery || companyFilter !== "all" || productFilter !== "all" || sizeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setCompanyFilter("all");
                  setProductFilter("all");
                  setSizeFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variants List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredVariants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {variants.length === 0 ? "No products found" : "No matching variants found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {variants.length === 0 
                ? "Add products and variants to manage their rates"
                : "Try adjusting your search criteria or filters"
              }
            </p>
            {variants.length === 0 ? (
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href="/products">Add Products</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/inventory">Manage Inventory</a>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setCompanyFilter("all");
                  setProductFilter("all");
                  setSizeFilter("all");
                }}
              >
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedArray.map((group) => (
            <Card key={`${group.company}|${group.productName}`} className="overflow-hidden">
              <CardHeader className="bg-muted/50 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm">{group.company}</Badge>
                  <CardTitle className="text-lg">{group.productName}</CardTitle>
                  <Badge variant="secondary">{group.variants.length} sizes</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Packing Size</TableHead>
                        <TableHead className="w-1/3">Current Rate</TableHead>
                        <TableHead className="w-1/3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.variants.map((variant) => (
                        <TableRow key={variant.id} data-testid={`rate-row-${variant.id}`}>
                          <TableCell>
                            <Badge variant="outline" className="text-base px-3 py-1">
                              {variant.packingSize}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {editingId === variant.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Rs.</span>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={editRate}
                                  onChange={(e) => setEditRate(e.target.value)}
                                  className="w-32 h-9"
                                  data-testid={`input-edit-rate-${variant.id}`}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRate(variant.id);
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Rs.</span>
                                <span className="font-mono text-lg font-bold">
                                  {Math.round(parseFloat(variant.rate)).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === variant.id ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => saveRate(variant.id)}
                                  disabled={updateRateMutation.isPending}
                                  data-testid={`button-save-rate-${variant.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={cancelEditing}
                                  disabled={updateRateMutation.isPending}
                                  data-testid={`button-cancel-edit-${variant.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(variant.id, variant.rate)}
                                data-testid={`button-edit-rate-${variant.id}`}
                                disabled={!!editingId} // Disable other edit buttons when one is being edited
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit Rate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {!isLoading && variants.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Total Variants:</span>
                <Badge variant="secondary">{variants.length}</Badge>
                
                <span className="text-muted-foreground">Companies:</span>
                <Badge variant="secondary">{uniqueCompanies.length}</Badge>
                
                <span className="text-muted-foreground">Products:</span>
                <Badge variant="secondary">{uniqueProducts.length}</Badge>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}