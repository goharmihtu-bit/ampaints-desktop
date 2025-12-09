import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, MoreVertical, Edit, Plus, Trash2, Save, X, Download, MessageCircle, Share2, Printer } from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThermalReceipt from "@/components/thermal-receipt";

type ReturnRecord = {
  id: string;
  saleId: string;
  customerName: string;
  customerPhone: string;
  totalRefund: string;
  createdAt: string;
  status: string;
  refundMethod?: string;
  notes?: string;
};

export default function BillPrint() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { canDeleteSales, canEditSales } = usePermissions();
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [customRate, setCustomRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItems, setEditingItems] = useState<{ [key: string]: { quantity: string; rate: string } }>({});
  const [editingPaidAmount, setEditingPaidAmount] = useState("");
  
  const referrer = new URLSearchParams(searchParams).get('from');

  const { data: sale, isLoading, error } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Fetch returns for this sale
  const { data: saleReturns = [] } = useQuery<ReturnRecord[]>({
    queryKey: ["/api/returns/sale", saleId],
    enabled: !!saleId,
  });

  // Calculate total returns amount for this sale
  const totalReturnsAmount = useMemo(() => {
    if (!saleReturns.length) return 0;
    
    return saleReturns.reduce((total, ret) => {
      // Only count returns that are completed/approved
      if (ret.status === "completed" || !ret.status) {
        return total + parseFloat(ret.totalRefund || "0");
      }
      return total;
    }, 0);
  }, [saleReturns]);

  // Calculate adjusted totals including returns
  const adjustedTotals = useMemo(() => {
    if (!sale) return null;

    const originalTotal = parseFloat(sale.totalAmount);
    const originalPaid = parseFloat(sale.amountPaid);
    
    const netTotal = originalTotal - totalReturnsAmount;
    const outstanding = netTotal - originalPaid;
    const isPaid = outstanding <= 0;

    return {
      originalTotal,
      originalPaid,
      totalReturnsAmount,
      netTotal,
      outstanding,
      isPaid,
      hasReturns: totalReturnsAmount > 0
    };
  }, [sale, totalReturnsAmount]);

  // Delete Bill - IMPROVED VERSION
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      // First delete all sale items
      for (const item of sale?.saleItems || []) {
        await apiRequest("DELETE", `/api/sale-items/${item.id}`);
      }
      
      // Then delete the sale record
      await apiRequest("DELETE", `/api/sales/${saleId}`);
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sale-items"] });
      
      toast({ 
        title: "Bill completely deleted", 
        description: "All bill data has been removed successfully" 
      });
      
      // Redirect to POS with cache clearance
      setTimeout(() => {
        window.location.href = "/pos?refresh=" + Date.now();
      }, 500);
      
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast({ 
        title: "Failed to delete bill", 
        variant: "destructive",
        description: "Please try again" 
      });
    }
  };

  // Print Thermal
  const printThermal = () => {
    setTimeout(() => window.print(), 200);
  };

  // Direct Print - Simplified for Electron
  const directPrint = () => {
    if (!sale) return;
    
    // Check if running in Electron
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.printSilent) {
      // Use Electron silent print
      electronAPI.printSilent()
        .then(() => {
          toast({
            title: "Print Successful",
            description: `Receipt #${sale.id.slice(0, 8).toUpperCase()} sent to printer`,
          });
        })
        .catch((error: any) => {
          console.error("Print error:", error);
          toast({
            title: "Print Failed",
            description: "Check printer connection or use Print button instead",
            variant: "destructive"
          });
        });
    } else {
      // Fallback: use browser print
      toast({
        title: "Using Browser Print",
        description: "Direct print not available. Using standard print dialog.",
      });
      setTimeout(() => window.print(), 200);
    }
  };

  // Handle Back Navigation
  const handleGoBack = () => {
    if (referrer && sale?.customerPhone) {
      setLocation(`/customer/${encodeURIComponent(sale.customerPhone)}`);
    } else {
      setLocation('/sales');
    }
  };

  // Format phone for WhatsApp with validation
  const formatPhoneForWhatsApp = (phone: string): string | null => {
    if (!phone || phone.trim().length < 10) {
      return null;
    }
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) {
      return null;
    }
    if (cleaned.startsWith('0')) {
      cleaned = '92' + cleaned.slice(1);
    } else if (!cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
      cleaned = '92' + cleaned;
    }
    cleaned = cleaned.replace(/^\+/, '');
    if (cleaned.length < 12) {
      return null;
    }
    return cleaned;
  };

  // Download Bill as PDF - Professional Design with Returns Adjustment
  const downloadBillPDF = () => {
    if (!sale || !adjustedTotals) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(receiptSettings.businessName, pageWidth / 2, 18, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.address, pageWidth / 2, 26, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(receiptSettings.dealerText + ' ' + receiptSettings.dealerBrands, pageWidth / 2, 33, { align: 'center' });

    pdf.setTextColor(0, 0, 0);
    yPos = 50;

    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');
    pdf.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('INVOICE NUMBER', margin + 5, yPos + 6);
    pdf.text('DATE', margin + 5, yPos + 18);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`#${sale.id.slice(0, 8).toUpperCase()}`, margin + 5, yPos + 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(sale.createdAt), margin + 5, yPos + 24);

    const rightBoxX = pageWidth / 2 + 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('BILL TO', rightBoxX, yPos + 6);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sale.customerName, rightBoxX, yPos + 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sale.customerPhone, rightBoxX, yPos + 20);

    yPos += 38;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    const colX = {
      item: margin + 3,
      packing: margin + 80,
      qty: margin + 110,
      rate: margin + 130,
      amount: pageWidth - margin - 3
    };

    pdf.text('ITEM DESCRIPTION', colX.item, yPos + 5.5);
    pdf.text('SIZE', colX.packing, yPos + 5.5);
    pdf.text('QTY', colX.qty, yPos + 5.5);
    pdf.text('RATE', colX.rate, yPos + 5.5);
    pdf.text('AMOUNT', colX.amount, yPos + 5.5, { align: 'right' });

    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    sale.saleItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(item.color.variant.product.productName, colX.item, yPos + 4);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${item.color.colorName} (${item.color.colorCode})`, colX.item, yPos + 8);
      pdf.setTextColor(0, 0, 0);

      pdf.text(item.color.variant.packingSize, colX.packing, yPos + 6);
      pdf.text(item.quantity.toString(), colX.qty, yPos + 6);
      pdf.text(`Rs.${Math.round(parseFloat(item.rate)).toLocaleString()}`, colX.rate, yPos + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Rs.${Math.round(parseFloat(item.subtotal)).toLocaleString()}`, colX.amount, yPos + 6, { align: 'right' });

      yPos += 12;
    });

    yPos += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    const summaryX = pageWidth - margin - 60;
    const valueX = pageWidth - margin;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Original Total:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(adjustedTotals.originalTotal).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    // Show returns adjustment if applicable
    if (adjustedTotals.hasReturns) {
      pdf.setTextColor(255, 0, 0);
      pdf.text('Returns Adjustment:', summaryX, yPos);
      pdf.text(`- Rs. ${Math.round(adjustedTotals.totalReturnsAmount).toLocaleString()}`, valueX, yPos, { align: 'right' });
      yPos += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Net Total:', summaryX, yPos);
      pdf.text(`Rs. ${Math.round(adjustedTotals.netTotal).toLocaleString()}`, valueX, yPos, { align: 'right' });
      yPos += 7;
    }

    pdf.setTextColor(34, 139, 34);
    pdf.text('Amount Paid:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(adjustedTotals.originalPaid).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(summaryX - 5, yPos - 4, pageWidth - summaryX + 5 - margin + 5, 12, 2, 2, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    if (adjustedTotals.outstanding > 0) {
      pdf.text('BALANCE DUE:', summaryX, yPos + 4);
      pdf.text(`Rs. ${Math.round(adjustedTotals.outstanding).toLocaleString()}`, valueX, yPos + 4, { align: 'right' });
    } else {
      pdf.text('STATUS:', summaryX, yPos + 4);
      pdf.text('PAID IN FULL', valueX, yPos + 4, { align: 'right' });
    }

    yPos += 25;

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.thankYou, pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;
    pdf.setFontSize(8);
    pdf.text('This is a computer-generated invoice.', pageWidth / 2, yPos, { align: 'center' });

    pdf.save(`Invoice-${sale.id.slice(0, 8).toUpperCase()}-${formatDateShort(sale.createdAt).replace(/\//g, '-')}.pdf`);
    
    toast({
      title: "Invoice Downloaded",
      description: "Professional invoice has been downloaded as PDF.",
    });
  };

  // Generate Bill PDF as Blob for sharing
  const generateBillPDFBlob = (): Blob | null => {
    if (!sale || !adjustedTotals) return null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(receiptSettings.businessName, pageWidth / 2, 18, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.address, pageWidth / 2, 26, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(receiptSettings.dealerText + ' ' + receiptSettings.dealerBrands, pageWidth / 2, 33, { align: 'center' });

    pdf.setTextColor(0, 0, 0);
    yPos = 50;

    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');
    pdf.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('INVOICE NUMBER', margin + 5, yPos + 6);
    pdf.text('DATE', margin + 5, yPos + 18);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`#${sale.id.slice(0, 8).toUpperCase()}`, margin + 5, yPos + 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(sale.createdAt), margin + 5, yPos + 24);

    const rightBoxX = pageWidth / 2 + 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('BILL TO', rightBoxX, yPos + 6);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sale.customerName, rightBoxX, yPos + 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sale.customerPhone, rightBoxX, yPos + 20);

    yPos += 38;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    const colX = {
      item: margin + 3,
      packing: margin + 80,
      qty: margin + 110,
      rate: margin + 130,
      amount: pageWidth - margin - 3
    };

    pdf.text('ITEM DESCRIPTION', colX.item, yPos + 5.5);
    pdf.text('SIZE', colX.packing, yPos + 5.5);
    pdf.text('QTY', colX.qty, yPos + 5.5);
    pdf.text('RATE', colX.rate, yPos + 5.5);
    pdf.text('AMOUNT', colX.amount, yPos + 5.5, { align: 'right' });

    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    sale.saleItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(item.color.variant.product.productName, colX.item, yPos + 4);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${item.color.colorName} (${item.color.colorCode})`, colX.item, yPos + 8);
      pdf.setTextColor(0, 0, 0);

      pdf.text(item.color.variant.packingSize, colX.packing, yPos + 6);
      pdf.text(item.quantity.toString(), colX.qty, yPos + 6);
      pdf.text(`Rs.${Math.round(parseFloat(item.rate)).toLocaleString()}`, colX.rate, yPos + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Rs.${Math.round(parseFloat(item.subtotal)).toLocaleString()}`, colX.amount, yPos + 6, { align: 'right' });

      yPos += 12;
    });

    yPos += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    const summaryX = pageWidth - margin - 60;
    const valueX = pageWidth - margin;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Original Total:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(adjustedTotals.originalTotal).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    // Show returns adjustment if applicable
    if (adjustedTotals.hasReturns) {
      pdf.setTextColor(255, 0, 0);
      pdf.text('Returns Adjustment:', summaryX, yPos);
      pdf.text(`- Rs. ${Math.round(adjustedTotals.totalReturnsAmount).toLocaleString()}`, valueX, yPos, { align: 'right' });
      yPos += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Net Total:', summaryX, yPos);
      pdf.text(`Rs. ${Math.round(adjustedTotals.netTotal).toLocaleString()}`, valueX, yPos, { align: 'right' });
      yPos += 7;
    }

    pdf.setTextColor(34, 139, 34);
    pdf.text('Amount Paid:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(adjustedTotals.originalPaid).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(summaryX - 5, yPos - 4, pageWidth - summaryX + 5 - margin + 5, 12, 2, 2, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    if (adjustedTotals.outstanding > 0) {
      pdf.text('BALANCE DUE:', summaryX, yPos + 4);
      pdf.text(`Rs. ${Math.round(adjustedTotals.outstanding).toLocaleString()}`, valueX, yPos + 4, { align: 'right' });
    } else {
      pdf.text('STATUS:', summaryX, yPos + 4);
      pdf.text('PAID IN FULL', valueX, yPos + 4, { align: 'right' });
    }

    yPos += 25;

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.thankYou, pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;
    pdf.setFontSize(8);
    pdf.text('This is a computer-generated invoice.', pageWidth / 2, yPos, { align: 'center' });

    return pdf.output('blob');
  };

  // Share Bill via WhatsApp - WITH PDF FILE SUPPORT
  const shareToWhatsApp = async () => {
    if (!sale || !adjustedTotals) return;

    const whatsappPhone = formatPhoneForWhatsApp(sale.customerPhone);
    
    if (!whatsappPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Customer phone number is invalid for WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const pdfBlob = generateBillPDFBlob();
    if (!pdfBlob) return;

    const fileName = `Invoice-${sale.id.slice(0, 8).toUpperCase()}-${formatDateShort(sale.createdAt).replace(/\//g, '-')}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Check if Electron API available for direct share
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.shareToWhatsApp) {
      try {
        // Try Electron native share
        await electronAPI.shareToWhatsApp(whatsappPhone, {
          fileName: fileName,
          pdfData: await pdfBlob.arrayBuffer(),
          businessName: receiptSettings.businessName,
          totalAmount: Math.round(adjustedTotals.netTotal),
          customerName: sale.customerName,
        });
        toast({
          title: "Shared Successfully",
          description: "Invoice sent to WhatsApp",
        });
        return;
      } catch (error) {
        console.log('Electron share failed, trying fallback');
      }
    }

    // Try Web Share API (works on some mobile browsers)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice - ${sale.customerName}`,
          text: `Invoice from ${receiptSettings.businessName}`
        });
        toast({
          title: "Shared Successfully",
          description: "Invoice shared via WhatsApp",
        });
        return;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.log('Web share failed, using text fallback');
        } else {
          return;
        }
      }
    }

    // Fallback: Text message with WhatsApp link
    const itemsList = sale.saleItems.map(item => 
      `${item.color.variant.product.productName} x${item.quantity} Rs.${Math.round(parseFloat(item.subtotal))}`
    ).join('\n');

    let message = `*${receiptSettings.businessName}*\n*Bill #${sale.id.slice(0, 8).toUpperCase()}*\n\n${sale.customerName}\n\n*Items:*\n${itemsList}\n\n`;

    if (adjustedTotals.hasReturns) {
      message += `*Original Total:* Rs.${Math.round(adjustedTotals.originalTotal).toLocaleString()}\n`;
      message += `*Returns Adjustment:* -Rs.${Math.round(adjustedTotals.totalReturnsAmount).toLocaleString()}\n`;
      message += `*Net Total:* Rs.${Math.round(adjustedTotals.netTotal).toLocaleString()}\n`;
    } else {
      message += `*Total:* Rs.${Math.round(adjustedTotals.netTotal).toLocaleString()}\n`;
    }

    message += `*Paid:* Rs.${Math.round(adjustedTotals.originalPaid).toLocaleString()}\n`;
    message += adjustedTotals.outstanding > 0 ? 
      `*Due:* Rs.${Math.round(adjustedTotals.outstanding).toLocaleString()}\n` : 
      '*Status: PAID*\n';
    
    message += `\n${receiptSettings.thankYou}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');
    
    toast({
      title: "WhatsApp Opening",
      description: "Bill details sent to WhatsApp. Send PDF separately from your device.",
    });
  };

  // Add Item with Custom Rate
  const handleAddItem = () => {
    if (!selectedColor) return toast({ title: "Select product", variant: "destructive" });
    const qty = parseInt(quantity);
    if (qty < 1) return toast({ title: "Invalid quantity", variant: "destructive" });

    // Use custom rate if provided, otherwise use product's default rate
    const itemRate = customRate ? parseFloat(customRate) : parseFloat(selectedColor.variant.rate);
    
    if (isNaN(itemRate) || itemRate < 0) return toast({ title: "Invalid rate", variant: "destructive" });

    apiRequest("POST", `/api/sales/${saleId}/items`, {
      colorId: selectedColor.id,
      quantity: qty,
      rate: itemRate,
      subtotal: itemRate * qty,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: "Item added" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setCustomRate("");
      setSearchQuery("");
    });
  };

  // Start Edit Mode
  const startEditMode = () => {
    if (!sale) return;

    const initialEditingState: { [key: string]: { quantity: string; rate: string } } = {};
    sale.saleItems.forEach(item => {
      initialEditingState[item.id] = {
        quantity: item.quantity.toString(),
        rate: item.rate.toString()
      };
    });

    setEditingItems(initialEditingState);
    setEditingPaidAmount(sale.amountPaid);
    setEditMode(true);
  };

  // Cancel Edit Mode
  const cancelEditMode = () => {
    setEditingItems({});
    setEditingPaidAmount("");
    setEditMode(false);
  };

  // Update Item Field
  const updateEditingItem = (itemId: string, field: 'quantity' | 'rate', value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Save All Changes
  const saveAllChanges = async () => {
    if (!sale) return;

    try {
      let hasChanges = false;

      // Update existing items
      for (const item of sale.saleItems) {
        const editingItem = editingItems[item.id];
        if (!editingItem) continue;

        const newQuantity = parseInt(editingItem.quantity);
        const newRate = parseFloat(editingItem.rate);

        if (isNaN(newQuantity) || newQuantity < 1) {
          toast({ title: `Invalid quantity for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        if (isNaN(newRate) || newRate < 0) {
          toast({ title: `Invalid rate for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        // Only update if changed
        if (newQuantity !== item.quantity || newRate !== parseFloat(item.rate)) {
          hasChanges = true;
          await apiRequest("PATCH", `/api/sale-items/${item.id}`, {
            quantity: newQuantity,
            rate: newRate,
            subtotal: newRate * newQuantity,
          });
        }
      }

      // Update paid amount if changed
      const newPaidAmount = parseFloat(editingPaidAmount);
      const oldPaidAmount = parseFloat(sale.amountPaid);
      if (!isNaN(newPaidAmount) && newPaidAmount >= 0 && newPaidAmount !== oldPaidAmount) {
        hasChanges = true;
        await apiRequest("PATCH", `/api/sales/${saleId}/paid-amount`, {
          amountPaid: newPaidAmount,
        });
      }

      if (hasChanges) {
        // Invalidate all relevant queries
        await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/customer", sale.customerPhone, "statement"] });
        toast({ title: "All changes saved" });
      } else {
        toast({ title: "No changes to save" });
      }

      setEditMode(false);
      setEditingItems({});
      setEditingPaidAmount("");
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  // Delete Individual Item
  const deleteItem = async (itemId: string, itemName: string) => {
    try {
      await apiRequest("DELETE", `/api/sale-items/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: `${itemName} deleted` });

      // Remove from editing state if exists
      setEditingItems(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Failed to delete item", variant: "destructive" });
    }
  };

  // Smart Search with Exact Color Code Priority
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;

    const q = searchQuery.toLowerCase().trim();
    
    // First, find exact color code matches
    const exactColorCodeMatches = colors.filter(c => 
      c.colorCode.toLowerCase() === q
    );

    // Then find partial matches
    const partialMatches = colors.filter(c => 
      c.colorName.toLowerCase().includes(q) ||
      c.colorCode.toLowerCase().includes(q) ||
      c.variant.product.company.toLowerCase().includes(q) ||
      c.variant.product.productName.toLowerCase().includes(q) ||
      c.variant.packingSize.toLowerCase().includes(q)
    ).filter(item => !exactColorCodeMatches.includes(item));

    // Combine results: exact matches first, then partial matches
    return [...exactColorCodeMatches, ...partialMatches];
  }, [colors, searchQuery]);

  // Reset custom rate when selecting new color
  useEffect(() => {
    if (selectedColor) {
      setCustomRate(selectedColor.variant.rate);
    }
  }, [selectedColor]);

  const formatDate = (d: string) => formatDateShort(d);

  // Show error if bill not found
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Bill Not Found</h1>
          <p className="text-muted-foreground">The bill you are looking for does not exist or has been deleted.</p>
          <Link href="/pos">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to POS
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full max-w-2xl mx-auto" /></div>;
  if (!sale) return <div className="p-6 text-center text-muted-foreground">Bill not found</div>;

  const isPaid = adjustedTotals ? adjustedTotals.isPaid : false;

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Helper: Short Product Name for Receipt
  const getShortProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName}`;
  };

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print flex-wrap gap-2">
          <Button variant="outline" onClick={handleGoBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={downloadBillPDF} variant="outline" data-testid="button-download-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={printThermal} className="font-medium" data-testid="button-print-receipt">
              <Receipt className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={shareToWhatsApp} variant="outline" data-testid="button-share-whatsapp">
              <MessageCircle className="h-4 w-4 mr-2" />
              Share
            </Button>

            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button variant="outline" onClick={cancelEditMode} data-testid="button-cancel-edit">
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={saveAllChanges} data-testid="button-save-changes">
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </Button>
                </>
              ) : (canEditSales || canDeleteSales) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" data-testid="button-bill-menu">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEditSales && (
                      <DropdownMenuItem onClick={startEditMode} data-testid="menu-edit-bill">
                        <Edit className="h-4 w-4 mr-2" /> Edit Bill
                      </DropdownMenuItem>
                    )}
                    {canEditSales && (
                      <DropdownMenuItem onClick={() => setAddItemDialogOpen(true)} data-testid="menu-add-item">
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                      </DropdownMenuItem>
                    )}
                    {canDeleteSales && (
                      <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600" data-testid="menu-delete-bill">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Bill
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </div>

        {/* Screen View */}
        <Card className="print:hidden">
          <CardContent className="p-8 space-y-6">
            <div className="text-center border-b pb-4">
              <p className="text-xs mt-1">Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <strong>{sale.customerName}</strong></div>
              <div><span className="text-muted-foreground">Phone:</span> <strong>{sale.customerPhone}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> <strong>{formatDateShort(sale.createdAt)}</strong></div>
              <div><span className="text-muted-foreground">Time:</span> <strong>{new Date(sale.createdAt).toLocaleTimeString()}</strong></div>
            </div>

            {/* Returns Information Banner */}
            {adjustedTotals?.hasReturns && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-amber-800">Returns Applied to This Bill</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Total returns: Rs. {Math.round(adjustedTotals.totalReturnsAmount).toLocaleString()}
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Original Bill Total:</span>
                        <span className="font-medium">Rs. {Math.round(adjustedTotals.originalTotal).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Less: Returns:</span>
                        <span className="font-medium">- Rs. {Math.round(adjustedTotals.totalReturnsAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Net Total:</span>
                        <span>Rs. {Math.round(adjustedTotals.netTotal).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h2 className="font-semibold mb-3 flex justify-between items-center">
                <span>Items</span>
                {editMode && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Edit className="h-3 w-3" /> Edit Mode
                  </Badge>
                )}
              </h2>

              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left pb-2">Product</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Rate</th>
                    <th className="text-right pb-2">Amount</th>
                    {editMode && <th className="text-right pb-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sale.saleItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {getProductLine(item)}
                      </td>
                      <td className="py-3 text-right">
                        {editMode ? (
                          <Input
                            type="number"
                            min="1"
                            value={editingItems[item.id]?.quantity || item.quantity}
                            onChange={(e) => updateEditingItem(item.id, 'quantity', e.target.value)}
                            className="w-20 text-right ml-auto"
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {editMode ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingItems[item.id]?.rate || item.rate}
                            onChange={(e) => updateEditingItem(item.id, 'rate', e.target.value)}
                            className="w-24 text-right ml-auto"
                          />
                        ) : (
                          `Rs. ${Math.round(parseFloat(item.rate))}`
                        )}
                      </td>
                      <td className="py-3 text-right font-bold">
                        Rs. {Math.round(parseFloat(item.subtotal))}
                      </td>
                      {editMode && (
                        <td className="py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteItem(item.id, item.color.colorName)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t pt-4 space-y-2 text-lg">
              {/* Original Total (only show if there are returns) */}
              {adjustedTotals?.hasReturns && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Original Total:</span>
                  <span>Rs. {Math.round(adjustedTotals.originalTotal)}</span>
                </div>
              )}

              {/* Returns Adjustment (only show if there are returns) */}
              {adjustedTotals?.hasReturns && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Less: Returns:</span>
                  <span>- Rs. {Math.round(adjustedTotals.totalReturnsAmount)}</span>
                </div>
              )}

              {/* Net Total */}
              <div className="flex justify-between font-bold border-t pt-2">
                <span>{adjustedTotals?.hasReturns ? "Net Total:" : "Total:"}</span>
                <span>Rs. {adjustedTotals ? Math.round(adjustedTotals.netTotal) : Math.round(parseFloat(sale.totalAmount))}</span>
              </div>

              <div className="flex justify-between items-center">
                <span>Paid:</span>
                {editMode ? (
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editingPaidAmount}
                    onChange={(e) => setEditingPaidAmount(e.target.value)}
                    className="w-32 text-right"
                    data-testid="input-edit-paid-amount"
                  />
                ) : (
                  <span>Rs. {Math.round(parseFloat(sale.amountPaid))}</span>
                )}
              </div>
              
              {/* Balance */}
              {adjustedTotals && adjustedTotals.outstanding > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance:</span>
                  <span>Rs. {Math.round(adjustedTotals.outstanding)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {isPaid ? "PAID" : "PENDING"}
                </Badge>
              </div>
            </div>

            <div className="text-center border-t pt-4">
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt - Updated to show returns */}
      <ThermalReceipt 
        sale={sale} 
        receiptSettings={receiptSettings} 
        totalReturnsAmount={totalReturnsAmount}
        netTotal={adjustedTotals?.netTotal}
      />

      {/* Delete Bill Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bill Completely?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
              <li>All items in this bill</li>
              <li>Bill payment information</li>
              <li>Complete sale record</li>
            </ul>
            <p className="text-sm font-medium text-red-600">
              This action cannot be undone and all data will be lost permanently.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Completely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <Input 
            placeholder="Search by color code, color name, product, company..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.map(c => (
              <Card
                key={c.id}
                className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "border-primary bg-accent" : ""}`}
                onClick={() => setSelectedColor(c)}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{c.variant.product.productName} - {c.colorName} {c.colorCode} - {c.variant.packingSize}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.variant.product.company} • {c.variant.product.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                    <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                      Stock: {c.stockQuantity}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedColor && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input 
                  id="quantity"
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">Zero stock allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">
                  Rate (Default: Rs. {Math.round(parseFloat(selectedColor.variant.rate))})
                </Label>
                <Input 
                  id="rate"
                  type="number" 
                  min="0"
                  step="0.01"
                  value={customRate} 
                  onChange={e => setCustomRate(e.target.value)} 
                  placeholder={`Enter custom rate (default: ${selectedColor.variant.rate})`}
                />
                <p className="text-xs text-muted-foreground">
                  You can change the rate from default price
                </p>
              </div>

              {customRate && customRate !== selectedColor.variant.rate && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800 font-medium">
                    Custom rate applied: Rs. {Math.round(parseFloat(customRate))} 
                    {parseFloat(customRate) > parseFloat(selectedColor.variant.rate) ? 
                      ` (+${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})` : 
                      ` (${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddItemDialogOpen(false);
              setSelectedColor(null);
              setCustomRate("");
              setSearchQuery("");
            }}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS - 80MM THERMAL OPTIMIZED */}
      <style>{`
        @media print {
          @page { 
            size: 80mm auto;
            margin: 0;
          }
          html, body { 
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 11px;
            font-weight: bold;
            color: #000 !important;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow-x: hidden;
            border: none !important;
            outline: none !important;
          }
          .no-print, dialog, button { 
            display: none !important; 
          }
          * {
            color: #000 !important;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-sizing: border-box;
          }
          table {
            font-weight: bold;
            border-collapse: collapse;
            width: 100% !important;
            max-width: 100% !important;
          }
          h1, p, td, th, span, div {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        }
      `}</style>

    </>
  );
}