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
  type?: string;
  saleId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
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
    refetchOnWindowFocus: true,
  });

  const { data: variantsData = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
    refetchOnWindowFocus: true,
  });

  const { data: colorsData = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    refetchOnWindowFocus: true,
  });

  /* Stock In History Query */
  const { data: stockInHistory = [], isLoading: historyLoading, refetch: refetchStockHistory } = useQuery<StockInHistory[]>({
    queryKey: ["/api/stock-in/history"],
  });

  /* Filtered Stock In History */
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
    if (stock === 0) return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Low Stock</Badge>;
    return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>;
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
    <div className="glass-page p-6 space-y-6">
      {/* Header Section */}
      <div className="glass-surface p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <Warehouse className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Stock Management
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage products, variants, colors, and inventory with premium control
                </p>
              </div>
            </div>
            
            {/* Stats Overview */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-gray-700">
                  <strong>{products.length}</strong> Products
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">
                  <strong>{colorsData.length}</strong> Colors
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-gray-700">
                  Stock Value: <strong>Rs. {Math.round(totalStockValue).toLocaleString()}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-gray-700">
                  <strong>{lowStockItems + outOfStockItems}</strong> Need Attention
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setIsQuickAddOpen(true)}
              className="flex items-center gap-2 border-gray-300 hover:border-purple-300 transition-all duration-300"
            >
              <Zap className="h-4 w-4" />
              Quick Add
            </Button>

            <Button 
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transition-all duration-300"
              onClick={() => setIsProductDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: Products/Variants/Colors/Stock In/Stock In History */}
      <Tabs defaultValue="products" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="glass-tabs-list inline-flex w-auto min-w-full sm:w-full">
            <TabsTrigger 
              value="products" 
              className="glass-tab"
              data-testid="tab-products"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
              <span className="sm:hidden">Prod</span>
            </TabsTrigger>
            <TabsTrigger 
              value="variants" 
              className="glass-tab"
              data-testid="tab-variants"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Variants</span>
              <span className="sm:hidden">Var</span>
            </TabsTrigger>
            <TabsTrigger 
              value="colors" 
              className="glass-tab"
              data-testid="tab-colors"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Colors</span>
              <span className="sm:hidden">Col</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-in" 
              className="glass-tab"
              data-testid="tab-stock-in"
            >
              <TruckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Stock In</span>
              <span className="sm:hidden">In</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-in-history" 
              className="glass-tab"
              data-testid="tab-stock-in-history"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Stock In History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock-out-history" 
              className="glass-tab"
              data-testid="tab-stock-out-history"
            >
              <ArrowUpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Stock Out</span>
              <span className="sm:hidden">Out</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Products ({products.length})</CardTitle>
                  <p className="text-sm text-gray-600">Manage your product catalog and companies</p>
                </div>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <Button 
                    onClick={() => setIsProductDialogOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transition-all"
                  >
                    <Plus className="h-4 w-4" /> Add Product
                  </Button>
                  <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Add New Product
                      </DialogTitle>
                      <DialogDescription>Add company and product name to expand your catalog</DialogDescription>
                    </DialogHeader>
                    <Form {...productForm}>
                      <form onSubmit={productForm.handleSubmit((data) => createProductSingleMutation.mutate(data))} className="space-y-4">
                        <FormField control={productForm.control} name="company" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Premium Paint Co" 
                                {...field} 
                                className="border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={productForm.control} name="productName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Exterior Emulsion" 
                                {...field} 
                                className="border-gray-300"
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
                            className="border-gray-300"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createProductSingleMutation.isPending}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                          >
                            {createProductSingleMutation.isPending ? "Creating..." : "Create Product"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-600 mb-4">Add your first product to get started with inventory management</p>
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
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Search by product name or company..." 
                        value={productSearchQuery} 
                        onChange={e => setProductSearchQuery(e.target.value)} 
                        className="pl-9 border-gray-300"
                      />
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={productCompanyFilter} onValueChange={setProductCompanyFilter}>
                        <SelectTrigger className="border-gray-300 min-w-[180px]">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
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
                          className="border-gray-300"
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
                        className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {/* Products Grid */}
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setProductCompanyFilter("all");
                          setProductSearchQuery("");
                        }}
                        className="border-gray-300"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(product => {
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
                        <Card 
                          key={product.id} 
                          className="rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => setViewingProduct(product)}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-xl">
                                  <Package className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {product.productName}
                                  </h3>
                                  <p className="text-sm text-gray-600">{product.company}</p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedProducts.has(product.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(selectedProducts);
                                  if (e.target.checked) {
                                    newSet.add(product.id);
                                  } else {
                                    newSet.delete(product.id);
                                  }
                                  setSelectedProducts(newSet);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Variants</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                                  {productVariants.length} variants
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Price Range</span>
                                <span className="font-mono font-semibold text-blue-600">{priceRange}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Created</span>
                                <span className="text-gray-500">{formatDateShort(product.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-gray-300 text-gray-700 hover:border-blue-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingProduct(product);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              {canEditStock && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-gray-300 text-gray-700 hover:border-green-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProduct(product);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Variants ({variantsData.length})</CardTitle>
                  <p className="text-sm text-gray-600">Manage product variants and pricing</p>
                </div>
                <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                  <Button 
                    onClick={() => setIsVariantDialogOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transition-all"
                  >
                    <Plus className="h-4 w-4" /> Add Variant
                  </Button>
                  <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                                <SelectTrigger className="border-gray-300">
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white border border-gray-200">
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
                                className="border-gray-300"
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
                                className="border-gray-300"
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
                            className="border-gray-300"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createVariantSingleMutation.isPending}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                          >
                            {createVariantSingleMutation.isPending ? "Creating..." : "Create Variant"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {variantsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : variantsData.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No variants found</h3>
                  <p className="text-gray-600 mb-4">Add variants to organize your products by size and pricing</p>
                  <Button 
                    onClick={() => setIsVariantDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
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
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Search by product, company, size, or rate..." 
                        value={variantSearchQuery} 
                        onChange={e => setVariantSearchQuery(e.target.value)} 
                        className="pl-9 border-gray-300"
                      />
                    </div>
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-gray-700">Company</Label>
                        <Select value={variantCompanyFilter} onValueChange={setVariantCompanyFilter}>
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200">
                            <SelectItem value="all">All Companies</SelectItem>
                            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-gray-700">Product</Label>
                        <Select value={variantProductFilter} onValueChange={setVariantProductFilter}>
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200">
                            <SelectItem value="all">All Products</SelectItem>
                            {Array.from(new Set(variantsData.map(v => v.product.productName))).sort().map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs text-gray-700">Size</Label>
                        <Select value={variantSizeFilter} onValueChange={setVariantSizeFilter}>
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200">
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
                          className="border-gray-300"
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
                        className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Delete Selected
                      </Button>
                    </div>
                  )}

                  {/* Variants Grid */}
                  {filteredVariants.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No variants found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setVariantCompanyFilter("all");
                          setVariantProductFilter("all");
                          setVariantSizeFilter("all");
                          setVariantSearchQuery("");
                        }}
                        className="border-gray-300"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVariants.map(variant => {
                      const variantColors = colorsData.filter(c => c.variantId === variant.id);
                      return (
                        <Card 
                          key={variant.id} 
                          className="rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => setViewingVariant(variant)}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-xl">
                                  <Layers className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                                    {variant.packingSize}
                                  </h3>
                                  <p className="text-sm text-gray-600">{variant.product.company} - {variant.product.productName}</p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedVariants.has(variant.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(selectedVariants);
                                  if (e.target.checked) {
                                    newSet.add(variant.id);
                                  } else {
                                    newSet.delete(variant.id);
                                  }
                                  setSelectedVariants(newSet);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Rate</span>
                                <span className="font-mono font-semibold text-green-600">Rs. {Math.round(parseFloat(variant.rate))}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Colors</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                                  {variantColors.length} colors
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Product</span>
                                <span className="text-gray-500 truncate">{variant.product.productName}</span>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-gray-300 text-gray-700 hover:border-green-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingVariant(variant);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              {canEditStock && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-gray-300 text-gray-700 hover:border-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingVariant(variant);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Colors & Inventory ({colorsData.length})</CardTitle>
                  <p className="text-sm text-gray-600">Manage color variants and stock levels</p>
                </div>
                <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
                  <Button 
                    onClick={() => setIsColorDialogOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transition-all"
                  >
                    <Plus className="h-4 w-4" /> Add Color
                  </Button>
                  <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                                <SelectTrigger className="border-gray-300">
                                  <SelectValue placeholder="Select variant" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white border border-gray-200">
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
                                className="border-gray-300"
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
                                className="border-gray-300"
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
                                className="border-gray-300"
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
                            className="border-gray-300"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createColorSingleMutation.isPending}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                          >
                            {createColorSingleMutation.isPending ? "Adding..." : "Add Color"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {colorsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-12">
                  <Palette className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No colors found</h3>
                  <p className="text-gray-600 mb-4">Add colors to track inventory and manage stock levels</p>
                  <Button 
                    onClick={() => setIsColorDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
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
                      <Label className="text-xs text-gray-700 mb-2 block">Search Colors</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder="Search by color code, name, product, company..." 
                          value={colorSearchQuery} 
                          onChange={e => setColorSearchQuery(e.target.value)} 
                          className="pl-9 border-gray-300"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-700 mb-2 block">Stock Status</Label>
                      <Select value={colorStockStatusFilter} onValueChange={setColorStockStatusFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="out">Out of Stock</SelectItem>
                          <SelectItem value="low">Low Stock</SelectItem>
                          <SelectItem value="in">In Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-700 mb-2 block">Company</Label>
                      <Select value={colorCompanyFilter} onValueChange={setColorCompanyFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
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
                        className="border-gray-300 self-end"
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
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No colors found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setColorSearchQuery("");
                          setColorStockStatusFilter("all");
                          setColorCompanyFilter("all");
                        }}
                        className="border-gray-300"
                      >
                        Reset Search
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredColors.map(color => (
                        <Card 
                          key={color.id} 
                          className="rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => setViewingColor(color)}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                                  style={{ backgroundColor: color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : color.colorCode }}
                                />
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                                    {color.colorName}
                                  </h3>
                                  <p className="text-sm font-mono text-gray-600">{color.colorCode}</p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedColors.has(color.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(selectedColors);
                                  if (e.target.checked) {
                                    newSet.add(color.id);
                                  } else {
                                    newSet.delete(color.id);
                                  }
                                  setSelectedColors(newSet);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Product</span>
                                <span className="text-gray-500 truncate">{color.variant.product.productName}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Size</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                                  {color.variant.packingSize}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Stock</span>
                                <span className="font-mono font-semibold">{color.stockQuantity}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Status</span>
                                <div className="text-sm">{getStockBadge(color.stockQuantity)}</div>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-gray-300 text-gray-700 hover:border-purple-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingColor(color);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              {canEditStock && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-gray-300 text-gray-700 hover:border-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingColor(color);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock In Tab */}
        <TabsContent value="stock-in" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Stock In</CardTitle>
                  <p className="text-sm text-gray-600">Add inventory to existing colors</p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setIsStockInDialogOpen(true)}
                  className="flex items-center gap-2 border-gray-300 hover:border-green-300"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Add Stock
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {colorsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-12">
                  <TruckIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No colors found</h3>
                  <p className="text-gray-600 mb-4">Add colors first before using stock in functionality</p>
                  <Button 
                    onClick={() => setIsColorDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Colors
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by color code, name, company, or product..." 
                      value={stockInSearchQuery} 
                      onChange={e => setStockInSearchQuery(e.target.value)} 
                      className="pl-9 border-gray-300"
                    />
                  </div>

                  {filteredColorsForStockIn.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No colors found matching your search</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredColorsForStockIn.map(color => (
                        <Card 
                          key={color.id} 
                          className="rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => {
                            stockInForm.setValue("colorId", color.id);
                            stockInForm.setValue("quantity", "");
                            stockInForm.setValue("notes", "");
                            stockInForm.setValue("stockInDate", formatDateToDDMMYYYY(new Date()));
                            setSelectedColorForStockIn(color);
                            setIsStockInDialogOpen(true);
                          }}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                                  style={{ backgroundColor: color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : color.colorCode }}
                                />
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                                    {color.colorName}
                                  </h3>
                                  <p className="text-sm font-mono text-gray-600">{color.colorCode}</p>
                                </div>
                              </div>
                              {getStockBadge(color.stockQuantity)}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Product</span>
                                <span className="text-gray-500 truncate">{color.variant.product.productName}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Size</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                                  {color.variant.packingSize}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Current Stock</span>
                                <span className="font-mono font-semibold text-blue-600">{color.stockQuantity}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Company</span>
                                <span className="text-gray-500">{color.variant.product.company}</span>
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

          {/* Stock In Dialog */}
          <Dialog open={isStockInDialogOpen} onOpenChange={(open) => {
            setIsStockInDialogOpen(open);
            if (!open) {
              setSelectedColorForStockIn(null);
              setStockInSearchQuery("");
              stockInForm.reset({
                stockInDate: formatDateToDDMMYYYY(new Date())
              });
            }
          }}>
            <DialogContent className="bg-white border border-gray-200 max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5" />
                  Add Stock
                </DialogTitle>
                <DialogDescription>Add quantity to inventory with date tracking</DialogDescription>
              </DialogHeader>

              {!selectedColorForStockIn ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by color code, name, product, or company..." 
                      value={stockInSearchQuery} 
                      onChange={e => setStockInSearchQuery(e.target.value)} 
                      className="pl-9 border-gray-300"
                    />
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {filteredColorsForStockIn.length === 0 ? (
                      <div className="text-center py-8 text-gray-600">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{stockInSearchQuery ? "No colors found matching your search" : "No colors available"}</p>
                      </div>
                    ) : (
                      filteredColorsForStockIn.map(color => (
                        <div 
                          key={color.id} 
                          className="bg-white rounded-xl p-3 border border-gray-200 hover:shadow-md cursor-pointer transition-shadow"
                          onClick={() => {
                            setSelectedColorForStockIn(color);
                            stockInForm.setValue("colorId", color.id);
                            stockInForm.setValue("stockInDate", formatDateToDDMMYYYY(new Date()));
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold font-mono text-sm">{color.colorCode}</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                                  Stock: {color.stockQuantity}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600">{color.colorName}</p>
                              <p className="text-xs text-gray-600">
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
                  <form onSubmit={stockInForm.handleSubmit((data) => stockInMutation.mutate(data))} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-700">Selected Color</Label>
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div 
                                className="w-6 h-6 rounded border-2 border-white shadow-sm"
                                style={{ backgroundColor: selectedColorForStockIn.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : selectedColorForStockIn.colorCode }}
                              />
                              <span className="font-semibold font-mono text-sm">{selectedColorForStockIn.colorCode}</span>
                              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                                Current: {selectedColorForStockIn.stockQuantity}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{selectedColorForStockIn.colorName}</p>
                            <p className="text-xs text-gray-600">
                              {selectedColorForStockIn.variant.product.company} - {selectedColorForStockIn.variant.product.productName} ({selectedColorForStockIn.variant.packingSize})
                            </p>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSelectedColorForStockIn(null)}
                            className="border-gray-300"
                          >
                            Change
                          </Button>
                        </div>
                      </div>
                    </div>

                    <FormField control={stockInForm.control} name="quantity" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity to Add</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            step="1" 
                            placeholder="0" 
                            {...field} 
                            className="border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={stockInForm.control} name="stockInDate" render={({ field }) => (
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
                            className="border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={stockInForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any notes about this stock addition..." 
                            {...field} 
                            className="border-gray-300"
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
                          setSelectedColorForStockIn(null);
                          setStockInSearchQuery("");
                          stockInForm.reset({
                            stockInDate: formatDateToDDMMYYYY(new Date())
                          });
                        }}
                        className="border-gray-300"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={stockInMutation.isPending}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                      >
                        {stockInMutation.isPending ? "Adding..." : "Add Stock"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Stock In History Tab */}
        <TabsContent value="stock-in-history" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Stock In History ({filteredStockInHistory.length})</CardTitle>
                  <p className="text-sm text-gray-600">Track all stock additions and inventory changes</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshStockInHistory}
                    className="border-gray-300"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportStockInHistory}
                    className="border-gray-300"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportStockInHistoryPDF}
                    className="border-gray-300"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : filteredStockInHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No stock history found</h3>
                  <p className="text-gray-600 mb-4">Stock in history will appear here when you add stock to colors</p>
                  <Button 
                    onClick={refreshStockInHistory}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh History
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Enhanced Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Start Date</Label>
                      <Input
                        type="date"
                        value={historyStartDate || ''}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="w-full border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">End Date</Label>
                      <Input
                        type="date"
                        value={historyEndDate || ''}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="w-full border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Company</Label>
                      <Select value={historyCompanyFilter} onValueChange={setHistoryCompanyFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Product</Label>
                      <Select value={historyProductFilter} onValueChange={setHistoryProductFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Products" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Products</SelectItem>
                          {Array.from(new Set(stockInHistory.map(h => h.color.variant.product.productName))).sort().map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Search and Quick Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-medium text-gray-700">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder="Search by color code, color name, stock in date..." 
                          value={historySearchQuery}
                          onChange={e => setHistorySearchQuery(e.target.value)}
                          className="pl-9 border-gray-300"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Quick Date Filters</Label>
                      <Select value={historyDateFilter} onValueChange={setHistoryDateFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Time" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="week">Last 7 Days</SelectItem>
                          <SelectItem value="month">Last 30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {(historyCompanyFilter !== "all" || historyProductFilter !== "all" || historyDateFilter !== "all" || historySearchQuery || historyStartDate || historyEndDate) && (
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        Showing {filteredStockInHistory.length} of {stockInHistory.length} records
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setHistoryCompanyFilter("all");
                          setHistoryProductFilter("all");
                          setHistoryDateFilter("all");
                          setHistorySearchQuery("");
                          setHistoryStartDate("");
                          setHistoryEndDate("");
                        }}
                        className="border-gray-300"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Clear All Filters
                      </Button>
                    </div>
                  )}

                  {/* History Cards */}
                  {filteredStockInHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No history found matching your filters</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredStockInHistory.map(history => {
                        const isReturn = history.type === 'return';
                        return (
                        <Card 
                          key={history.id} 
                          className={`rounded-2xl p-4 border hover:shadow-lg transition-all cursor-pointer group ${isReturn ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}
                          onClick={() => {
                            if (canDeleteStockHistory) {
                              setEditingStockHistory(history);
                              setIsEditStockHistoryOpen(true);
                            }
                          }}
                          data-testid={`card-stock-history-${history.id}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                                  style={{ backgroundColor: history.color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : history.color.colorCode }}
                                />
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors" data-testid={`text-color-name-${history.id}`}>
                                    {history.color.colorName}
                                  </h3>
                                  <p className="text-sm font-mono text-gray-600" data-testid={`text-color-code-${history.id}`}>{history.color.colorCode}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {isReturn && (
                                  <Badge className="bg-amber-500 text-white text-xs" data-testid={`badge-returned-${history.id}`}>
                                    Returned
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-xs" data-testid={`badge-date-${history.id}`}>
                                  {history.stockInDate}
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Product</span>
                                <span className="text-gray-500 truncate" data-testid={`text-product-${history.id}`}>{history.color.variant.product.productName}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Size</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200" data-testid={`badge-size-${history.id}`}>
                                  {history.color.variant.packingSize}
                                </Badge>
                              </div>
                              
                              {/* Customer Info for Returns */}
                              {isReturn && history.customerName && (
                                <div className="bg-amber-100/50 p-2 rounded-lg border border-amber-200 space-y-1" data-testid={`return-info-${history.id}`}>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-amber-700 font-medium">Customer</span>
                                    <span className="text-gray-800 font-semibold" data-testid={`text-return-customer-${history.id}`}>{history.customerName}</span>
                                  </div>
                                  {history.customerPhone && (
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-700 font-medium">Phone</span>
                                      <span className="text-gray-700" data-testid={`text-return-phone-${history.id}`}>{history.customerPhone}</span>
                                    </div>
                                  )}
                                  {history.saleId && (
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-700 font-medium">Bill Ref</span>
                                      <span className="text-gray-700 font-mono text-xs" data-testid={`text-return-bill-${history.id}`}>{history.saleId.substring(0, 8)}...</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Stock Information */}
                              <div className="grid grid-cols-3 gap-2 text-center mt-3 p-2 bg-gray-50 rounded-lg">
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">Previous</p>
                                  <p className="font-mono text-sm font-semibold text-orange-600" data-testid={`text-previous-stock-${history.id}`}>{history.previousStock}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">{isReturn ? 'Restored' : 'Added'}</p>
                                  <p className={`font-mono text-sm font-semibold ${isReturn ? 'text-amber-600' : 'text-green-600'}`} data-testid={`text-quantity-${history.id}`}>+{history.quantity}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">New</p>
                                  <p className="font-mono text-sm font-semibold text-blue-600" data-testid={`text-new-stock-${history.id}`}>{history.newStock}</p>
                                </div>
                              </div>

                              {history.notes && (
                                <div className={`text-xs p-2 rounded-lg mt-2 ${isReturn ? 'text-amber-700 bg-amber-50' : 'text-gray-600 bg-gray-50'}`} data-testid={`text-notes-${history.id}`}>
                                  <p className="line-clamp-2">{history.notes}</p>
                                </div>
                              )}

                              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200">
                                <span data-testid={`text-date-${history.id}`}>{formatDateShort(history.createdAt)}</span>
                                <span data-testid={`text-time-${history.id}`}>{new Date(history.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )})}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Out History Tab (Items sold through POS) */}
        <TabsContent value="stock-out-history" className="space-y-4">
          <Card className="rounded-2xl border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Stock Out History ({filteredStockOutHistory.length})</CardTitle>
                  <p className="text-sm text-gray-600">Track all items sold through POS bills</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchStockOutHistory()}
                    className="border-gray-300"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {stockOutLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                      <Skeleton className="h-6 w-3/4 mb-2 rounded-lg" />
                      <Skeleton className="h-4 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : filteredStockOutHistory.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowUpCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No stock out records found</h3>
                  <p className="text-gray-600 mb-4">Items sold through POS will appear here</p>
                  <Button 
                    onClick={() => refetchStockOutHistory()}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh History
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Start Date</Label>
                      <Input
                        type="date"
                        value={stockOutStartDate || ''}
                        onChange={(e) => setStockOutStartDate(e.target.value)}
                        className="w-full border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">End Date</Label>
                      <Input
                        type="date"
                        value={stockOutEndDate || ''}
                        onChange={(e) => setStockOutEndDate(e.target.value)}
                        className="w-full border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Company</Label>
                      <Select value={stockOutCompanyFilter} onValueChange={setStockOutCompanyFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Product</Label>
                      <Select value={stockOutProductFilter} onValueChange={setStockOutProductFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Products" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Products</SelectItem>
                          {Array.from(new Set(stockOutHistory.map(h => h.color?.variant?.product?.productName).filter(Boolean))).sort().map(p => (
                            <SelectItem key={p} value={p!}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Search and Quick Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-medium text-gray-700">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder="Search by color, product, customer name or phone..." 
                          value={stockOutSearchQuery}
                          onChange={e => setStockOutSearchQuery(e.target.value)}
                          className="pl-9 border-gray-300"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Quick Date Filters</Label>
                      <Select value={stockOutDateFilter} onValueChange={setStockOutDateFilter}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="All Time" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="week">Last 7 Days</SelectItem>
                          <SelectItem value="month">Last 30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {(stockOutCompanyFilter !== "all" || stockOutProductFilter !== "all" || stockOutDateFilter !== "all" || stockOutSearchQuery || stockOutStartDate || stockOutEndDate) && (
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        Showing {filteredStockOutHistory.length} of {stockOutHistory.length} records
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setStockOutCompanyFilter("all");
                          setStockOutProductFilter("all");
                          setStockOutDateFilter("all");
                          setStockOutSearchQuery("");
                          setStockOutStartDate("");
                          setStockOutEndDate("");
                        }}
                        className="border-gray-300"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Clear All Filters
                      </Button>
                    </div>
                  )}

                  {/* Stock Out Records Grid */}
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {filteredStockOutHistory.map((item) => (
                      <Card 
                        key={item.id}
                        className="rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all"
                      >
                        <CardContent className="p-0">
                          <div className="space-y-3">
                            {/* Header with color info */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-red-100 rounded-lg">
                                  <ArrowUpCircle className="h-4 w-4 text-red-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{item.color?.colorName || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">{item.color?.colorCode || '-'}</p>
                                </div>
                              </div>
                              <Badge className="bg-red-100 text-red-700 border-red-200">
                                -{item.quantity}
                              </Badge>
                            </div>
                            
                            {/* Product Info */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Company</span>
                                <span className="font-medium text-gray-800">{item.color?.variant?.product?.company || '-'}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Product</span>
                                <span className="text-gray-500 truncate">{item.color?.variant?.product?.productName || '-'}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Size</span>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                                  {item.color?.variant?.packingSize || '-'}
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Sale Info */}
                            <div className="grid grid-cols-2 gap-2 text-center mt-3 p-2 bg-gray-50 rounded-lg">
                              <div className="space-y-1">
                                <p className="text-xs text-gray-600">Rate</p>
                                <p className="font-mono text-sm font-semibold text-blue-600">Rs. {Math.round(parseFloat(item.rate)).toLocaleString()}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-gray-600">Total</p>
                                <p className="font-mono text-sm font-semibold text-green-600">Rs. {Math.round(parseFloat(item.subtotal)).toLocaleString()}</p>
                              </div>
                            </div>

                            {/* Customer Info */}
                            {item.customerName && (
                              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded-lg">
                                <p className="font-medium text-blue-800">{item.customerName}</p>
                                <p className="text-blue-600">{item.customerPhone}</p>
                              </div>
                            )}

                            {/* Date */}
                            <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200">
                              <span>{item.soldAt ? formatDateShort(item.soldAt) : '-'}</span>
                              <span>{item.soldAt ? new Date(item.soldAt).toLocaleTimeString() : '-'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        <DialogContent className="bg-white border border-gray-200 max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <div className={`px-3 py-1 rounded ${quickStep === 1 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>1. Product</div>
              <div className={`px-3 py-1 rounded ${quickStep === 2 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>2. Variants</div>
              <div className={`px-3 py-1 rounded ${quickStep === 3 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>3. Colors</div>
            </div>

            {/* Step 1: Product */}
            {quickStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900">Company</Label>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="existing-company" checked={useExistingCompany} onChange={() => setUseExistingCompany(true)} className="h-4 w-4" />
                      <Label htmlFor="existing-company" className="text-sm">Select Existing</Label>
                      <input type="radio" id="new-company" checked={!useExistingCompany} onChange={() => setUseExistingCompany(false)} className="h-4 w-4" />
                      <Label htmlFor="new-company" className="text-sm">Add New</Label>
                    </div>
                  </div>

                  {useExistingCompany ? (
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        {companies.map(company => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={newCompany} 
                      onChange={e => setNewCompany(e.target.value)} 
                      placeholder="Enter new company name" 
                      className="border-gray-300"
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900">Product</Label>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="existing-product" checked={useExistingProduct} onChange={() => setUseExistingProduct(true)} className="h-4 w-4" disabled={!selectedCompany && useExistingCompany} />
                      <Label htmlFor="existing-product" className="text-sm">Select Existing</Label>
                      <input type="radio" id="new-product" checked={!useExistingProduct} onChange={() => setUseExistingProduct(false)} className="h-4 w-4" />
                      <Label htmlFor="new-product" className="text-sm">Add New</Label>
                    </div>
                  </div>

                  {useExistingProduct ? (
                    <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedCompany}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder={selectedCompany ? "Select product" : "Select company first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        {productsByCompany.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={newProduct} 
                      onChange={e => setNewProduct(e.target.value)} 
                      placeholder="Enter new product name" 
                      className="border-gray-300"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsQuickAddOpen(false)}
                    className="border-gray-300"
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
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("variants")}>
                    <h3 className="font-semibold text-lg text-gray-900">Variants</h3>
                    <Button variant="ghost" size="sm" className="border-gray-300">
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
                                className="border-gray-300"
                              />
                            </div>
                            <div className="col-span-5">
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="Rate (Rs.)" 
                                value={variant.rate} 
                                onChange={e => updateVariant(index, "rate", e.target.value)} 
                                className="border-gray-300"
                              />
                            </div>
                            <div className="col-span-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeVariantAt(index)} 
                                disabled={quickVariants.length === 1}
                                className="border-gray-300"
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
                        className="border-gray-300"
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
                    className="border-gray-300"
                  >
                    ← Back
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="border-gray-300"
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
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("colors")}>
                    <h3 className="font-semibold text-lg text-gray-900">Colors</h3>
                    <Button variant="ghost" size="sm" className="border-gray-300">
                      {expandedSections.colors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {expandedSections.colors && (
                    <div className="mt-4 space-y-4">
                      <div className="text-sm text-gray-600 mb-2 p-2 bg-blue-50 rounded-lg">
                        💡 Tip: Leave "Custom Rate" empty to use the variant's default rate. Only set it if this color has a different price.
                      </div>
                      <div className="space-y-3">
                        {quickColors.map((color, index) => (
                          <div key={color.id} className="space-y-2 p-3 bg-white rounded-lg border border-gray-200">
                            <div className="grid grid-cols-12 gap-3 items-center">
                              <div className="col-span-4">
                                <Input 
                                  placeholder="Color name" 
                                  value={color.colorName} 
                                  onChange={e => updateColor(index, "colorName", e.target.value)} 
                                  className="border-gray-300"
                                />
                              </div>
                              <div className="col-span-4">
                                <Input 
                                  placeholder="Color code" 
                                  value={color.colorCode} 
                                  onChange={e => updateColor(index, "colorCode", e.target.value)} 
                                  className="border-gray-300"
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
                                  className="border-gray-300 border-dashed"
                                />
                              </div>
                              <div className="col-span-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => removeColorAt(index)} 
                                  disabled={quickColors.length === 1}
                                  className="border-gray-300"
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
                        className="border-gray-300"
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
                    className="border-gray-300"
                  >
                    ← Back
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                    <Input {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={productForm.control} name="productName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingProduct(null)}
                  className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border border-gray-200">
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
                    <Input {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={variantForm.control} name="rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (Rs.)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingVariant(null)}
                  className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select variant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border border-gray-200">
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
                    <Input {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Code</FormLabel>
                  <FormControl>
                    <Input {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} className="border-gray-300" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={colorForm.control} name="rateOverride" render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Rate (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="Leave empty to use variant rate" {...field} className="border-gray-300" />
                  </FormControl>
                  <p className="text-xs text-gray-600">Default: Rs. {editingColor ? Math.round(parseFloat(editingColor.variant.rate)) : '0'}</p>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingColor(null)}
                  className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                  <Label className="text-gray-700">Color Details</Label>
                  <div className="bg-white rounded-xl p-3 border border-gray-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border-2 border-white shadow-sm"
                          style={{ backgroundColor: editingStockHistory.color.colorCode.toLowerCase().includes('ral') ? '#f0f0f0' : editingStockHistory.color.colorCode }}
                        />
                        <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 font-mono">
                          {editingStockHistory.color.colorCode}
                        </Badge>
                        <span className="font-medium">{editingStockHistory.color.colorName}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {editingStockHistory.color.variant.product.company} - {editingStockHistory.color.variant.product.productName} ({editingStockHistory.color.variant.packingSize})
                      </p>
                    </div>
                  </div>
                </div>

                <FormField control={stockHistoryEditForm.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" step="1" {...field} className="border-gray-300" />
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
                        className="border-gray-300"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={stockHistoryEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any notes..." {...field} className="border-gray-300" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditStockHistoryOpen(false)}
                    className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                  <Label className="text-sm font-medium text-gray-700">Company</Label>
                  <p className="text-sm text-gray-800">{viewingProduct.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Product Name</Label>
                  <p className="text-sm text-gray-800">{viewingProduct.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created Date</Label>
                  <p className="text-sm text-gray-600">{formatDateShort(viewingProduct.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Variants Count</Label>
                  <p className="text-sm text-gray-800">{variantsData.filter(v => v.productId === viewingProduct.id).length}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingProduct(null)}
                  className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                  <Label className="text-sm font-medium text-gray-700">Company</Label>
                  <p className="text-sm text-gray-800">{viewingVariant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Product Name</Label>
                  <p className="text-sm text-gray-800">{viewingVariant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Packing Size</Label>
                  <p className="text-sm text-gray-800">{viewingVariant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Rate</Label>
                  <p className="text-sm text-gray-800">Rs. {Math.round(parseFloat(viewingVariant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Colors Count</Label>
                  <p className="text-sm text-gray-800">{colorsData.filter(c => c.variantId === viewingVariant.id).length}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created Date</Label>
                  <p className="text-sm text-gray-600">{formatDateShort(viewingVariant.createdAt)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingVariant(null)}
                  className="border-gray-300"
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
        <DialogContent className="bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
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
                  <Label className="text-sm font-medium text-gray-700">Company</Label>
                  <p className="text-sm text-gray-800">{viewingColor.variant.product.company}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Product Name</Label>
                  <p className="text-sm text-gray-800">{viewingColor.variant.product.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Packing Size</Label>
                  <p className="text-sm text-gray-800">{viewingColor.variant.packingSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Default Rate</Label>
                  <p className="text-sm text-gray-800">Rs. {Math.round(parseFloat(viewingColor.variant.rate))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Custom Rate</Label>
                  <p className="text-sm text-gray-800">
                    {viewingColor.rateOverride ? `Rs. ${Math.round(parseFloat(viewingColor.rateOverride))}` : <span className="text-gray-500">-</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Effective Rate</Label>
                  <p className="text-sm font-bold text-blue-600">Rs. {Math.round(parseFloat(getEffectiveRate(viewingColor)))}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Color Name</Label>
                  <p className="text-sm text-gray-800">{viewingColor.colorName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Color Code</Label>
                  <p className="text-sm font-mono text-gray-800">{viewingColor.colorCode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Stock Quantity</Label>
                  <p className="text-sm text-gray-800">{viewingColor.stockQuantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Stock Status</Label>
                  <div className="text-sm">{getStockBadge(viewingColor.stockQuantity)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created Date</Label>
                  <p className="text-sm text-gray-600">{formatDateShort(viewingColor.createdAt)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingColor(null)}
                  className="border-gray-300"
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
