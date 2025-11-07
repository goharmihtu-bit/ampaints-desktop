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
import { Edit2, Check, X, TrendingUp, Search, Filter, RefreshCw } from "lucide-react";
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

  const { 
    data: variants = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 30000, // 30 seconds
  });

  const updateRateMutation = useMutation({
    mutationFn: async (data: { id: string; rate: number }) => {
      return await apiRequest("PATCH", `/api/variants/${data.id}/rate`, { rate: data.rate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Rate updated successfully" });
      setEditingId(null);
      setEditRate("");
    },
    onError: (error: Error) => {
      console.error("Update rate error:", error);
      toast({ title: "Failed to update rate", variant: "destructive" });
    },
  });

  const startEditing = (id: string, currentRate: string) => {
    setEditingId(id);
    setEditRate(Math.round(parseFloat(currentRate)).toString());
  };

  const saveRate = (id: string) => {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Please enter a valid rate", variant: "destructive" });
      return;
    }
    updateRateMutation.mutate({ id, rate });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditRate("");
  };

  const handleRefresh = () => {
    refetch();
    toast({ title: "Refreshing rates..." });
  };

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(variants.map(v => v.product.company));
    return Array.from(companies).sort();
  }, [variants]);

  const uniqueProducts = useMemo(() => {
    const products = new Set(variants.map(v => v.product.productName));
    return Array.from(products).sort();
  }, [variants]);

  const uniqueSizes = useMemo(() => {
    const sizes = new Set(variants.map(v => v.packingSize));
    return Array.from(sizes).sort();
  }, [variants]);

  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        variant.product.company.toLowerCase().includes(query) ||
        variant.product.productName.toLowerCase().includes(query) ||
        variant.packingSize.toLowerCase().includes(query);
      
      const matchesCompany = companyFilter === "all" || variant.product.company === companyFilter;
      const matchesProduct = productFilter === "all" || variant.product.productName === productFilter;
      const matchesSize = sizeFilter === "all" || variant.packingSize === sizeFilter;
      
      return matchesSearch && matchesCompany && matchesProduct && matchesSize;
    });
  }, [variants, searchQuery, companyFilter, productFilter, sizeFilter]);

  const groupedVariants = filteredVariants.reduce((acc, variant) => {
    const key = `${variant.product.company}|${variant.product.productName}`;
    if (!acc[key]) {
      acc[key] = {
        company: variant.product.company,
        productName: variant.product.productName,
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
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Error Loading Rates</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Failed to load product variants. Please try again.
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
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
          <p className="text-sm text-muted-foreground">Manage pricing for all product variants</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, product, or size..."
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {uniqueSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(searchQuery || companyFilter !== "all" || productFilter !== "all" || sizeFilter !== "all") && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {filteredVariants.length} of {variants.length} variants
              </p>
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
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variants List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : groupedArray.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {variants.length === 0 ? "No products found" : "No results found"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {variants.length === 0 
                ? "Add products to manage their rates"
                : "Try adjusting your filters"
              }
            </p>
            {variants.length === 0 && (
              <Button variant="outline" className="mt-4" asChild>
                <a href="/products">Add Products</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedArray.map((group) => (
            <Card key={`${group.company}|${group.productName}`}>
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{group.company}</Badge>
                  <CardTitle className="text-lg">{group.productName}</CardTitle>
                  <Badge variant="secondary">{group.variants.length} sizes</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Packing Size</TableHead>
                        <TableHead>Current Rate</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.variants.map((variant) => (
                        <TableRow key={variant.id} data-testid={`rate-row-${variant.id}`}>
                          <TableCell>
                            <Badge variant="outline">{variant.packingSize}</Badge>
                          </TableCell>
                          <TableCell>
                            {editingId === variant.id ? (
                              <Input
                                type="number"
                                step="1"
                                value={editRate}
                                onChange={(e) => setEditRate(e.target.value)}
                                className="w-32 h-8"
                                data-testid={`input-edit-rate-${variant.id}`}
                                autoFocus
                              />
                            ) : (
                              <span className="font-mono">Rs. {Math.round(parseFloat(variant.rate))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === variant.id ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => saveRate(variant.id)}
                                  disabled={updateRateMutation.isPending}
                                  data-testid={`button-save-rate-${variant.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={cancelEditing}
                                  disabled={updateRateMutation.isPending}
                                  data-testid={`button-cancel-edit-${variant.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEditing(variant.id, variant.rate)}
                                data-testid={`button-edit-rate-${variant.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
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
    </div>
  );
}