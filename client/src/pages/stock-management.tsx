// stock-management.tsx - Premium Glass Theme Redesign
import { useState, useMemo, useEffect, useDeferredValue, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";

// Constants for performance optimization
const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;
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
  Zap,
  AlertTriangle
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
  type?: string;
  saleId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
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

  // Debounced search queries - prevents filtering on every keystroke (300ms delay)
  const debouncedProductSearch = useDebounce(productSearchQuery, 300);
  const debouncedVariantSearch = useDebounce(variantSearchQuery, 300);
  const debouncedColorSearch = useDebounce(colorSearchQuery, 300);
  const debouncedStockInSearch = useDebounce(stockInSearchQuery, 300);

  // Visible limits for each tab - prevents rendering thousands of rows
  const [productsVisibleLimit, setProductsVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [variantsVisibleLimit, setVariantsVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [colorsVisibleLimit, setColorsVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [stockInVisibleLimit, setStockInVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);

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
  const [historyDateFilter, setHistoryDateFilter] = useState("today");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");

  // Debounced history search queries
  const debouncedHistorySearch = useDebounce(historySearchQuery, 300);

  /* Multi-select state */
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  /* -------------------------
    Queries
    ------------------------- */
  const { data: productsRaw = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchOnWindowFocus: true,
  });

  const { data: variantsRaw = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
    refetchOnWindowFocus: true,
  });

  const { data: colorsRaw = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    refetchOnWindowFocus: true,
  });

  /* Stock In History Query */
  const { data: stockInHistoryRaw = [], isLoading: historyLoading, refetch: refetchStockHistory } = useQuery<StockInHistory[]>({
    queryKey: ["/api/stock-in/history"],
  });

  const products = useDeferredValue(productsRaw);
  const variantsData = useDeferredValue(variantsRaw);
  const colorsData = useDeferredValue(colorsRaw);
  const stockInHistory = useDeferredValue(stockInHistoryRaw);

  /* Filtered Stock In History - uses debounced search for performance */
  const filteredStockInHistory = useMemo(() => {
    let filtered = stockInHistory;

    if (historyCompanyFilter !== "all") {
      filtered = filtered.filter(history => 
        history.color.variant.product.company === historyCompanyFilter
      );
    }

    if (historyProductFilter !== "all") {
      filtered = filtered.filter(history => 
        history.color.variant.product.productName === historyProductFilter
      );
    }

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

    if (debouncedHistorySearch.trim()) {
      const query = debouncedHistorySearch.trim().toLowerCase();
      filtered = filtered.filter(history => 
        history.color.colorCode.toLowerCase().includes(query) ||
        history.color.colorName.toLowerCase().includes(query) ||
        history.color.variant.product.company.toLowerCase().includes(query) ||
        history.color.variant.product.productName.toLowerCase().includes(query) ||
        history.stockInDate.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockInHistory, historyCompanyFilter, historyProductFilter, historyDateFilter, debouncedHistorySearch, historyStartDate, historyEndDate]);

  // Visible stock history with limit for rendering optimization
  const visibleStockInHistory = useMemo(() => {
    return filteredStockInHistory.slice(0, historyVisibleLimit);
  }, [filteredStockInHistory, historyVisibleLimit]);

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
    if (last && (last.colorName.trim() !== "" || last.colorCode.trim() !== "")) {
      setQuickColors(prev => [...prev, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "", rateOverride: "" }]);
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
    if (stock === 0) return <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Low Stock</Badge>;
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">In Stock</Badge>;
  };

  /* -------------------------
    Advanced filtering with debounced search (uses debounced values to prevent filtering on every keystroke)
    ------------------------- */
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => {
      if (productCompanyFilter !== "all" && p.company !== productCompanyFilter) return false;
      return true;
    });
    
    const query = debouncedProductSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(p => 
        p.productName.toLowerCase().includes(query) ||
        p.company.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [products, productCompanyFilter, debouncedProductSearch]);

  // Visible products with limit for rendering optimization
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, productsVisibleLimit);
  }, [filteredProducts, productsVisibleLimit]);

  const filteredVariants = useMemo(() => {
    let filtered = variantsData.filter(v => {
      if (variantCompanyFilter !== "all" && v.product.company !== variantCompanyFilter) return false;
      if (variantProductFilter !== "all" && v.product.productName !== variantProductFilter) return false;
      if (variantSizeFilter !== "all" && v.packingSize !== variantSizeFilter) return false;
      return true;
    });
    
    const query = debouncedVariantSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(v => 
        v.product.productName.toLowerCase().includes(query) ||
        v.product.company.toLowerCase().includes(query) ||
        v.packingSize.toLowerCase().includes(query) ||
        v.rate.toString().includes(query)
      );
    }
    
    return filtered;
  }, [variantsData, variantCompanyFilter, variantProductFilter, variantSizeFilter, debouncedVariantSearch]);

  // Visible variants with limit for rendering optimization
  const visibleVariants = useMemo(() => {
    return filteredVariants.slice(0, variantsVisibleLimit);
  }, [filteredVariants, variantsVisibleLimit]);

  const filteredColors = useMemo(() => {
    let filtered = colorsData;

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

    const query = debouncedColorSearch.trim().toUpperCase();
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
  }, [colorsData, debouncedColorSearch, colorCompanyFilter, colorProductFilter, colorSizeFilter, colorStockStatusFilter]);

  // Visible colors with limit for rendering optimization
  const visibleColors = useMemo(() => {
    return filteredColors.slice(0, colorsVisibleLimit);
  }, [filteredColors, colorsVisibleLimit]);

  const filteredColorsForStockIn = useMemo(() => {
    const query = debouncedStockInSearch.trim().toUpperCase();
    const queryLower = query.toLowerCase();
    if (!query) return colorsData.slice(0, stockInVisibleLimit);

    return colorsData
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.trim().toUpperCase();
        const colorCodeLower = colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

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
      .slice(0, stockInVisibleLimit)
      .map(({ color }) => color);
  }, [colorsData, debouncedStockInSearch, stockInVisibleLimit]);

  /* Calculate statistics */
  const totalStockValue = colorsData.reduce((sum, color) => {
    const rate = parseFloat(getEffectiveRate(color));
    return sum + (color.stockQuantity * rate);
  }, 0);

  const lowStockItems = colorsData.filter(color => color.stockQuantity < 10 && color.stockQuantity > 0).length;
  const outOfStockItems = colorsData.filter(color => color.stockQuantity === 0).length;

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
    const company = useExistingCompany ? selectedCompany : newCompany.trim();
    const productName = useExistingProduct ? selectedProduct : newProduct.trim();

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
      .filter(c => c.colorName.trim() !== "" && c.colorCode.trim() !== "")
      .map(c => ({ 
        colorName: c.colorName.trim(), 
        colorCode: c.colorCode.trim(), 
        stockQuantity: c.stockQuantity.trim() || "0",
        rateOverride: c.rateOverride && c.rateOverride.trim() !== "" ? c.rateOverride.trim() : undefined
      }));

    setIsSavingQuick(true);
    try {
      let productId: string | undefined;
      const existingProduct = products.find(p => p.company === company && p.productName === productName);
      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        const resp = await createProductMutation.mutateAsync({ company, productName });
        productId = resp?.id;
      }

      if (!productId) throw new Error("Product creation failed: no id returned");

      const createdVariantIds: string[] = [];
      for (const variant of finalVariants) {
        const vResp = await createVariantMutation.mutateAsync({ 
          productId, 
          packingSize: variant.packingSize, 
          rate: parseFloat(variant.rate) 
        });
        createdVariantIds.push(vResp.id);
      }

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

  /* -------------------------
    Render
    ------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20 p-4 md:p-6 space-y-5">
      {/* Header Section - Minimal Banking Style */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Stock Management
            </h1>
            <p className="text-xs text-slate-500">
              Products, variants, colors & inventory
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsQuickAddOpen(true)}
            className="border-slate-200 text-slate-600"
          >
            <Zap className="h-4 w-4 mr-1.5 text-amber-500" />
            Quick Add
          </Button>

          <Button 
            size="sm"
            onClick={() => setIsProductDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md border-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards - Clean Banking Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Products</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{products.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center">
              <Palette className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Colors</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{colorsData.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stock Value</p>
              <p className="text-lg font-bold text-emerald-600 font-mono tabular-nums">
                Rs. {Math.round(totalStockValue).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Low Stock</p>
              <p className="text-xl font-bold text-rose-600 tabular-nums">{lowStockItems + outOfStockItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Clean Banking Style */}
      <Tabs defaultValue="products" className="space-y-4">
        <div className="bg-white rounded-xl p-1.5 border border-slate-100 shadow-sm overflow-x-auto">
          <TabsList className="bg-transparent inline-flex w-auto min-w-full gap-1">
            <TabsTrigger 
              value="products" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:bg-transparent rounded-lg px-3 py-2 text-sm font-medium transition-all"
              data-testid="tab-products"
            >
              <Package className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Products</span>
              <span className="sm:hidden">Prod</span>
            </TabsTrigger>
            <TabsTrigger 
              value="variants" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:bg-transparent rounded-lg px-3 py-2 text-sm font-medium transition-all"
              data-testid="tab-variants"
            >
              <Layers className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Variants</span>
              <span className="sm:hidden">Var</span>
            </TabsTrigger>
            <TabsTrigger 
              value="colors" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:bg-transparent rounded-lg px-3 py-2 text-sm font-medium transition-all"
              data-testid="tab-colors"
            >
              <Palette className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Colors</span>
              <span className="sm:hidden">Col</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-transparent">
              <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Products</h2>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-blue-600 tabular-nums">{products.length}</span> in catalog
                    </p>
                  </div>
                </div>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <Button 
                    size="sm"
                    onClick={() => setIsProductDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm border-0"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add Product
                  </Button>
                  <DialogContent className="bg-white border-slate-200 max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-slate-800">
                        <Package className="h-5 w-5 text-blue-600" />
                        Add New Product
                      </DialogTitle>
                      <DialogDescription className="text-slate-500">Add company and product name to expand your catalog</DialogDescription>
                    </DialogHeader>
                    <Form {...productForm}>
                      <form onSubmit={productForm.handleSubmit((data) => createProductSingleMutation.mutate(data))} className="space-y-4">
                        <FormField control={productForm.control} name="company" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Company Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Premium Paint Co" 
                                {...field} 
                                className="bg-slate-50 border-slate-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={productForm.control} name="productName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Product Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Exterior Emulsion" 
                                {...field} 
                                className="bg-slate-50 border-slate-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsProductDialogOpen(false)}
                            className="border-slate-200"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createProductSingleMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {createProductSingleMutation.isPending ? "Creating..." : "Create Product"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="p-4">
              {productsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 border border-slate-100 rounded-lg">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No products found</h3>
                  <p className="text-slate-500 mb-4">Add your first product to get started with inventory management</p>
                  <Button 
                    onClick={() => setIsProductDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Product
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search by product name or company..." 
                        value={productSearchQuery} 
                        onChange={e => setProductSearchQuery(e.target.value)} 
                        className="pl-9 border-slate-200 bg-white rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={productCompanyFilter} onValueChange={setProductCompanyFilter}>
                        <SelectTrigger className="border-slate-200 bg-white rounded-lg min-w-[180px]">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {(productCompanyFilter !== "all" || productSearchQuery) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setProductCompanyFilter("all");
                            setProductSearchQuery("");
                          }}
                          className="border-slate-200 text-slate-600"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  {selectedProducts.size > 0 && canDeleteStock && (
                    <div className="flex gap-2 items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-sm font-medium text-amber-800">{selectedProducts.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedProducts.size} selected product(s)? This will also delete all associated variants and colors.`)) {
                            bulkDeleteProductsMutation.mutate(Array.from(selectedProducts));
                          }
                        }}
                        className="bg-red-100 text-red-700 border-red-200"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {/* Products Table */}
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                        <Search className="h-12 w-12 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No products found</h3>
                      <p className="text-slate-500 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setProductCompanyFilter("all");
                          setProductSearchQuery("");
                        }}
                        className="border-slate-200 text-slate-600"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                  <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={selectedProducts.size === visibleProducts.length && visibleProducts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProducts(new Set(visibleProducts.map(p => p.id)));
                                } else {
                                  setSelectedProducts(new Set());
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                          </TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-center">Variants</TableHead>
                          <TableHead className="text-right">Price Range</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleProducts.map(product => {
                          const productVariants = variantsData.filter(v => v.productId === product.id);
                          
                          const rates = productVariants.map(v => parseFloat(v.rate)).filter(r => !isNaN(r));
                          const minRate = rates.length > 0 ? Math.min(...rates) : 0;
                          const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
                          const priceRange = rates.length > 0 
                            ? (minRate === maxRate 
                              ? `Rs. ${minRate.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` 
                              : `Rs. ${minRate.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} - ${maxRate.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
                            : "No variants";
                          
                          return (
                            <TableRow 
                              key={product.id} 
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => setViewingProduct(product)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
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
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{product.company}</TableCell>
                              <TableCell>{product.productName}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                  {productVariants.length}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-blue-600">
                                {priceRange}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {formatDateShort(product.createdAt)}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingProduct(product)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canEditStock && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingProduct(product)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Load More Button for Products */}
                  {filteredProducts.length > productsVisibleLimit && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setProductsVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                        className="border-slate-200"
                      >
                        Load More ({filteredProducts.length - productsVisibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                  </>
                )}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-4">
          <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-transparent">
              <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-sm">
                    <Layers className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Variants</h2>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600 tabular-nums">{variantsData.length}</span> product variants
                    </p>
                  </div>
                </div>
                <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                  <Button 
                    size="sm"
                    onClick={() => setIsVariantDialogOpen(true)}
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm border-0"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add Variant
                  </Button>
                  <DialogContent className="bg-white border-slate-200 max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Add New Variant
                      </DialogTitle>
                      <DialogDescription>Select product, packing size, and set the rate</DialogDescription>
                    </DialogHeader>
                    <Form {...variantForm}>
                      <form onSubmit={variantForm.handleSubmit((data) => createVariantSingleMutation.mutate(data))} className="space-y-4">
                        <FormField control={variantForm.control} name="productId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-slate-200">
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white border border-slate-200">
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.company} - {p.productName}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={variantForm.control} name="packingSize" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Packing Size</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., 1L, 4L, 16L" 
                                {...field} 
                                className="border-slate-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={variantForm.control} name="rate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate (Rs.)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="e.g., 250.00" 
                                {...field} 
                                className="border-slate-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsVariantDialogOpen(false)}
                            className="border-slate-200 text-slate-600"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createVariantSingleMutation.isPending}
                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md"
                          >
                            {createVariantSingleMutation.isPending ? "Creating..." : "Create Variant"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <CardContent className="p-5">
              {variantsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : variantsData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                    <Layers className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No variants found</h3>
                  <p className="text-slate-500 mb-4">Add variants to organize your products by size and pricing</p>
                  <Button 
                    onClick={() => setIsVariantDialogOpen(true)}
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Variant
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search by product, company, size, or rate..." 
                        value={variantSearchQuery} 
                        onChange={e => setVariantSearchQuery(e.target.value)} 
                        className="pl-9 border-slate-200 bg-white rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-slate-600">Company</Label>
                        <Select value={variantCompanyFilter} onValueChange={setVariantCompanyFilter}>
                          <SelectTrigger className="border-slate-200 bg-white rounded-lg">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="all">All Companies</SelectItem>
                            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-slate-600">Product</Label>
                        <Select value={variantProductFilter} onValueChange={setVariantProductFilter}>
                          <SelectTrigger className="border-slate-200 bg-white rounded-lg">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="all">All Products</SelectItem>
                            {Array.from(new Set(variantsData.map(v => v.product.productName))).sort().map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-slate-600">Size</Label>
                        <Select value={variantSizeFilter} onValueChange={setVariantSizeFilter}>
                          <SelectTrigger className="border-slate-200 bg-white rounded-lg">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="all">All Sizes</SelectItem>
                            {Array.from(new Set(variantsData.map(v => v.packingSize))).sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {(variantCompanyFilter !== "all" || variantProductFilter !== "all" || variantSizeFilter !== "all" || variantSearchQuery) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setVariantCompanyFilter("all");
                            setVariantProductFilter("all");
                            setVariantSizeFilter("all");
                            setVariantSearchQuery("");
                          }}
                          className="border-slate-200 text-slate-600"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  {selectedVariants.size > 0 && canDeleteStock && (
                    <div className="flex gap-2 items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-sm font-medium text-amber-800">{selectedVariants.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedVariants.size} selected variant(s)? This will also delete all associated colors.`)) {
                            bulkDeleteVariantsMutation.mutate(Array.from(selectedVariants));
                          }
                        }}
                        className="bg-red-100 text-red-700 border-red-200"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {/* Variants Table */}
                  {filteredVariants.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                        <Search className="h-12 w-12 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No variants found</h3>
                      <p className="text-slate-500 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setVariantCompanyFilter("all");
                          setVariantProductFilter("all");
                          setVariantSizeFilter("all");
                          setVariantSearchQuery("");
                        }}
                        className="border-slate-200 text-slate-600"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                  <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={selectedVariants.size === visibleVariants.length && visibleVariants.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVariants(new Set(visibleVariants.map(v => v.id)));
                                } else {
                                  setSelectedVariants(new Set());
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            />
                          </TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-center">Colors</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleVariants.map(variant => {
                          const variantColors = colorsData.filter(c => c.variantId === variant.id);
                          return (
                            <TableRow 
                              key={variant.id} 
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => setViewingVariant(variant)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
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
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{variant.product.company}</TableCell>
                              <TableCell>{variant.product.productName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {variant.packingSize}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-indigo-600">
                                Rs. {Math.round(parseFloat(variant.rate))}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                  {variantColors.length}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingVariant(variant)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canEditStock && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingVariant(variant)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Load More Button for Variants */}
                  {filteredVariants.length > variantsVisibleLimit && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setVariantsVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                        className="border-slate-200"
                      >
                        Load More ({filteredVariants.length - variantsVisibleLimit} remaining)
                      </Button>
                    </div>
                  )}
                  </>
                )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 to-transparent">
              <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm">
                    <Palette className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Colors & Inventory</h2>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-purple-600 tabular-nums">{colorsData.length}</span> color variants in stock
                    </p>
                  </div>
                </div>
                <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
                  <Button 
                    size="sm"
                    onClick={() => setIsColorDialogOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm border-0"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add Color
                  </Button>
                  <DialogContent className="bg-white border-slate-200 max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Add New Color
                      </DialogTitle>
                      <DialogDescription>Select variant and add color details with initial quantity</DialogDescription>
                    </DialogHeader>
                    <Form {...colorForm}>
                      <form onSubmit={colorForm.handleSubmit((data) => createColorSingleMutation.mutate(data))} className="space-y-4">
                        <FormField control={colorForm.control} name="variantId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Variant (Product + Size)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-slate-200 bg-white rounded-lg">
                                  <SelectValue placeholder="Select variant" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white border-slate-200">
                                {variantsData.map(v => <SelectItem key={v.id} value={v.id}>{v.product.company} - {v.product.productName} ({v.packingSize})</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={colorForm.control} name="colorName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Sky Blue" 
                                {...field} 
                                className="border-slate-200 bg-white rounded-lg"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color Code</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., RAL 5002" 
                                {...field} 
                                className="border-slate-200 bg-white rounded-lg"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Quantity</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                placeholder="e.g., 50" 
                                {...field} 
                                className="border-slate-200 bg-white rounded-lg"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsColorDialogOpen(false)}
                            className="border-slate-200 text-slate-600"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createColorSingleMutation.isPending}
                            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md"
                          >
                            {createColorSingleMutation.isPending ? "Adding..." : "Add Color"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <CardContent className="p-5">
              {colorsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-slate-100 rounded-2xl inline-block mb-4">
                    <Palette className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No colors found</h3>
                  <p className="text-slate-500 mb-4">Add colors to track inventory and manage stock levels</p>
                  <Button 
                    onClick={() => setIsColorDialogOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Color
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2">
                      <Label className="text-xs text-slate-600 mb-2 block">Search Colors</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="Search by color code, name, product, company..." 
                          value={colorSearchQuery} 
                          onChange={e => setColorSearchQuery(e.target.value)} 
                          className="pl-9 border-slate-200"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-slate-600 mb-2 block">Stock Status</Label>
                      <Select value={colorStockStatusFilter} onValueChange={setColorStockStatusFilter}>
                        <SelectTrigger className="border-slate-200">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-slate-200">
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="out">Out of Stock</SelectItem>
                          <SelectItem value="low">Low Stock</SelectItem>
                          <SelectItem value="in">In Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-slate-600 mb-2 block">Company</Label>
                      <Select value={colorCompanyFilter} onValueChange={setColorCompanyFilter}>
                        <SelectTrigger className="border-slate-200">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-slate-200">
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(colorSearchQuery || colorStockStatusFilter !== "all" || colorCompanyFilter !== "all") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setColorSearchQuery("");
                          setColorStockStatusFilter("all");
                          setColorCompanyFilter("all");
                        }}
                        className="border-slate-200 self-end"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  {/* Bulk Actions */}
                  {selectedColors.size > 0 && canDeleteStock && (
                    <div className="flex gap-2 items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-sm font-medium text-amber-800">{selectedColors.size} selected</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedColors.size} selected color(s)?`)) {
                            bulkDeleteColorsMutation.mutate(Array.from(selectedColors));
                          }
                        }}
                        className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {filteredColors.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No colors found</h3>
                      <p className="text-slate-500 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setColorSearchQuery("");
                          setColorStockStatusFilter("all");
                          setColorCompanyFilter("all");
                        }}
                        className="border-slate-200"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                    <>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedColors.size === visibleColors.length && visibleColors.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedColors(new Set(visibleColors.map(c => c.id)));
                                  } else {
                                    setSelectedColors(new Set());
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-purple-600"
                              />
                            </TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleColors.map(color => (
                            <TableRow 
                              key={color.id} 
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => setViewingColor(color)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
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
                                  className="h-4 w-4 rounded border-slate-300 text-purple-600"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-6 h-6 rounded border border-slate-200 flex-shrink-0"
                                    style={{ backgroundColor: color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : color.colorCode }}
                                  />
                                  <span className="font-medium">{color.colorName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600">{color.colorCode}</TableCell>
                              <TableCell>{color.variant.product.company}</TableCell>
                              <TableCell>{color.variant.product.productName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                                  {color.variant.packingSize}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {color.stockQuantity}
                              </TableCell>
                              <TableCell className="text-center">
                                {getStockBadge(color.stockQuantity)}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingColor(color)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canEditStock && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingColor(color)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Load More Button for Colors */}
                    {filteredColors.length > colorsVisibleLimit && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setColorsVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                          className="border-slate-200"
                        >
                          Load More ({filteredColors.length - colorsVisibleLimit} remaining)
                        </Button>
                      </div>
                    )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Note: Stock In and Stock History are now available as separate pages via sidebar navigation */}
      
      {/* Quick Add Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={(open) => {
        setIsQuickAddOpen(open);
        if (!open) {
          setQuickStep(1);
          setSelectedCompany("");
          setSelectedProduct("");
          setNewCompany("");
          setNewProduct("");
          setUseExistingCompany(true);
          setUseExistingProduct(true);
          setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
          setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "", rateOverride: "" }]);
        }
      }}>
        <DialogContent className="bg-white border border-slate-200 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Add Product
            </DialogTitle>
            <DialogDescription>Add complete product with variants and colors in one flow</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded ${quickStep === 1 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>1. Product</div>
              <div className={`px-3 py-1 rounded ${quickStep === 2 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>2. Variants</div>
              <div className={`px-3 py-1 rounded ${quickStep === 3 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>3. Colors</div>
            </div>

            {/* Step 1: Product */}
            {quickStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-slate-900">Company</Label>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="existing-company" checked={useExistingCompany} onChange={() => setUseExistingCompany(true)} className="h-4 w-4" />
                      <Label htmlFor="existing-company" className="text-sm">Select Existing</Label>
                      <input type="radio" id="new-company" checked={!useExistingCompany} onChange={() => setUseExistingCompany(false)} className="h-4 w-4" />
                      <Label htmlFor="new-company" className="text-sm">Add New</Label>
                    </div>
                  </div>

                  {useExistingCompany ? (
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200">
                        {companies.map(company => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={newCompany} 
                      onChange={e => setNewCompany(e.target.value)} 
                      placeholder="Enter new company name" 
                      className="border-slate-200"
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-slate-900">Product</Label>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="existing-product" checked={useExistingProduct} onChange={() => setUseExistingProduct(true)} className="h-4 w-4" disabled={!selectedCompany && useExistingCompany} />
                      <Label htmlFor="existing-product" className="text-sm">Select Existing</Label>
                      <input type="radio" id="new-product" checked={!useExistingProduct} onChange={() => setUseExistingProduct(false)} className="h-4 w-4" />
                      <Label htmlFor="new-product" className="text-sm">Add New</Label>
                    </div>
                  </div>

                  {useExistingProduct ? (
                    <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedCompany}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder={selectedCompany ? "Select product" : "Select company first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200">
                        {productsByCompany.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={newProduct} 
                      onChange={e => setNewProduct(e.target.value)} 
                      placeholder="Enter new product name" 
                      className="border-slate-200"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsQuickAddOpen(false)}
                    className="border-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => setQuickStep(2)} 
                    disabled={
                      !(useExistingCompany ? selectedCompany : newCompany.trim()) ||
                      !(useExistingProduct ? selectedProduct : newProduct.trim())
                    }
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    Continue to Variants →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Variants */}
            {quickStep === 2 && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("variants")}>
                    <h3 className="font-semibold text-lg text-slate-900">Variants</h3>
                    <Button variant="ghost" size="sm" className="border-slate-200">
                      {expandedSections.variants ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {expandedSections.variants && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-3">
                        {quickVariants.map((variant, index) => (
                          <div key={variant.id} className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-5">
                              <Input 
                                placeholder="Packing size (e.g., 1L, 4L, 16L)" 
                                value={variant.packingSize} 
                                onChange={e => updateVariant(index, "packingSize", e.target.value)} 
                                className="border-slate-200"
                              />
                            </div>
                            <div className="col-span-5">
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="Rate (Rs.)" 
                                value={variant.rate} 
                                onChange={e => updateVariant(index, "rate", e.target.value)} 
                                className="border-slate-200"
                              />
                            </div>
                            <div className="col-span-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeVariantAt(index)} 
                                disabled={quickVariants.length === 1}
                                className="border-slate-200"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuickVariants(p => [...p, { id: String(Date.now()), packingSize: "", rate: "" }])}
                        className="border-slate-200"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Variant
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setQuickStep(1)}
                    className="border-slate-200"
                  >
                    ← Back
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => setQuickStep(3)} 
                      disabled={quickVariants.filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "").length === 0}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    >
                      Continue to Colors →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Colors */}
            {quickStep === 3 && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("colors")}>
                    <h3 className="font-semibold text-lg text-slate-900">Colors</h3>
                    <Button variant="ghost" size="sm" className="border-slate-200">
                      {expandedSections.colors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {expandedSections.colors && (
                    <div className="mt-4 space-y-4">
                      <div className="text-sm text-slate-500 mb-2 p-2 bg-blue-50 rounded-lg">
                        💡 Tip: Leave "Custom Rate" empty to use the variant's default rate. Only set it if this color has a different price.
                      </div>
                      <div className="space-y-3">
                        {quickColors.map((color, index) => (
                          <div key={color.id} className="space-y-2 p-3 bg-white rounded-lg border border-slate-200">
                            <div className="grid grid-cols-12 gap-3 items-center">
                              <div className="col-span-4">
                                <Input 
                                  placeholder="Color name" 
                                  value={color.colorName} 
                                  onChange={e => updateColor(index, "colorName", e.target.value)} 
                                  className="border-slate-200"
                                />
                              </div>
                              <div className="col-span-4">
                                <Input 
                                  placeholder="Color code" 
                                  value={color.colorCode} 
                                  onChange={e => updateColor(index, "colorCode", e.target.value)} 
                                  className="border-slate-200"
                                />
                              </div>
                              <div className="col-span-3">
                                <Input 
                                  type="number" 
                                  min="0" 
                                  step="0.01" 
                                  placeholder="Custom rate (optional)" 
                                  value={color.rateOverride || ""} 
                                  onChange={e => updateColor(index, "rateOverride", e.target.value)} 
                                  className="border-slate-200 border-dashed"
                                />
                              </div>
                              <div className="col-span-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => removeColorAt(index)} 
                                  disabled={quickColors.length === 1}
                                  className="border-slate-200"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuickColors(p => [...p, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "", rateOverride: "" }])}
                        className="border-slate-200"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Color
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setQuickStep(2)}
                    className="border-slate-200"
                  >
                    ← Back
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={saveQuickAdd} 
                      disabled={isSavingQuick}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    >
                      {isSavingQuick ? "Saving..." : "Save Product"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialogs */}
      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Product
            </DialogTitle>
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
                  <FormControl>
                    <Input {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={productForm.control} name="productName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingProduct(null)}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateProductMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                >
                  {updateProductMutation.isPending ? "Updating..." : "Update Product"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Dialog */}
      <Dialog open={!!editingVariant} onOpenChange={(open) => !open && setEditingVariant(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Variant
            </DialogTitle>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit((data) => {
              if (editingVariant) {
                updateVariantMutation.mutate({ 
                  id: editingVariant.id, 
                  productId: data.productId,
                  packingSize: data.packingSize,
                  rate: parseFloat(data.rate)
                });
              }
            })} className="space-y-4">
              <FormField control={variantForm.control} name="productId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border border-slate-200">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.company} - {p.productName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={variantForm.control} name="packingSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Packing Size</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={variantForm.control} name="rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (Rs.)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingVariant(null)}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateVariantMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                >
                  {updateVariantMutation.isPending ? "Updating..." : "Update Variant"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Color Dialog */}
      <Dialog open={!!editingColor} onOpenChange={(open) => !open && setEditingColor(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Color
            </DialogTitle>
          </DialogHeader>
          <Form {...colorForm}>
            <form onSubmit={colorForm.handleSubmit(async (data) => {
              if (editingColor) {
                try {
                  await updateColorMutation.mutateAsync({ 
                    id: editingColor.id, 
                    variantId: data.variantId,
                    colorName: data.colorName, 
                    colorCode: data.colorCode,
                    stockQuantity: parseInt(data.stockQuantity, 10) 
                  });
                  
                  const rateOverrideValue = data.rateOverride && data.rateOverride.trim() !== "" 
                    ? parseFloat(data.rateOverride) 
                    : null;
                  
                  if (rateOverrideValue !== (editingColor.rateOverride ? parseFloat(editingColor.rateOverride) : null)) {
                    await apiRequest("PATCH", `/api/colors/${editingColor.id}/rate-override`, {
                      rateOverride: rateOverrideValue
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
                  }
                  
                  toast({ title: "Color updated successfully" });
                  setEditingColor(null);
                } catch (error) {
                  console.error("Error updating color:", error);
                  toast({ title: "Failed to update color", variant: "destructive" });
                }
              }
            })} className="space-y-4">
              <FormField control={colorForm.control} name="variantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant (Product + Size)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select variant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border border-slate-200">
                      {variantsData.map(v => <SelectItem key={v.id} value={v.id}>{v.product.company} - {v.product.productName} ({v.packingSize})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="colorName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Code</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} className="border-slate-200" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="rateOverride" render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Rate (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="Leave empty to use variant rate" {...field} className="border-slate-200" />
                  </FormControl>
                  <p className="text-xs text-slate-500">Default: Rs. {editingColor ? Math.round(parseFloat(editingColor.variant.rate)) : '0'}</p>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingColor(null)}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateColorMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                >
                  {updateColorMutation.isPending ? "Updating..." : "Update Color"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Stock History Dialog */}
      <Dialog open={isEditStockHistoryOpen} onOpenChange={setIsEditStockHistoryOpen}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Stock History
            </DialogTitle>
            <DialogDescription>Update quantity, date and notes for this stock entry</DialogDescription>
          </DialogHeader>
          {editingStockHistory && (
            <Form {...stockHistoryEditForm}>
              <form onSubmit={stockHistoryEditForm.handleSubmit((data) => {
                if (editingStockHistory) {
                  updateStockHistoryMutation.mutate({
                    id: editingStockHistory.id,
                    quantity: parseInt(data.quantity, 10),
                    notes: data.notes,
                    stockInDate: data.stockInDate
                  });
                }
              })} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-600">Color Details</Label>
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border-2 border-white shadow-sm"
                          style={{ backgroundColor: editingStockHistory.color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : editingStockHistory.color.colorCode }}
                        />
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-mono">
                          {editingStockHistory.color.colorCode}
                        </Badge>
                        <span className="font-medium">{editingStockHistory.color.colorName}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {editingStockHistory.color.variant.product.company} - {editingStockHistory.color.variant.product.productName} ({editingStockHistory.color.variant.packingSize})
                      </p>
                    </div>
                  </div>
                </div>

                <FormField control={stockHistoryEditForm.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" step="1" {...field} className="border-slate-200" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={stockHistoryEditForm.control} name="stockInDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock In Date (DD-MM-YYYY)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="DD-MM-YYYY" 
                        {...field} 
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,2}-?\d{0,2}-?\d{0,4}$/.test(value)) {
                            field.onChange(value);
                          }
                        }}
                        className="border-slate-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={stockHistoryEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any notes..." {...field} className="border-slate-200" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditStockHistoryOpen(false)}
                    className="border-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateStockHistoryMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    {updateStockHistoryMutation.isPending ? "Updating..." : "Update Record"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Detail Dialogs */}
      {/* View Product Details */}
      <Dialog open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Product Details
            </DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Company</Label>
                  <p className="text-sm text-slate-800">{viewingProduct.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Product Name</Label>
                  <p className="text-sm text-slate-800">{viewingProduct.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Created Date</Label>
                  <p className="text-sm text-slate-500">{formatDateShort(viewingProduct.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Variants Count</Label>
                  <p className="text-sm text-slate-800">{variantsData.filter(v => v.productId === viewingProduct.id).length}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingProduct(null)}
                  className="border-slate-200"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Variant Details */}
      <Dialog open={!!viewingVariant} onOpenChange={(open) => !open && setViewingVariant(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Variant Details
            </DialogTitle>
          </DialogHeader>
          {viewingVariant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Company</Label>
                  <p className="text-sm text-slate-800">{viewingVariant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Product Name</Label>
                  <p className="text-sm text-slate-800">{viewingVariant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Packing Size</Label>
                  <p className="text-sm text-slate-800">{viewingVariant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Rate</Label>
                  <p className="text-sm text-slate-800">Rs. {Math.round(parseFloat(viewingVariant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Colors Count</Label>
                  <p className="text-sm text-slate-800">{colorsData.filter(c => c.variantId === viewingVariant.id).length}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Created Date</Label>
                  <p className="text-sm text-slate-500">{formatDateShort(viewingVariant.createdAt)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingVariant(null)}
                  className="border-slate-200"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Color Details */}
      <Dialog open={!!viewingColor} onOpenChange={(open) => !open && setViewingColor(null)}>
        <DialogContent className="bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Color Details
            </DialogTitle>
          </DialogHeader>
          {viewingColor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Company</Label>
                  <p className="text-sm text-slate-800">{viewingColor.variant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Product Name</Label>
                  <p className="text-sm text-slate-800">{viewingColor.variant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Packing Size</Label>
                  <p className="text-sm text-slate-800">{viewingColor.variant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Default Rate</Label>
                  <p className="text-sm text-slate-800">Rs. {Math.round(parseFloat(viewingColor.variant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Custom Rate</Label>
                  <p className="text-sm text-slate-800">
                    {viewingColor.rateOverride ? `Rs. ${Math.round(parseFloat(viewingColor.rateOverride))}` : <span className="text-slate-400">-</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Effective Rate</Label>
                  <p className="text-sm font-bold text-blue-600">Rs. {Math.round(parseFloat(getEffectiveRate(viewingColor)))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Color Name</Label>
                  <p className="text-sm text-slate-800">{viewingColor.colorName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Color Code</Label>
                  <p className="text-sm font-mono text-slate-800">{viewingColor.colorCode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Stock Quantity</Label>
                  <p className="text-sm text-slate-800">{viewingColor.stockQuantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Stock Status</Label>
                  <div className="text-sm">{getStockBadge(viewingColor.stockQuantity)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Created Date</Label>
                  <p className="text-sm text-slate-500">{formatDateShort(viewingColor.createdAt)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingColor(null)}
                  className="border-slate-200"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}