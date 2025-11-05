import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Plus,
  Package,
  Palette,
  Layers,
  TruckIcon,
  Search,
  Trash,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  MoreVertical,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, VariantWithProduct, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* -------------------------
   Validation schemas
   ------------------------- */
const productFormSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  productName: z.string().min(1, "Product name is required"),
});

const variantFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  packingSize: z.string().min(1, "Packing size is required"),
  rate: z.string().min(1, "Rate is required"),
});

const colorFormSchema = z.object({
  variantId: z.string().min(1, "Variant is required"),
  colorName: z.string().min(1, "Color name is required"),
  colorCode: z.string().min(1, "Color code is required"),
  stockQuantity: z.string().min(1, "Quantity is required"),
});

const stockInFormSchema = z.object({
  colorId: z.string().min(1, "Color is required"),
  quantity: z.string().min(1, "Quantity is required"),
});

/* -------------------------
   Quick Add local types
   ------------------------- */
type QuickVariant = {
  id: string;
  packingSize: string;
  rate: string;
};

type QuickColor = {
  id: string;
  colorName: string;
  colorCode: string;
  stockQuantity: string;
};

/* -------------------------
   Main component
   ------------------------- */
export default function StockManagement() {
  /* Dialog visibility */
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);

  /* Edit states */
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<VariantWithProduct | null>(null);
  const [editingColor, setEditingColor] = useState<ColorWithVariantAndProduct | null>(null);

  /* Detail view states */
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingVariant, setViewingVariant] = useState<VariantWithProduct | null>(null);
  const [viewingColor, setViewingColor] = useState<ColorWithVariantAndProduct | null>(null);

  /* Quick Add wizard */
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickStep, setQuickStep] = useState<number>(1); // 1: product, 2: variants, 3: colors
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [newCompany, setNewCompany] = useState<string>("");
  const [newProduct, setNewProduct] = useState<string>("");
  const [useExistingCompany, setUseExistingCompany] = useState<boolean>(true);
  const [useExistingProduct, setUseExistingProduct] = useState<boolean>(true);
  const [quickVariants, setQuickVariants] = useState<QuickVariant[]>(() => [
    { id: `${Date.now()}-v0`, packingSize: "", rate: "" },
  ]);
  const [quickColors, setQuickColors] = useState<QuickColor[]>(() => [
    { id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" },
  ]);
  const [expandedSections, setExpandedSections] = useState({ variants: true, colors: true });

  const { toast } = useToast();

  /* Search & stock-in state */
  const [colorSearchQuery, setColorSearchQuery] = useState("");
  const [stockInSearchQuery, setStockInSearchQuery] = useState("");
  const [selectedColorForStockIn, setSelectedColorForStockIn] = useState<ColorWithVariantAndProduct | null>(null);

  /* Advanced filters state */
  const [productCompanyFilter, setProductCompanyFilter] = useState("all");
  const [variantCompanyFilter, setVariantCompanyFilter] = useState("all");
  const [variantProductFilter, setVariantProductFilter] = useState("all");
  const [variantSizeFilter, setVariantSizeFilter] = useState("all");
  const [colorCompanyFilter, setColorCompanyFilter] = useState("all");
  const [colorProductFilter, setColorProductFilter] = useState("all");
  const [colorSizeFilter, setColorSizeFilter] = useState("all");
  const [colorStockStatusFilter, setColorStockStatusFilter] = useState("all");

  /* Multi-select state */
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  /* -------------------------
     Queries
     ------------------------- */
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: variantsData = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
  });

  const { data: colorsData = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  /* Useful derived lists */
  const companies = useMemo(() => {
    const unique = Array.from(new Set(products.map(p => p.company)));
    return unique.sort();
  }, [products]);

  const productsByCompany = useMemo(() => {
    if (!selectedCompany) return [];
    return products.filter(p => p.company === selectedCompany).map(p => p.productName).sort();
  }, [products, selectedCompany]);

  /* -------------------------
     Forms
     ------------------------- */
  const productForm = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { company: "", productName: "" },
  });

  const variantForm = useForm<z.infer<typeof variantFormSchema>>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: { productId: "", packingSize: "", rate: "" },
  });

  const colorForm = useForm<z.infer<typeof colorFormSchema>>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: { variantId: "", colorName: "", colorCode: "", stockQuantity: "" },
  });

  const stockInForm = useForm<z.infer<typeof stockInFormSchema>>({
    resolver: zodResolver(stockInFormSchema),
    defaultValues: { colorId: "", quantity: "" },
  });

  /* -------------------------
     Quick Add auto-append empty rows
     ------------------------- */
  useEffect(() => {
    const last = quickVariants[quickVariants.length - 1];
    if (last && (last.packingSize.trim() !== "" || last.rate.trim() !== "")) {
      setQuickVariants(prev => [...prev, { id: String(Date.now()), packingSize: "", rate: "" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickVariants.length]);

  useEffect(() => {
    const last = quickColors[quickColors.length - 1];
    if (last && (last.colorName.trim() !== "" || last.colorCode.trim() !== "" || last.stockQuantity.trim() !== "")) {
      setQuickColors(prev => [...prev, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickColors.length]);

  /* -------------------------
     Populate edit forms when editing
     ------------------------- */
  useEffect(() => {
    if (editingProduct) {
      productForm.setValue("company", editingProduct.company);
      productForm.setValue("productName", editingProduct.productName);
    }
  }, [editingProduct, productForm]);

  useEffect(() => {
    if (editingVariant) {
      variantForm.setValue("productId", editingVariant.productId);
      variantForm.setValue("packingSize", editingVariant.packingSize);
      variantForm.setValue("rate", editingVariant.rate);
    }
  }, [editingVariant, variantForm]);

  useEffect(() => {
    if (editingColor) {
      colorForm.setValue("variantId", editingColor.variantId);
      colorForm.setValue("colorName", editingColor.colorName);
      colorForm.setValue("colorCode", editingColor.colorCode);
      colorForm.setValue("stockQuantity", String(editingColor.stockQuantity));
    }
  }, [editingColor, colorForm]);

  /* -------------------------
     Mutations
     ------------------------- */
  const createProductSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const res = await apiRequest("POST", "/api/products", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product created successfully" });
      productForm.reset();
      setIsProductDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; company: string; productName: string }) => {
      const res = await apiRequest("PUT", `/api/products/${data.id}`, {
        company: data.company,
        productName: data.productName,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    },
  });

  const bulkDeleteProductsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/products/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setSelectedProducts(new Set());
      toast({ title: "Products deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete products", variant: "destructive" });
    },
  });

  const createVariantSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof variantFormSchema>) => {
      const res = await apiRequest("POST", "/api/variants", { ...data, rate: parseFloat(data.rate) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Variant created successfully" });
      variantForm.reset();
      setIsVariantDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create variant", variant: "destructive" });
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: async (data: { id: string; productId: string; packingSize: string; rate: number }) => {
      const res = await apiRequest("PUT", `/api/variants/${data.id}`, {
        productId: data.productId,
        packingSize: data.packingSize,
        rate: data.rate,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Variant updated successfully" });
      setEditingVariant(null);
    },
    onError: () => {
      toast({ title: "Failed to update variant", variant: "destructive" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/variants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Variant deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete variant", variant: "destructive" });
    },
  });

  const bulkDeleteVariantsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/variants/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setSelectedVariants(new Set());
      toast({ title: "Variants deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete variants", variant: "destructive" });
    },
  });

  const createColorSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof colorFormSchema>) => {
      const res = await apiRequest("POST", "/api/colors", { ...data, stockQuantity: parseInt(data.stockQuantity, 10) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Color added successfully" });
      colorForm.reset();
      setIsColorDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add color", variant: "destructive" });
    },
  });

  const updateColorMutation = useMutation({
    mutationFn: async (data: { id: string; variantId: string; colorName: string; colorCode: string; stockQuantity: number }) => {
      const res = await apiRequest("PUT", `/api/colors/${data.id}`, {
        variantId: data.variantId,
        colorName: data.colorName,
        colorCode: data.colorCode,
        stockQuantity: data.stockQuantity,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Color updated successfully" });
      setEditingColor(null);
    },
    onError: () => {
      toast({ title: "Failed to update color", variant: "destructive" });
    },
  });

  const deleteColorMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/colors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Color deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete color", variant: "destructive" });
    },
  });

  const bulkDeleteColorsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/colors/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setSelectedColors(new Set());
      toast({ title: "Colors deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete colors", variant: "destructive" });
    },
  });

  /* Quick Add bulk mutations (used by wizard) */
  const createProductMutation = useMutation({
    mutationFn: async (data: { company: string; productName: string }) => {
      const res = await apiRequest("POST", "/api/products", data);
      return await res.json();
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async (data: { productId: string; packingSize: string; rate: number }) => {
      const res = await apiRequest("POST", "/api/variants", data);
      return await res.json();
    },
  });

  const createColorMutation = useMutation({
    mutationFn: async (data: { variantId: string; colorName: string; colorCode: string; stockQuantity: number }) => {
      const res = await apiRequest("POST", "/api/colors", data);
      return await res.json();
    },
  });

  /* Stock In mutation */
  const stockInMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockInFormSchema>) => {
      const res = await apiRequest("POST", `/api/colors/${data.colorId}/stock-in`, { quantity: parseInt(data.quantity, 10) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Stock added successfully" });
      stockInForm.reset();
      setIsStockInDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add stock", variant: "destructive" });
    },
  });

  /* -------------------------
     Helpers + UI functions
     ------------------------- */
  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low Stock</Badge>;
    return <Badge variant="default">In Stock</Badge>;
  };

  /* -------------------------
     Advanced filtering
     ------------------------- */
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (productCompanyFilter !== "all" && p.company !== productCompanyFilter) return false;
      return true;
    });
  }, [products, productCompanyFilter]);

  const filteredVariants = useMemo(() => {
    return variantsData.filter(v => {
      if (variantCompanyFilter !== "all" && v.product.company !== variantCompanyFilter) return false;
      if (variantProductFilter !== "all" && v.product.productName !== variantProductFilter) return false;
      if (variantSizeFilter !== "all" && v.packingSize !== variantSizeFilter) return false;
      return true;
    });
  }, [variantsData, variantCompanyFilter, variantProductFilter, variantSizeFilter]);

  const filteredColors = useMemo(() => {
    let filtered = colorsData;

    // Apply advanced filters first
    filtered = filtered.filter(c => {
      if (colorCompanyFilter !== "all" && c.variant.product.company !== colorCompanyFilter) return false;
      if (colorProductFilter !== "all" && c.variant.product.productName !== colorProductFilter) return false;
      if (colorSizeFilter !== "all" && c.variant.packingSize !== colorSizeFilter) return false;
      if (colorStockStatusFilter !== "all") {
        if (colorStockStatusFilter === "out" && c.stockQuantity !== 0) return false;
        if (colorStockStatusFilter === "low" && (c.stockQuantity === 0 || c.stockQuantity >= 10)) return false;
        if (colorStockStatusFilter === "in" && c.stockQuantity < 10) return false;
      }
      return true;
    });

    const query = colorSearchQuery.trim().toUpperCase();
    const queryLower = query.toLowerCase();
    if (!query) return filtered;

    return filtered
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.trim().toUpperCase();
        const colorCodeLower = colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

        // Exact match on normalized color code gets highest priority
        if (colorCode === query) score += 10000;
        else if (colorCodeLower === queryLower) score += 1000;
        else if (colorCodeLower.startsWith(queryLower)) score += 500;
        else if (colorCodeLower.includes(queryLower)) score += 100;

        if (colorName === queryLower) score += 200;
        else if (colorName.includes(queryLower)) score += 50;

        if (company.includes(queryLower)) score += 30;
        if (product.includes(queryLower)) score += 30;
        if (size.includes(queryLower)) score += 20;

        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colorsData, colorSearchQuery, colorCompanyFilter, colorProductFilter, colorSizeFilter, colorStockStatusFilter]);

  const filteredColorsForStockIn = useMemo(() => {
    const query = stockInSearchQuery.trim().toUpperCase();
    const queryLower = query.toLowerCase();
    if (!query) return colorsData;

    return colorsData
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.trim().toUpperCase();
        const colorCodeLower = colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

        // Exact match on normalized color code gets highest priority
        if (colorCode === query) score += 10000;
        else if (colorCodeLower === queryLower) score += 1000;
        else if (colorCodeLower.startsWith(queryLower)) score += 500;
        else if (colorCodeLower.includes(queryLower)) score += 100;

        if (colorName === queryLower) score += 200;
        else if (colorName.includes(queryLower)) score += 50;

        if (company.includes(queryLower)) score += 30;
        if (product.includes(queryLower)) score += 30;
        if (size.includes(queryLower)) score += 20;

        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colorsData, stockInSearchQuery]);

  /* Quick Add UI helpers */
  const updateVariant = (index: number, key: keyof QuickVariant, value: string) => {
    setQuickVariants(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeVariantAt = (index: number) => {
    setQuickVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, key: keyof QuickColor, value: string) => {
    setQuickColors(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeColorAt = (index: number) => {
    setQuickColors(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSection = (section: "variants" | "colors") => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  /* -------------------------
     Quick Add final save
     ------------------------- */
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  const saveQuickAdd = async () => {
    // Determine final company & product
    const company = useExistingCompany ? selectedCompany : newCompany.trim();
    const productName = useExistingProduct ? selectedProduct : newProduct.trim();

    // Basic validations
    if (!company) {
      toast({ title: "Company is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }
    if (!productName) {
      toast({ title: "Product name is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }

    const finalVariants = quickVariants
      .filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "")
      .map(v => ({ packingSize: v.packingSize.trim(), rate: v.rate.trim() }));

    if (finalVariants.length === 0) {
      toast({ title: "Add at least one variant", variant: "destructive" });
      setQuickStep(2);
      return;
    }

    const finalColors = quickColors
      .filter(c => c.colorName.trim() !== "" && c.colorCode.trim() !== "" && c.stockQuantity.trim() !== "")
      .map(c => ({ colorName: c.colorName.trim(), colorCode: c.colorCode.trim(), stockQuantity: c.stockQuantity.trim() }));

    setIsSavingQuick(true);
    try {
      // Check existing product
      let productId: string | undefined;
      const existingProduct = products.find(p => p.company === company && p.productName === productName);
      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        const resp = await createProductMutation.mutateAsync({ company, productName });
        productId = resp?.id;
      }

      if (!productId) throw new Error("Product creation failed: no id returned");

      // Create variants and capture ids
      const createdVariantIds: string[] = [];
      for (const variant of finalVariants) {
        const vResp = await createVariantMutation.mutateAsync({ productId, packingSize: variant.packingSize, rate: parseFloat(variant.rate) });
        createdVariantIds.push(vResp.id);
      }

      // Create colors for each created variant
      if (finalColors.length > 0) {
        for (const variantId of createdVariantIds) {
          for (const color of finalColors) {
            await createColorMutation.mutateAsync({
              variantId,
              colorName: color.colorName,
              colorCode: color.colorCode,
              stockQuantity: parseInt(color.stockQuantity, 10),
            });
          }
        }
      }

      toast({
        title: "Saved successfully",
        description: `Product "${productName}" with ${finalVariants.length} variants and ${finalColors.length} colors added successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });

      // Reset wizard
      setIsQuickAddOpen(false);
      setQuickStep(1);
      setSelectedCompany("");
      setSelectedProduct("");
      setNewCompany("");
      setNewProduct("");
      setUseExistingCompany(true);
      setUseExistingProduct(true);
      setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
      setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
    } catch (err: any) {
      console.error("Quick Add save error:", err);
      toast({ title: "Save failed", description: err?.message || "Unknown error occurred", variant: "destructive" });
    } finally {
      setIsSavingQuick(false);
    }
  };

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, variants, colors, and stock</p>
        </div>

        {/* Quick Add Button */}
        <div>
          <Dialog open={isQuickAddOpen} onOpenChange={(open) => {
            setIsQuickAddOpen(open);
            if (!open) {
              // reset wizard on close
              setQuickStep(1);
              setSelectedCompany("");
              setSelectedProduct("");
              setNewCompany("");
              setNewProduct("");
              setUseExistingCompany(true);
              setUseExistingProduct(true);
              setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
              setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
            }
          }}>
            <Button onClick={() => setIsQuickAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Quick Add Product
            </Button>

            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quick Add Product</DialogTitle>
                <DialogDescription>Add complete product with variants and colors</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Progress indicator */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded ${quickStep === 1 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>1. Product</div>
                  <div className={`px-3 py-1 rounded ${quickStep === 2 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>2. Variants</div>
                  <div className={`px-3 py-1 rounded ${quickStep === 3 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>3. Colors</div>
                </div>

                {/* Step 1: Product */}
                {quickStep === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Company</Label>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="existing-company" checked={useExistingCompany} onChange={() => setUseExistingCompany(true)} className="h-4 w-4" />
                          <Label htmlFor="existing-company" className="text-sm">Select Existing</Label>
                          <input type="radio" id="new-company" checked={!useExistingCompany} onChange={() => setUseExistingCompany(false)} className="h-4 w-4" />
                          <Label htmlFor="new-company" className="text-sm">Add New</Label>
                        </div>
                      </div>

                      {useExistingCompany ? (
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map(company => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Enter new company name" />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Product</Label>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="existing-product" checked={useExistingProduct} onChange={() => setUseExistingProduct(true)} className="h-4 w-4" disabled={!selectedCompany && useExistingCompany} />
                          <Label htmlFor="existing-product" className="text-sm">Select Existing</Label>
                          <input type="radio" id="new-product" checked={!useExistingProduct} onChange={() => setUseExistingProduct(false)} className="h-4 w-4" />
                          <Label htmlFor="new-product" className="text-sm">Add New</Label>
                        </div>
                      </div>

                      {useExistingProduct ? (
                        <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedCompany}>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedCompany ? "Select product" : "Select company first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {productsByCompany.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={newProduct} onChange={e => setNewProduct(e.target.value)} placeholder="Enter new product name" />
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                      <Button onClick={() => setQuickStep(2)} disabled={
                        !(useExistingCompany ? selectedCompany : newCompany.trim()) ||
                        !(useExistingProduct ? selectedProduct : newProduct.trim())
                      }>
                        Continue to Variants →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Variants */}
                {quickStep === 2 && (
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("variants")}>
                        <h3 className="font-semibold text-lg">Variants</h3>
                        <Button variant="ghost" size="sm">{expandedSections.variants ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                      </div>

                      {expandedSections.variants && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-3">
                            {quickVariants.map((variant, index) => (
                              <div key={variant.id} className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5">
                                  <Input placeholder="Packing size (e.g., 1L, 4L, 16L)" value={variant.packingSize} onChange={e => updateVariant(index, "packingSize", e.target.value)} />
                                </div>
                                <div className="col-span-5">
                                  <Input type="number" step="0.01" placeholder="Rate (Rs.)" value={variant.rate} onChange={e => updateVariant(index, "rate", e.target.value)} />
                                </div>
                                <div className="col-span-2">
                                  <Button variant="ghost" size="sm" onClick={() => removeVariantAt(index)} disabled={quickVariants.length === 1}><Trash className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button size="sm" variant="outline" onClick={() => setQuickVariants(p => [...p, { id: String(Date.now()), packingSize: "", rate: "" }])}><Plus className="mr-2 h-4 w-4" /> Add Variant</Button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" onClick={() => setQuickStep(1)}>← Back</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                        <Button onClick={() => setQuickStep(3)} disabled={quickVariants.filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "").length === 0}>Continue to Colors →</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Colors */}
                {quickStep === 3 && (
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("colors")}>
                        <h3 className="font-semibold text-lg">Colors</h3>
                        <Button variant="ghost" size="sm">{expandedSections.colors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                      </div>

                      {expandedSections.colors && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-3">
                            {quickColors.map((color, index) => (
                              <div key={color.id} className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-4">
                                  <Input placeholder="Color name" value={color.colorName} onChange={e => updateColor(index, "colorName", e.target.value)} />
                                </div>
                                <div className="col-span-4">
                                  <Input placeholder="Color code" value={color.colorCode} onChange={e => updateColor(index, "colorCode", e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                  <Input type="number" min="0" placeholder="Quantity" value={color.stockQuantity} onChange={e => updateColor(index, "stockQuantity", e.target.value)} />
                                </div>
                                <div className="col-span-1">
                                  <Button variant="ghost" size="sm" onClick={() => removeColorAt(index)} disabled={quickColors.length === 1}><Trash className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button size="sm" variant="outline" onClick={() => setQuickColors(p => [...p, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }])}><Plus className="mr-2 h-4 w-4" /> Add Color</Button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" onClick={() => setQuickStep(2)}>← Back</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                        <Button onClick={saveQuickAdd} disabled={isSavingQuick}>{isSavingQuick ? "Saving..." : "Save Product"}</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs: Quick Add + Products/Variants/Colors/Stock In */}
      <Tabs defaultValue="quick-add" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick-add"><Plus className="mr-2 h-4 w-4" /> Quick Add</TabsTrigger>
          <TabsTrigger value="products"><Package className="mr-2 h-4 w-4" /> Products</TabsTrigger>
          <TabsTrigger value="variants"><Layers className="mr-2 h-4 w-4" /> Variants</TabsTrigger>
          <TabsTrigger value="colors"><Palette className="mr-2 h-4 w-4" /> Colors</TabsTrigger>
          <TabsTrigger value="stock-in"><TruckIcon className="mr-2 h-4 w-4" /> Stock In</TabsTrigger>
        </TabsList>

        {/* Quick Add Tab (summary) */}
        <TabsContent value="quick-add" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <CardTitle>Quick Add — All-in-One Wizard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Quickly add full product + variants + colors in one flow. Click the Quick Add button above to start the wizard.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Package className="h-8 w-8 mx-auto text-blue-500" />
                    <h3 className="font-semibold">Products</h3>
                    <p className="text-2xl font-bold text-blue-600">{products.length}</p>
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Layers className="h-8 w-8 mx-auto text-green-500" />
                    <h3 className="font-semibold">Variants</h3>
                    <p className="text-2xl font-bold text-green-600">{variantsData.length}</p>
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Palette className="h-8 w-8 mx-auto text-purple-500" />
                    <h3 className="font-semibold">Colors</h3>
                    <p className="text-2xl font-bold text-purple-600">{colorsData.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Products ({products.length})</CardTitle>
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <Button onClick={() => setIsProductDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>Add company and product name</DialogDescription>
                  </DialogHeader>
                  <Form {...productForm}>
                    <form onSubmit={productForm.handleSubmit((data) => createProductSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={productForm.control} name="company" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Premium Paint Co" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={productForm.control} name="productName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Exterior Emulsion" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createProductSingleMutation.isPending}>{createProductSingleMutation.isPending ? "Creating..." : "Create Product"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No products found. Add your first product to get started.</div>
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Filter by Company</Label>
                      <Select value={productCompanyFilter} onValueChange={setProductCompanyFilter}>
                        <SelectTrigger><SelectValue placeholder="All Companies" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {productCompanyFilter !== "all" && (
                      <Button variant="outline" size="sm" onClick={() => setProductCompanyFilter("all")}>Clear Filters</Button>
                    )}
                  </div>

                  {/* Bulk Actions */}
                  {selectedProducts.size > 0 && (
                    <div className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">{selectedProducts.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedProducts.size} selected product(s)? This will also delete all associated variants and colors.`)) {
                            bulkDeleteProductsMutation.mutate(Array.from(selectedProducts));
                          }
                        }}
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <input
                            type="checkbox"
                            checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
                              } else {
                                setSelectedProducts(new Set());
                              }
                            }}
                            className="h-4 w-4"
                          />
                        </TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Variants</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map(product => {
                        const productVariants = variantsData.filter(v => v.productId === product.id);
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedProducts.has(product.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedProducts);
                                  if (e.target.checked) {
                                    newSet.add(product.id);
                                  } else {
                                    newSet.delete(product.id);
                                  }
                                  setSelectedProducts(newSet);
                                }}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{product.company}</TableCell>
                            <TableCell>{product.productName}</TableCell>
                            <TableCell><Badge variant="outline">{productVariants.length} variants</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewingProduct(product)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete "${product.productName}"? This will also delete all associated variants and colors.`)) {
                                        deleteProductMutation.mutate(product.id);
                                      }
                                    }}
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Variants ({variantsData.length})</CardTitle>
              <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                <Button onClick={() => setIsVariantDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Variant</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Variant</DialogTitle>
                    <DialogDescription>Select product, packing size, and rate</DialogDescription>
                  </DialogHeader>
                  <Form {...variantForm}>
                    <form onSubmit={variantForm.handleSubmit((data) => createVariantSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={variantForm.control} name="productId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.company} - {p.productName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={variantForm.control} name="packingSize" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Packing Size</FormLabel>
                          <FormControl><Input placeholder="e.g., 1L, 4L, 16L" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={variantForm.control} name="rate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rate (Rs.)</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="e.g., 250.00" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsVariantDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createVariantSingleMutation.isPending}>{createVariantSingleMutation.isPending ? "Creating..." : "Create Variant"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {variantsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : variantsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No variants found. Add a product first, then create variants.</div>
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs">Company</Label>
                      <Select value={variantCompanyFilter} onValueChange={setVariantCompanyFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs">Product</Label>
                      <Select value={variantProductFilter} onValueChange={setVariantProductFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          {Array.from(new Set(variantsData.map(v => v.product.productName))).sort().map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs">Packing Size</Label>
                      <Select value={variantSizeFilter} onValueChange={setVariantSizeFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sizes</SelectItem>
                          {Array.from(new Set(variantsData.map(v => v.packingSize))).sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(variantCompanyFilter !== "all" || variantProductFilter !== "all" || variantSizeFilter !== "all") && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setVariantCompanyFilter("all");
                        setVariantProductFilter("all");
                        setVariantSizeFilter("all");
                      }}>Clear Filters</Button>
                    )}
                  </div>

                  {/* Bulk Actions */}
                  {selectedVariants.size > 0 && (
                    <div className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">{selectedVariants.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedVariants.size} selected variant(s)? This will also delete all associated colors.`)) {
                            bulkDeleteVariantsMutation.mutate(Array.from(selectedVariants));
                          }
                        }}
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <input
                            type="checkbox"
                            checked={filteredVariants.length > 0 && selectedVariants.size === filteredVariants.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVariants(new Set(filteredVariants.map(v => v.id)));
                              } else {
                                setSelectedVariants(new Set());
                              }
                            }}
                            className="h-4 w-4"
                          />
                        </TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Packing Size</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Colors</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVariants.map(variant => {
                        const variantColors = colorsData.filter(c => c.variantId === variant.id);
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedVariants.has(variant.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedVariants);
                                  if (e.target.checked) {
                                    newSet.add(variant.id);
                                  } else {
                                    newSet.delete(variant.id);
                                  }
                                  setSelectedVariants(newSet);
                                }}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{variant.product.company}</TableCell>
                            <TableCell>{variant.product.productName}</TableCell>
                            <TableCell>{variant.packingSize}</TableCell>
                            <TableCell>Rs. {Math.round(parseFloat(variant.rate))}</TableCell>
                            <TableCell><Badge variant="outline">{variantColors.length} colors</Badge></TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewingVariant(variant)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingVariant(variant)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete "${variant.packingSize}" variant? This will also delete all associated colors.`)) {
                                        deleteVariantMutation.mutate(variant.id);
                                      }
                                    }}
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Colors & Inventory ({colorsData.length})</CardTitle>
              <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
                <Button onClick={() => setIsColorDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Color</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Color</DialogTitle>
                    <DialogDescription>Select variant and add color details with quantity</DialogDescription>
                  </DialogHeader>
                  <Form {...colorForm}>
                    <form onSubmit={colorForm.handleSubmit((data) => createColorSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={colorForm.control} name="variantId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variant (Product + Size)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {variantsData.map(v => <SelectItem key={v.id} value={v.id}>{v.product.company} - {v.product.productName} ({v.packingSize})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="colorName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Sky Blue" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Code</FormLabel>
                          <FormControl><Input placeholder="e.g., RAL 5002" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl><Input type="number" min="0" placeholder="e.g., 50" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsColorDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createColorSingleMutation.isPending}>{createColorSingleMutation.isPending ? "Adding..." : "Add Color"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-4">
              {colorsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No colors found. Add a variant first, then add colors with inventory.</div>
              ) : (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by color code, name, product, company..." value={colorSearchQuery} onChange={e => setColorSearchQuery(e.target.value)} className="pl-9" />
                  </div>

                  {/* Advanced Filters */}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs">Company</Label>
                      <Select value={colorCompanyFilter} onValueChange={setColorCompanyFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs">Product</Label>
                      <Select value={colorProductFilter} onValueChange={setColorProductFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          {Array.from(new Set(colorsData.map(c => c.variant.product.productName))).sort().map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs">Size</Label>
                      <Select value={colorSizeFilter} onValueChange={setColorSizeFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sizes</SelectItem>
                          {Array.from(new Set(colorsData.map(c => c.variant.packingSize))).sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs">Stock Status</Label>
                      <Select value={colorStockStatusFilter} onValueChange={setColorStockStatusFilter}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="out">Out of Stock</SelectItem>
                          <SelectItem value="low">Low Stock</SelectItem>
                          <SelectItem value="in">In Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(colorCompanyFilter !== "all" || colorProductFilter !== "all" || colorSizeFilter !== "all" || colorStockStatusFilter !== "all") && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setColorCompanyFilter("all");
                        setColorProductFilter("all");
                        setColorSizeFilter("all");
                        setColorStockStatusFilter("all");
                      }}>Clear Filters</Button>
                    )}
                  </div>

                  {/* Bulk Actions */}
                  {selectedColors.size > 0 && (
                    <div className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">{selectedColors.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedColors.size} selected color(s)?`)) {
                            bulkDeleteColorsMutation.mutate(Array.from(selectedColors));
                          }
                        }}
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {filteredColors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No colors found matching your filters</div>
                  ) : (
                    <div className="space-y-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <input
                                type="checkbox"
                                checked={filteredColors.length > 0 && selectedColors.size === filteredColors.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedColors(new Set(filteredColors.map(c => c.id)));
                                  } else {
                                    setSelectedColors(new Set());
                                  }
                                }}
                                className="h-4 w-4"
                              />
                            </TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Color Name</TableHead>
                            <TableHead>Color Code</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredColors.map(color => (
                            <TableRow key={color.id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedColors.has(color.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedColors);
                                    if (e.target.checked) {
                                      newSet.add(color.id);
                                    } else {
                                      newSet.delete(color.id);
                                    }
                                    setSelectedColors(newSet);
                                  }}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{color.variant.product.company}</TableCell>
                              <TableCell>{color.variant.product.productName}</TableCell>
                              <TableCell>{color.variant.packingSize}</TableCell>
                              <TableCell>{color.colorName}</TableCell>
                              <TableCell><Badge variant="outline">{color.colorCode}</Badge></TableCell>
                              <TableCell>{color.stockQuantity}</TableCell>
                              <TableCell>{getStockBadge(color.stockQuantity)}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setViewingColor(color)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEditingColor(color)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete "${color.colorName}" (${color.colorCode})?`)) {
                                          deleteColorMutation.mutate(color.id);
                                        }
                                      }}
                                    >
                                      <Trash className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {(colorSearchQuery || colorCompanyFilter !== "all" || colorProductFilter !== "all" || colorSizeFilter !== "all" || colorStockStatusFilter !== "all") && (
                        <p className="text-xs text-muted-foreground text-center">Showing {filteredColors.length} of {colorsData.length} colors</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock In Tab */}
        <TabsContent value="stock-in" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock In</CardTitle>
              <p className="text-sm text-muted-foreground">Search and add inventory to existing colors</p>
            </CardHeader>
            <CardContent>
              {colorsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No colors found. Add colors first before using stock in.</div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by color code, name, company, or product..." value={stockInSearchQuery} onChange={e => setStockInSearchQuery(e.target.value)} className="pl-10" />
                  </div>

                  {filteredColorsForStockIn.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No colors found matching your search.</div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredColorsForStockIn.map(color => (
                        <Card key={color.id} className="hover-elevate" >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono font-semibold">{color.colorCode}</Badge>
                                  <span className="text-sm font-medium truncate">{color.colorName}</span>
                                  {getStockBadge(color.stockQuantity)}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                  Current Stock: <span className="font-semibold text-foreground">{color.stockQuantity}</span>
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => {
                                  stockInForm.setValue("colorId", color.id);
                                  stockInForm.setValue("quantity", "");
                                  setSelectedColorForStockIn(color);
                                  setIsStockInDialogOpen(true);
                                }}>
                                  <Plus className="h-4 w-4 mr-1" /> Add Stock
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setViewingColor(color)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEditingColor(color)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {stockInSearchQuery && filteredColorsForStockIn.length > 0 && <p className="text-xs text-muted-foreground text-center">Showing {filteredColorsForStockIn.length} of {colorsData.length} colors</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock In Dialog */}
          <Dialog open={isStockInDialogOpen} onOpenChange={(open) => {
            setIsStockInDialogOpen(open);
            if (!open) {
              setSelectedColorForStockIn(null);
              setStockInSearchQuery("");
              stockInForm.reset();
            }
          }}>
            <DialogContent className="max-w-3xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Add Stock</DialogTitle>
                <DialogDescription>Add quantity to inventory</DialogDescription>
              </DialogHeader>

              {!selectedColorForStockIn ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by color code, name, product, or company..." value={stockInSearchQuery} onChange={e => setStockInSearchQuery(e.target.value)} className="pl-10" />
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {filteredColorsForStockIn.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{stockInSearchQuery ? "No colors found matching your search" : "No colors available"}</p>
                      </div>
                    ) : (
                      filteredColorsForStockIn.map(color => (
                        <Card key={color.id} className="hover-elevate cursor-pointer" onClick={() => {
                          setSelectedColorForStockIn(color);
                          stockInForm.setValue("colorId", color.id);
                        }}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold font-mono text-sm">{color.colorCode}</span>
                                  <Badge variant="outline" className="text-xs">Stock: {color.stockQuantity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{color.colorName}</p>
                                <p className="text-xs text-muted-foreground">{color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {stockInSearchQuery && filteredColorsForStockIn.length > 0 && <p className="text-xs text-muted-foreground text-center">Showing {filteredColorsForStockIn.length} of {colorsData.length} colors</p>}
                </div>
              ) : (
                <Form {...stockInForm}>
                  <form onSubmit={stockInForm.handleSubmit((data) => stockInMutation.mutate(data))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selected Color</Label>
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold font-mono text-sm">{selectedColorForStockIn.colorCode}</span>
                                <Badge variant="outline" className="text-xs">Current Stock: {selectedColorForStockIn.stockQuantity}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{selectedColorForStockIn.colorName}</p>
                              <p className="text-xs text-muted-foreground">{selectedColorForStockIn.variant.product.company} - {selectedColorForStockIn.variant.product.productName} ({selectedColorForStockIn.variant.packingSize})</p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedColorForStockIn(null)}>Change</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <FormField control={stockInForm.control} name="quantity" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity to Add</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" step="1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setSelectedColorForStockIn(null);
                        setStockInSearchQuery("");
                        stockInForm.reset();
                      }}>Cancel</Button>
                      <Button type="submit" disabled={stockInMutation.isPending}>{stockInMutation.isPending ? "Adding..." : "Add Stock"}</Button>
                    </div>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Edit Dialogs */}
      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit((data) => {
              if (editingProduct) {
                updateProductMutation.mutate({ id: editingProduct.id, ...data });
              }
            })} className="space-y-4">
              <FormField control={productForm.control} name="company" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={productForm.control} name="productName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                <Button type="submit" disabled={updateProductMutation.isPending}>
                  {updateProductMutation.isPending ? "Updating..." : "Update Product"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Dialog */}
      <Dialog open={!!editingVariant} onOpenChange={(open) => !open && setEditingVariant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit((data) => {
              if (editingVariant) {
                updateVariantMutation.mutate({ 
                  id: editingVariant.id, 
                  ...data, 
                  rate: parseFloat(data.rate) 
                });
              }
            })} className="space-y-4">
              <FormField control={variantForm.control} name="productId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.company} - {p.productName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={variantForm.control} name="packingSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Packing Size</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={variantForm.control} name="rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (Rs.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingVariant(null)}>Cancel</Button>
                <Button type="submit" disabled={updateVariantMutation.isPending}>
                  {updateVariantMutation.isPending ? "Updating..." : "Update Variant"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Color Dialog */}
      <Dialog open={!!editingColor} onOpenChange={(open) => !open && setEditingColor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Color</DialogTitle>
          </DialogHeader>
          <Form {...colorForm}>
            <form onSubmit={colorForm.handleSubmit((data) => {
              if (editingColor) {
                updateColorMutation.mutate({ 
                  id: editingColor.id, 
                  ...data, 
                  stockQuantity: parseInt(data.stockQuantity, 10) 
                });
              }
            })} className="space-y-4">
              <FormField control={colorForm.control} name="variantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant (Product + Size)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {variantsData.map(v => <SelectItem key={v.id} value={v.id}>{v.product.company} - {v.product.productName} ({v.packingSize})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="colorName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Code</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingColor(null)}>Cancel</Button>
                <Button type="submit" disabled={updateColorMutation.isPending}>
                  {updateColorMutation.isPending ? "Updating..." : "Update Color"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialogs */}
      {/* View Product Details */}
      <Dialog open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Company</Label>
                  <p className="text-sm">{viewingProduct.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Product Name</Label>
                  <p className="text-sm">{viewingProduct.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created Date</Label>
                  <p className="text-sm">{new Date(viewingProduct.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Variants Count</Label>
                  <p className="text-sm">{variantsData.filter(v => v.productId === viewingProduct.id).length}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingProduct(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Variant Details */}
      <Dialog open={!!viewingVariant} onOpenChange={(open) => !open && setViewingVariant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Variant Details</DialogTitle>
          </DialogHeader>
          {viewingVariant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Company</Label>
                  <p className="text-sm">{viewingVariant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Product Name</Label>
                  <p className="text-sm">{viewingVariant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Packing Size</Label>
                  <p className="text-sm">{viewingVariant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Rate</Label>
                  <p className="text-sm">Rs. {Math.round(parseFloat(viewingVariant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Colors Count</Label>
                  <p className="text-sm">{colorsData.filter(c => c.variantId === viewingVariant.id).length}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created Date</Label>
                  <p className="text-sm">{new Date(viewingVariant.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingVariant(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Color Details */}
      <Dialog open={!!viewingColor} onOpenChange={(open) => !open && setViewingColor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Color Details</DialogTitle>
          </DialogHeader>
          {viewingColor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Company</Label>
                  <p className="text-sm">{viewingColor.variant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Product Name</Label>
                  <p className="text-sm">{viewingColor.variant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Packing Size</Label>
                  <p className="text-sm">{viewingColor.variant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Rate</Label>
                  <p className="text-sm">Rs. {Math.round(parseFloat(viewingColor.variant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Color Name</Label>
                  <p className="text-sm">{viewingColor.colorName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Color Code</Label>
                  <p className="text-sm font-mono">{viewingColor.colorCode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stock Quantity</Label>
                  <p className="text-sm">{viewingColor.stockQuantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stock Status</Label>
                  <div className="text-sm">{getStockBadge(viewingColor.stockQuantity)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created Date</Label>
                  <p className="text-sm">{new Date(viewingColor.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingColor(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
