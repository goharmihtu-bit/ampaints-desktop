// stock-management.tsx - Premium Glass Theme Redesign
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
  DialogFooter,
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
  History,
  Calendar,
  Filter,
  Download,
  FileText,
  RefreshCw,
  Sparkles,
  TrendingUp,
  BarChart3,
  Warehouse,
  PaintBucket,
  ArrowUpCircle,
  Database,
  Zap
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, VariantWithProduct, ColorWithVariantAndProduct } from "@shared/schema";
import { getEffectiveRate, formatDateToDDMMYYYY, parseDDMMYYYYToDate } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

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
  rateOverride: z.string().optional(),
});

const stockInFormSchema = z.object({
  colorId: z.string().min(1, "Color is required"),
  quantity: z.string().min(1, "Quantity is required"),
  notes: z.string().optional(),
  stockInDate: z.string().min(1, "Date is required").regex(/^\d{2}-\d{2}-\d{4}$/, "Date must be in DD-MM-YYYY format"),
});

const stockHistoryEditSchema = z.object({
  quantity: z.string().min(1, "Quantity is required"),
  notes: z.string().optional(),
  stockInDate: z.string().min(1, "Date is required").regex(/^\d{2}-\d{2}-\d{4}$/, "Date must be in DD-MM-YYYY format"),
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
  rateOverride?: string;
};

/* -------------------------
   Stock In History Types
   ------------------------- */
interface StockInHistory {
  id: string;
  colorId: string;
  color: ColorWithVariantAndProduct;
  quantity: number;
  previousStock: number;
  newStock: number;
  notes?: string;
  stockInDate: string;
  createdAt: string;
}

/* -------------------------
   Stock Out History Types (Items sold through POS)
   ------------------------- */
interface StockOutHistory {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color: ColorWithVariantAndProduct;
  soldAt: string;
  customerName: string;
  customerPhone: string;
}

/* -------------------------
   Main component
   ------------------------- */
export default function StockManagement() {
  const { formatDateShort } = useDateFormat();
  
  /* Dialog visibility */
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [isEditStockHistoryOpen, setIsEditStockHistoryOpen] = useState(false);

  /* Edit states */
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<VariantWithProduct | null>(null);
  const [editingColor, setEditingColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [editingStockHistory, setEditingStockHistory] = useState<StockInHistory | null>(null);

  /* Detail view states */
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingVariant, setViewingVariant] = useState<VariantWithProduct | null>(null);
  const [viewingColor, setViewingColor] = useState<ColorWithVariantAndProduct | null>(null);

  /* Quick Add wizard */
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickStep, setQuickStep] = useState<number>(1);
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
    { id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "", rateOverride: "" },
  ]);
  const [expandedSections, setExpandedSections] = useState({ variants: true, colors: true });

  const { toast } = useToast();
  const { canDeleteStock, canEditStock, canDeleteStockHistory } = usePermissions();

  /* Search & stock-in state */
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
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

  /* Stock In History filters */
  const [historyCompanyFilter, setHistoryCompanyFilter] = useState("all");
  const [historyProductFilter, setHistoryProductFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");

  /* Stock Out History filters (items sold through POS) */
  const [stockOutCompanyFilter, setStockOutCompanyFilter] = useState("all");
  const [stockOutProductFilter, setStockOutProductFilter] = useState("all");
  const [stockOutDateFilter, setStockOutDateFilter] = useState("all");
  const [stockOutSearchQuery, setStockOutSearchQuery] = useState("");
  const [stockOutStartDate, setStockOutStartDate] = useState<string>("");
  const [stockOutEndDate, setStockOutEndDate] = useState<string>("");

  /* Multi-select state */
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  /* -------------------------
     Queries
     ------------------------- */
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchOnWindowFocus: true, // Auto-refresh when tab becomes active
  });

  const { data: variantsData = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
    refetchOnWindowFocus: true, // Auto-refresh when tab becomes active
  });

  const { data: colorsData = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    refetchOnWindowFocus: true, // Auto-refresh when tab becomes active
  });

  /* Stock In History Query */
  const { data: stockInHistory = [], isLoading: historyLoading, refetch: refetchStockHistory } = useQuery<StockInHistory[]>({
    queryKey: ["/api/stock-in/history"],
  });

  /* Filtered Stock In History */
  const filteredStockInHistory = useMemo(() => {
    let filtered = stockInHistory;

    // Apply company filter
    if (historyCompanyFilter !== "all") {
      filtered = filtered.filter(history => 
        history.color.variant.product.company === historyCompanyFilter
      );
    }

    // Apply product filter
    if (historyProductFilter !== "all") {
      filtered = filtered.filter(history => 
        history.color.variant.product.productName === historyProductFilter
      );
    }

    // Apply date filter
    if (historyDateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      filtered = filtered.filter(history => {
        const historyDate = new Date(history.createdAt);
        
        switch (historyDateFilter) {
          case "today":
            return historyDate >= today;
          case "yesterday":
            return historyDate >= yesterday && historyDate < today;
          case "week":
            return historyDate >= lastWeek;
          case "month":
            return historyDate >= lastMonth;
          default:
            return true;
        }
      });
    }

    // Apply custom date range filter
    if (historyStartDate) {
      const start = new Date(historyStartDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(history => new Date(history.createdAt) >= start);
    }

    if (historyEndDate) {
      const end = new Date(historyEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(history => new Date(history.createdAt) <= end);
    }

    // Apply search filter
    if (historySearchQuery.trim()) {
      const query = historySearchQuery.trim().toLowerCase();
      filtered = filtered.filter(history => 
        history.color.colorCode.toLowerCase().includes(query) ||
        history.color.colorName.toLowerCase().includes(query) ||
        history.color.variant.product.company.toLowerCase().includes(query) ||
        history.color.variant.product.productName.toLowerCase().includes(query) ||
        history.stockInDate.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockInHistory, historyCompanyFilter, historyProductFilter, historyDateFilter, historySearchQuery, historyStartDate, historyEndDate]);

  /* Stock Out History Query (Items sold through POS) */
  const { data: stockOutHistory = [], isLoading: stockOutLoading, refetch: refetchStockOutHistory } = useQuery<StockOutHistory[]>({
    queryKey: ["/api/stock-out/history"],
  });

  /* Filtered Stock Out History */
  const filteredStockOutHistory = useMemo(() => {
    let filtered = stockOutHistory;

    if (stockOutCompanyFilter !== "all") {
      filtered = filtered.filter(item => 
        item.color?.variant?.product?.company === stockOutCompanyFilter
      );
    }

    if (stockOutProductFilter !== "all") {
      filtered = filtered.filter(item => 
        item.color?.variant?.product?.productName === stockOutProductFilter
      );
    }

    if (stockOutDateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      filtered = filtered.filter(item => {
        const soldDate = new Date(item.soldAt);
        switch (stockOutDateFilter) {
          case "today": return soldDate >= today;
          case "yesterday": return soldDate >= yesterday && soldDate < today;
          case "week": return soldDate >= lastWeek;
          case "month": return soldDate >= lastMonth;
          default: return true;
        }
      });
    }

    if (stockOutStartDate) {
      const start = new Date(stockOutStartDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => new Date(item.soldAt) >= start);
    }

    if (stockOutEndDate) {
      const end = new Date(stockOutEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => new Date(item.soldAt) <= end);
    }

    if (stockOutSearchQuery.trim()) {
      const query = stockOutSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.color?.colorCode?.toLowerCase().includes(query) ||
        item.color?.colorName?.toLowerCase().includes(query) ||
        item.color?.variant?.product?.company?.toLowerCase().includes(query) ||
        item.color?.variant?.product?.productName?.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.customerPhone?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [stockOutHistory, stockOutCompanyFilter, stockOutProductFilter, stockOutDateFilter, stockOutSearchQuery, stockOutStartDate, stockOutEndDate]);

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
    defaultValues: { 
      colorId: "", 
      quantity: "", 
      notes: "",
      stockInDate: formatDateToDDMMYYYY(new Date())
    },
  });

  const stockHistoryEditForm = useForm<z.infer<typeof stockHistoryEditSchema>>({
    resolver: zodResolver(stockHistoryEditSchema),
    defaultValues: { 
      quantity: "", 
      notes: "",
      stockInDate: formatDateToDDMMYYYY(new Date())
    },
  });

  /* -------------------------
     Quick Add auto-append empty rows
     ------------------------- */
  useEffect(() => {
    const last = quickVariants[quickVariants.length - 1];
    if (last && (last.packingSize.trim() !== "" || last.rate.trim() !== "")) {
      setQuickVariants(prev => [...prev, { id: String(Date.now()), packingSize: "", rate: "" }]);
    }
  }, [quickVariants.length]);

  useEffect(() => {
    const last = quickColors[quickColors.length - 1];
    if (last && (last.colorName.trim() !== "" || last.colorCode.trim() !== "" || last.stockQuantity.trim() !== "")) {
      setQuickColors(prev => [...prev, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }]);
    }
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
      colorForm.setValue("rateOverride", editingColor.rateOverride || "");
    }
  }, [editingColor, colorForm]);

  useEffect(() => {
    if (editingStockHistory) {
      stockHistoryEditForm.setValue("quantity", String(editingStockHistory.quantity));
      stockHistoryEditForm.setValue("notes", editingStockHistory.notes || "");
      stockHistoryEditForm.setValue("stockInDate", editingStockHistory.stockInDate);
    }
  }, [editingStockHistory, stockHistoryEditForm]);

  /* -------------------------
     Mutations (same as before)
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
    onError: (error: any) => {
      console.error("Create product error:", error);
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; company: string; productName: string }) => {
      const res = await apiRequest("PATCH", `/api/products/${data.id}`, {
        company: data.company,
        productName: data.productName,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
    },
    onError: (error: any) => {
      console.error("Update product error:", error);
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
    onError: (error: any) => {
      console.error("Delete product error:", error);
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
    onError: (error: any) => {
      console.error("Bulk delete products error:", error);
      toast({ title: "Failed to delete products", variant: "destructive" });
    },
  });

  const createVariantSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof variantFormSchema>) => {
      const res = await apiRequest("POST", "/api/variants", { 
        ...data, 
        rate: parseFloat(data.rate) 
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Variant created successfully" });
      variantForm.reset();
      setIsVariantDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Create variant error:", error);
      toast({ title: "Failed to create variant", variant: "destructive" });
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: async (data: { id: string; productId: string; packingSize: string; rate: number }) => {
      const res = await apiRequest("PATCH", `/api/variants/${data.id}`, {
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
    onError: (error: any) => {
      console.error("Update variant error:", error);
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
    onError: (error: any) => {
      console.error("Delete variant error:", error);
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
    onError: (error: any) => {
      console.error("Bulk delete variants error:", error);
      toast({ title: "Failed to delete variants", variant: "destructive" });
    },
  });

  const createColorSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof colorFormSchema>) => {
      const res = await apiRequest("POST", "/api/colors", { 
        ...data, 
        stockQuantity: parseInt(data.stockQuantity, 10) 
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      toast({ title: "Color added successfully" });
      colorForm.reset();
      setIsColorDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Create color error:", error);
      toast({ title: "Failed to add color", variant: "destructive" });
    },
  });

  const updateColorMutation = useMutation({
    mutationFn: async (data: { id: string; variantId: string; colorName: string; colorCode: string; stockQuantity: number }) => {
      const res = await apiRequest("PATCH", `/api/colors/${data.id}`, {
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
    onError: (error: any) => {
      console.error("Update color error:", error);
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
    onError: (error: any) => {
      console.error("Delete color error:", error);
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
    onError: (error: any) => {
      console.error("Bulk delete colors error:", error);
      toast({ title: "Failed to delete colors", variant: "destructive" });
    },
  });

  /* Quick Add bulk mutations */
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
    mutationFn: async (data: { variantId: string; colorName: string; colorCode: string; stockQuantity: number; rateOverride?: number }) => {
      const res = await apiRequest("POST", "/api/colors", data);
      return await res.json();
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockInFormSchema>) => {
      const res = await apiRequest("POST", `/api/colors/${data.colorId}/stock-in`, { 
        quantity: parseInt(data.quantity, 10),
        notes: data.notes,
        stockInDate: data.stockInDate
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      toast({ title: "Stock added successfully" });
      stockInForm.reset({
        stockInDate: formatDateToDDMMYYYY(new Date())
      });
      setIsStockInDialogOpen(false);
      setSelectedColorForStockIn(null);
    },
    onError: (error: any) => {
      console.error("Stock in error:", error);
      toast({ title: "Failed to add stock", variant: "destructive" });
    },
  });

  /* Stock History mutations */
  const deleteStockHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/stock-in/history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      toast({ title: "Stock history record deleted successfully" });
    },
    onError: (error: any) => {
      console.error("Delete stock history error:", error);
      toast({ title: "Failed to delete stock history record", variant: "destructive" });
    },
  });

  const updateStockHistoryMutation = useMutation({
    mutationFn: async (data: { id: string; quantity?: number; notes?: string; stockInDate?: string }) => {
      const res = await apiRequest("PATCH", `/api/stock-in/history/${data.id}`, {
        quantity: data.quantity,
        notes: data.notes,
        stockInDate: data.stockInDate,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-in/history"] });
      toast({ title: "Stock history updated successfully" });
      setEditingStockHistory(null);
      setIsEditStockHistoryOpen(false);
    },
    onError: (error: any) => {
      console.error("Update stock history error:", error);
      toast({ title: "Failed to update stock history", variant: "destructive" });
    },
  });

  /* -------------------------
     Helpers + UI functions
     ------------------------- */
  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive" className="glass-destructive">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary" className="glass-warning">Low Stock</Badge>;
    return <Badge variant="default" className="glass-success">In Stock</Badge>;
  };

  /* -------------------------
     Advanced filtering
     ------------------------- */
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => {
      if (productCompanyFilter !== "all" && p.company !== productCompanyFilter) return false;
      return true;
    });
    
    const query = productSearchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(p => 
        p.productName.toLowerCase().includes(query) ||
        p.company.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [products, productCompanyFilter, productSearchQuery]);

  const filteredVariants = useMemo(() => {
    let filtered = variantsData.filter(v => {
      if (variantCompanyFilter !== "all" && v.product.company !== variantCompanyFilter) return false;
      if (variantProductFilter !== "all" && v.product.productName !== variantProductFilter) return false;
      if (variantSizeFilter !== "all" && v.packingSize !== variantSizeFilter) return false;
      return true;
    });
    
    const query = variantSearchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(v => 
        v.product.productName.toLowerCase().includes(query) ||
        v.product.company.toLowerCase().includes(query) ||
        v.packingSize.toLowerCase().includes(query) ||
        v.rate.toString().includes(query)
      );
    }
    
    return filtered;
  }, [variantsData, variantCompanyFilter, variantProductFilter, variantSizeFilter, variantSearchQuery]);

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

  /* Export Stock In History */
  const exportStockInHistory = () => {
    const headers = ["Stock In Date", "Date", "Time", "Company", "Product", "Size", "Color Code", "Color Name", "Previous Stock", "Quantity Added", "New Stock", "Notes"];
    
    const csvData = filteredStockInHistory.map(history => [
      history.stockInDate,
      formatDateShort(history.createdAt),
      new Date(history.createdAt).toLocaleTimeString(),
      history.color.variant.product.company,
      history.color.variant.product.productName,
      history.color.variant.packingSize,
      history.color.colorCode,
      history.color.colorName,
      history.previousStock.toString(),
      history.quantity.toString(),
      history.newStock.toString(),
      history.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-in-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "History exported successfully" });
  };

  /* PDF Export for Stock In History */
  const exportStockInHistoryPDF = async () => {
    try {
      // Build query parameters from current filters
      const params = new URLSearchParams();
      
      if (historyCompanyFilter !== 'all') {
        params.append('company', historyCompanyFilter);
      }
      
      if (historyProductFilter !== 'all') {
        params.append('product', historyProductFilter);
      }
      
      if (historyStartDate) {
        params.append('startDate', historyStartDate);
      }
      
      if (historyEndDate) {
        params.append('endDate', historyEndDate);
      }

      const url = `/api/stock-in/history/export-pdf?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `stock-history-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ 
        title: "Failed to export PDF", 
        description: "Please try again later",
        variant: "destructive" 
      });
    }
  };

  /* Refresh Stock In History */
  const refreshStockInHistory = () => {
    refetchStockHistory();
    toast({ title: "Stock history refreshed" });
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
      .map(c => ({ 
        colorName: c.colorName.trim(), 
        colorCode: c.colorCode.trim(), 
        stockQuantity: c.stockQuantity.trim(),
        rateOverride: c.rateOverride && c.rateOverride.trim() !== "" ? c.rateOverride.trim() : undefined
      }));

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
        const vResp = await createVariantMutation.mutateAsync({ 
          productId, 
          packingSize: variant.packingSize, 
          rate: parseFloat(variant.rate) 
        });
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
              rateOverride: color.rateOverride ? parseFloat(color.rateOverride) : undefined,
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
      setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "", rateOverride: "" }]);
    } catch (err: any) {
      console.error("Quick Add save error:", err);
      toast({ 
        title: "Save failed", 
        description: err?.message || "Unknown error occurred", 
        variant: "destructive" 
      });
    } finally {
      setIsSavingQuick(false);
    }
  };

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

  // Add CSS for glass effect
  const glassStyles = `
    .glass-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .glass-destructive {
      background: rgba(239, 68, 68, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .glass-warning {
      background: rgba(245, 158, 11, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .glass-success {
      background: rgba(34, 197, 94, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .glass-outline {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .hover-elevate {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-elevate:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .premium-border {
      border: 1px solid;
      border-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%) 1;
    }
  `;

  // Calculate statistics for the header
  const totalStockValue = colorsData.reduce((sum, color) => {
    const rate = parseFloat(getEffectiveRate(color));
    return sum + (color.stockQuantity * rate);
  }, 0);

  const lowStockItems = colorsData.filter(color => color.stockQuantity < 10 && color.stockQuantity > 0).length;
  const outOfStockItems = colorsData.filter(color => color.stockQuantity === 0).length;

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 space-y-6">
      <style>{glassStyles}</style>
      
      {/* Header Section */}
      <div className="glass-card rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="gradient-bg p-2 rounded-xl">
                <Warehouse className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Stock Management
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Manage products, variants, colors, and inventory with premium control
                </p>
              </div>
            </div>
            
            {/* Stats Overview */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-slate-700">
                  <strong>{products.length}</strong> Products
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-slate-700">
                  <strong>{colorsData.length}</strong> Colors
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-slate-700">
                  Stock Value: <strong>Rs. {Math.round(totalStockValue).toLocaleString()}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-slate-700">
                  <strong>{lowStockItems + outOfStockItems}</strong> Need Attention
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setIsQuickAddOpen(true)}
              className="flex items-center gap-2 glass-card border-white/20 hover:border-purple-300 transition-all duration-300"
            >
              <Zap className="h-4 w-4" />
              Quick Add
            </Button>

            <Button 
              className="flex items-center gap-2 gradient-bg text-white hover:shadow-lg transition-all duration-300"
              onClick={() => setIsProductDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-white/20 hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Products</p>
              <p className="text-2xl font-bold text-slate-800">{products.length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-4 border border-white/20 hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Layers className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Variants</p>
              <p className="text-2xl font-bold text-slate-800">{variantsData.length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-4 border border-white/20 hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Colors</p>
              <p className="text-2xl font-bold text-slate-800">{colorsData.length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-4 border border-white/20 hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Stock Value</p>
              <p className="text-2xl font-bold text-slate-800">Rs. {Math.round(totalStockValue).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Products/Variants/Colors/Stock In/Stock In History */}
      <Tabs defaultValue="products" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="glass-card border-white/20 p-1 inline-flex w-auto min-w-full sm:w-full" data-testid="stock-management-tabs">
            <TabsTrigger 
              value="products" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-products"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
              <span className="sm:hidden">Prod</span>
            </TabsTrigger>
            <TabsTrigger 
              value="variants" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-variants"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Variants</span>
              <span className="sm:hidden">Var</span>
            </TabsTrigger>
            <TabsTrigger 
              value="colors" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-colors"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Colors</span>
              <span className="sm:hidden">Col</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-in" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-stock-in"
            >
              <TruckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Stock In</span>
              <span className="sm:hidden">In</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-in-history" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-history"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Stock In</span>
              <span className="sm:hidden">In</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-out-history" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white data-[state=active]:shadow-md whitespace-nowrap text-slate-700"
              data-testid="tab-stock-out"
            >
              <ArrowUpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Stock Out</span>
              <span className="sm:hidden">Out</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="flex-1 overflow-auto p-4">
          {/* ...existing products tab content... */}
        </TabsContent>

        <TabsContent value="variants" className="flex-1 overflow-auto p-4">
          {/* ...existing variants tab content... */}
        </TabsContent>

        <TabsContent value="colors" className="flex-1 overflow-auto p-4">
          {/* ...existing colors tab content... */}
        </TabsContent>

        <TabsContent value="stock-in" className="flex-1 overflow-auto p-4">
          {/* ...existing stock-in tab content... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}