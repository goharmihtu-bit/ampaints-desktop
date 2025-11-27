// routes.ts - Complete Updated Version
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requirePerm, invalidatePermCache } from "./permissions";
import { 
  insertProductSchema, 
  insertVariantSchema, 
  insertColorSchema, 
  insertSaleSchema, 
  insertSaleItemSchema, 
  insertStockInHistorySchema,
  insertPaymentHistorySchema,
  insertReturnSchema,
  insertReturnItemSchema,
  formatDateToDDMMYYYY, 
  parseDDMMYYYYToDate 
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { verifyAuditToken } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Products
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requirePerm('stock:edit'), async (req, res) => {
    try {
      const validated = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validated);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid product data", details: error.errors });
      } else {
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Failed to create product" });
      }
    }
  });

  app.patch("/api/products/:id", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { company, productName } = req.body;
      if (!company || !productName) {
        res.status(400).json({ error: "Company and product name are required" });
        return;
      }
      const product = await storage.updateProduct(req.params.id, { company, productName });
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requirePerm('stock:delete'), async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Variants
  app.get("/api/variants", async (_req, res) => {
    try {
      const variants = await storage.getVariants();
      res.json(variants);
    } catch (error) {
      console.error("Error fetching variants:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });

  app.post("/api/variants", requirePerm('stock:edit'), async (req, res) => {
    try {
      const validated = insertVariantSchema.parse(req.body);
      const variant = await storage.createVariant(validated);
      res.json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid variant data", details: error.errors });
      } else {
        console.error("Error creating variant:", error);
        res.status(500).json({ error: "Failed to create variant" });
      }
    }
  });

  app.patch("/api/variants/:id", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { productId, packingSize, rate } = req.body;
      if (!productId || !packingSize || rate === undefined) {
        res.status(400).json({ error: "Product, packing size, and rate are required" });
        return;
      }
      const variant = await storage.updateVariant(req.params.id, { 
        productId, 
        packingSize, 
        rate: parseFloat(rate) 
      });
      res.json(variant);
    } catch (error) {
      console.error("Error updating variant:", error);
      res.status(500).json({ error: "Failed to update variant" });
    }
  });

  app.patch("/api/variants/:id/rate", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { rate } = req.body;
      if (typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ error: "Invalid rate" });
        return;
      }
      const variant = await storage.updateVariantRate(req.params.id, rate);
      res.json(variant);
    } catch (error) {
      console.error("Error updating variant rate:", error);
      res.status(500).json({ error: "Failed to update variant rate" });
    }
  });

  app.delete("/api/variants/:id", requirePerm('stock:delete'), async (req, res) => {
    try {
      await storage.deleteVariant(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting variant:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // Colors
  app.get("/api/colors", async (_req, res) => {
    try {
      const colors = await storage.getColors();
      res.json(colors);
    } catch (error) {
      console.error("Error fetching colors:", error);
      res.status(500).json({ error: "Failed to fetch colors" });
    }
  });

  app.post("/api/colors", requirePerm('stock:edit'), async (req, res) => {
    try {
      const validated = insertColorSchema.parse(req.body);
      validated.colorCode = validated.colorCode.trim().toUpperCase();
      const color = await storage.createColor(validated);
      res.json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid color data", details: error.errors });
      } else {
        console.error("Error creating color:", error);
        res.status(500).json({ error: "Failed to create color" });
      }
    }
  });

  app.patch("/api/colors/:id", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { colorName, colorCode, stockQuantity } = req.body;
      if (!colorName || !colorCode || stockQuantity === undefined) {
        res.status(400).json({ error: "Color name, code, and stock quantity are required" });
        return;
      }
      const normalizedCode = colorCode.trim().toUpperCase();
      const color = await storage.updateColor(req.params.id, { 
        colorName: colorName.trim(), 
        colorCode: normalizedCode,
        stockQuantity: parseInt(stockQuantity)
      });
      res.json(color);
    } catch (error) {
      console.error("Error updating color:", error);
      res.status(500).json({ error: "Failed to update color" });
    }
  });

  app.patch("/api/colors/:id/stock", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { stockQuantity } = req.body;
      if (typeof stockQuantity !== "number" || stockQuantity < 0) {
        res.status(400).json({ error: "Invalid stock quantity" });
        return;
      }
      const color = await storage.updateColorStock(req.params.id, stockQuantity);
      res.json(color);
    } catch (error) {
      console.error("Error updating color stock:", error);
      res.status(500).json({ error: "Failed to update color stock" });
    }
  });

  app.patch("/api/colors/:id/rate-override", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { rateOverride } = req.body;
      if (rateOverride !== null && (typeof rateOverride !== "number" || rateOverride < 0)) {
        res.status(400).json({ error: "Invalid rate override" });
        return;
      }
      const color = await storage.updateColorRateOverride(req.params.id, rateOverride);
      res.json(color);
    } catch (error) {
      console.error("Error updating color rate override:", error);
      res.status(500).json({ error: "Failed to update color rate override" });
    }
  });

  // FIXED: Stock In endpoint with proper stockInDate handling
  app.post("/api/colors/:id/stock-in", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { quantity, notes, stockInDate } = req.body;
      const colorId = req.params.id;
      
      console.log(`[API] Stock in request: Color ${colorId}, Quantity: ${quantity}, Notes: ${notes}, Date: ${stockInDate}`);

      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ 
          error: "Invalid quantity", 
          details: "Quantity must be a positive number" 
        });
        return;
      }

      if (!colorId || colorId === 'undefined' || colorId === 'null') {
        res.status(400).json({ 
          error: "Invalid color ID", 
          details: "Color ID is required and must be valid" 
        });
        return;
      }

      // Validate stockInDate format if provided
      if (stockInDate && !/^\d{2}-\d{2}-\d{4}$/.test(stockInDate)) {
        res.status(400).json({ 
          error: "Invalid date format", 
          details: "Stock in date must be in DD-MM-YYYY format" 
        });
        return;
      }

      console.log(`[API] Processing stock in for color: ${colorId}`);

      const color = await storage.stockIn(colorId, quantity, notes, stockInDate);
      
      if (!color) {
        res.status(404).json({ 
          error: "Color not found",
          details: `No color found with ID: ${colorId}`
        });
        return;
      }

      console.log(`[API] Stock in successful: ${color.colorName} - New stock: ${color.stockQuantity}`);
      res.json({
        ...color,
        message: `Successfully added ${quantity} units to ${color.colorName}`
      });
    } catch (error) {
      console.error("[API] Error adding stock:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to add stock";
      let errorDetails = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorDetails.includes('not found')) {
        res.status(404).json({ 
          error: "Color not found",
          details: errorDetails
        });
      } else {
        res.status(500).json({ 
          error: errorMessage,
          details: errorDetails
        });
      }
    }
  });

  app.delete("/api/colors/:id", requirePerm('stock:delete'), async (req, res) => {
    try {
      await storage.deleteColor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting color:", error);
      res.status(500).json({ error: "Failed to delete color" });
    }
  });

  // Stock In History - FIXED: Proper endpoints for stock history
  app.get("/api/stock-in/history", async (_req, res) => {
    try {
      console.log("[API] Fetching stock in history");
      const history = await storage.getStockInHistory();
      console.log(`[API] Returning ${history.length} history records`);
      res.json(history);
    } catch (error) {
      console.error("[API] Error fetching stock in history:", error);
      // Return empty array instead of error for better UX
      res.json([]);
    }
  });

  // Filtered Stock In History
  app.get("/api/stock-in/history/filtered", async (req, res) => {
    try {
      const { startDate, endDate, company, product, colorCode, colorName } = req.query;
      
      console.log("[API] Fetching filtered stock history with filters:", {
        startDate, endDate, company, product, colorCode, colorName
      });

      const filters: any = {};

      if (startDate && startDate !== 'null' && startDate !== 'undefined') {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate && endDate !== 'null' && endDate !== 'undefined') {
        filters.endDate = new Date(endDate as string);
        // Set end date to end of day
        filters.endDate.setHours(23, 59, 59, 999);
      }

      if (company && company !== 'all' && company !== 'null' && company !== 'undefined') {
        filters.company = company as string;
      }

      if (product && product !== 'all' && product !== 'null' && product !== 'undefined') {
        filters.product = product as string;
      }

      if (colorCode && colorCode !== 'null' && colorCode !== 'undefined') {
        filters.colorCode = colorCode as string;
      }

      if (colorName && colorName !== 'null' && colorName !== 'undefined') {
        filters.colorName = colorName as string;
      }

      const history = await storage.getFilteredStockInHistory(filters);
      console.log(`[API] Returning ${history.length} filtered history records`);
      res.json(history);
    } catch (error) {
      console.error("[API] Error fetching filtered stock history:", error);
      res.status(500).json({ error: "Failed to fetch filtered stock history" });
    }
  });

  // Delete Stock In History Record
  app.delete("/api/stock-in/history/:id", requirePerm('stockHistory:delete'), async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[API] Deleting stock history record: ${id}`);
      
      await storage.deleteStockInHistory(id);
      res.json({ success: true, message: "Stock history record deleted successfully" });
    } catch (error) {
      console.error("[API] Error deleting stock history:", error);
      res.status(500).json({ error: "Failed to delete stock history record" });
    }
  });

  // FIXED: Update Stock In History Record with proper new stock calculation
  app.patch("/api/stock-in/history/:id", requirePerm('stock:edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity, notes, stockInDate } = req.body;
      
      console.log(`[API] Updating stock history record: ${id}`, { quantity, notes, stockInDate });

      if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0)) {
        res.status(400).json({ error: "Invalid quantity" });
        return;
      }

      // Validate stockInDate format if provided
      if (stockInDate && !/^\d{2}-\d{2}-\d{4}$/.test(stockInDate)) {
        res.status(400).json({ 
          error: "Invalid date format", 
          details: "Stock in date must be in DD-MM-YYYY format" 
        });
        return;
      }

      // Use the fixed updateStockInHistory function that recalculates newStock
      const updatedRecord = await storage.updateStockInHistory(id, { quantity, notes, stockInDate });
      res.json(updatedRecord);
    } catch (error) {
      console.error("[API] Error updating stock history:", error);
      res.status(500).json({ error: "Failed to update stock history record" });
    }
  });

  // Stock Out History (items sold through POS)
  app.get("/api/stock-out/history", async (_req, res) => {
    try {
      console.log("[API] Fetching stock out history (sold items)");
      const history = await storage.getStockOutHistory();
      console.log(`[API] Returning ${history.length} stock out records`);
      res.json(history);
    } catch (error) {
      console.error("[API] Error fetching stock out history:", error);
      res.json([]);
    }
  });

  // Payment History routes
  app.get("/api/payment-history", async (_req, res) => {
    try {
      const history = await storage.getAllPaymentHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching all payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  app.get("/api/payment-history/customer/:phone", async (req, res) => {
    try {
      const history = await storage.getPaymentHistoryByCustomer(req.params.phone);
      res.json(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  app.get("/api/payment-history/sale/:saleId", async (req, res) => {
    try {
      const history = await storage.getPaymentHistoryBySale(req.params.saleId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // Record Payment History (for direct recording if needed)
  app.post("/api/payment-history", async (req, res) => {
    try {
      const validated = insertPaymentHistorySchema.parse(req.body);
      const paymentHistory = await storage.recordPaymentHistory({
        saleId: validated.saleId,
        customerPhone: validated.customerPhone,
        amount: parseFloat(validated.amount),
        previousBalance: parseFloat(validated.previousBalance),
        newBalance: parseFloat(validated.newBalance),
        paymentMethod: validated.paymentMethod,
        notes: validated.notes ?? undefined
      });
      res.json(paymentHistory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid payment history data", details: error.errors });
      } else {
        console.error("Error creating payment history:", error);
        res.status(500).json({ error: "Failed to create payment history" });
      }
    }
  });

  // Update Payment History
  app.patch("/api/payment-history/:id", requirePerm('payment:edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, notes } = req.body;
      
      const updated = await storage.updatePaymentHistory(id, {
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        paymentMethod,
        notes,
      });
      
      if (!updated) {
        res.status(404).json({ error: "Payment record not found" });
        return;
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment history:", error);
      res.status(500).json({ error: "Failed to update payment history" });
    }
  });

  // Delete Payment History
  app.delete("/api/payment-history/:id", requirePerm('payment:delete'), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePaymentHistory(id);
      
      if (!deleted) {
        res.status(404).json({ error: "Payment record not found" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting payment history:", error);
      res.status(500).json({ error: "Failed to delete payment history" });
    }
  });

  // Customer Notes routes
  app.get("/api/customer/:phone/notes", async (req, res) => {
    try {
      const { phone } = req.params;
      const sales = await storage.getSales();
      
      // Get all notes from manual balance sales for this customer
      const customerNotes = sales
        .filter(sale => sale.customerPhone === phone && sale.isManualBalance && sale.notes)
        .map(sale => ({
          id: sale.id,
          saleId: sale.id,
          note: sale.notes!,
          createdBy: "System",
          createdAt: sale.createdAt
        }));
      
      res.json(customerNotes);
    } catch (error) {
      console.error("Error fetching customer notes:", error);
      res.status(500).json({ error: "Failed to fetch customer notes" });
    }
  });

  // Add customer note
  app.post("/api/customer/:phone/notes", async (req, res) => {
    try {
      const { phone } = req.params;
      const { note } = req.body;
      
      if (!note) {
        res.status(400).json({ error: "Note is required" });
        return;
      }
      
      // Get customer name from existing sales
      const sales = await storage.getSales();
      const customerSale = sales.find(sale => sale.customerPhone === phone);
      const customerName = customerSale?.customerName || "Customer";
      
      // Create a manual balance sale with the note
      const sale = await storage.createManualBalance({
        customerName: customerName,
        customerPhone: phone,
        totalAmount: "0",
        dueDate: null,
        notes: note
      });
      
      res.json({ 
        success: true, 
        note: {
          id: sale.id,
          saleId: sale.id,
          note: sale.notes!,
          createdBy: "System",
          createdAt: sale.createdAt
        }
      });
    } catch (error) {
      console.error("Error adding customer note:", error);
      res.status(500).json({ error: "Failed to add customer note" });
    }
  });

  // Sales (with items for returns page)
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getSalesWithItems();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/unpaid", async (_req, res) => {
    try {
      const sales = await storage.getUnpaidSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching unpaid sales:", error);
      res.status(500).json({ error: "Failed to fetch unpaid sales" });
    }
  });

  // Get all sales for a customer (paid + unpaid)
  app.get("/api/sales/customer/:phone", async (req, res) => {
    try {
      const sales = await storage.getSalesByCustomerPhone(req.params.phone);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching customer sales:", error);
      res.status(500).json({ error: "Failed to fetch customer sales" });
    }
  });

  // Get all sales with items for a customer (for statement details)
  app.get("/api/sales/customer/:phone/with-items", async (req, res) => {
    try {
      const sales = await storage.getSalesByCustomerPhoneWithItems(req.params.phone);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching customer sales with items:", error);
      res.status(500).json({ error: "Failed to fetch customer sales with items" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        res.status(404).json({ error: "Sale not found" });
        return;
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  // Customer Suggestions - FIXED: Show ALL customers, not just top 10
  app.get("/api/customers/suggestions", async (_req, res) => {
    try {
      const sales = await storage.getSales();
      
      const customerMap = new Map();
      
      sales.forEach(sale => {
        if (!sale.customerPhone) return;
        
        const existing = customerMap.get(sale.customerPhone);
        if (!existing || new Date(sale.createdAt) > new Date(existing.lastSaleDate)) {
          customerMap.set(sale.customerPhone, {
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            lastSaleDate: sale.createdAt,
            totalSpent: (existing?.totalSpent || 0) + parseFloat(sale.totalAmount),
            transactionCount: (existing?.transactionCount || 0) + 1
          });
        } else {
          existing.totalSpent += parseFloat(sale.totalAmount);
          existing.transactionCount += 1;
        }
      });
      
      // FIXED: Remove the .slice(0, 10) to show ALL customers
      const suggestions = Array.from(customerMap.values())
        .sort((a, b) => new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime());
      
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching customer suggestions:", error);
      res.status(500).json({ error: "Failed to fetch customer suggestions" });
    }
  });

  app.post("/api/sales", requirePerm('sales:edit'), async (req, res) => {
    try {
      const { items, ...saleData } = req.body;

      console.log("Creating sale - request body:", JSON.stringify(req.body, null, 2));

      const validatedSale = insertSaleSchema.parse(saleData);
      const validatedItems = z.array(insertSaleItemSchema).parse(items);

      const sale = await storage.createSale(validatedSale, validatedItems);
      
      console.log("Sale created successfully:", JSON.stringify(sale, null, 2));
      
      res.json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating sale:", error.errors);
        res.status(400).json({ error: "Invalid sale data", details: error.errors });
      } else {
        console.error("Error creating sale:", error);
        res.status(500).json({ error: "Failed to create sale" });
      }
    }
  });

  app.post("/api/sales/:id/payment", requirePerm('payment:edit'), async (req, res) => {
    try {
      const { amount, paymentMethod, notes } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "Invalid payment amount" });
        return;
      }
      const sale = await storage.updateSalePayment(req.params.id, amount, paymentMethod, notes);
      res.json(sale);
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  app.post("/api/sales/:id/items", requirePerm('sales:edit'), async (req, res) => {
    try {
      const validated = insertSaleItemSchema.parse(req.body);
      const saleItem = await storage.addSaleItem(req.params.id, validated);
      res.json(saleItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid sale item data", details: error.errors });
      } else {
        console.error("Error adding sale item:", error);
        res.status(500).json({ error: "Failed to add sale item" });
      }
    }
  });

  // UPDATE SALE ITEM ENDPOINT
  app.patch("/api/sale-items/:id", requirePerm('sales:edit'), async (req, res) => {
    try {
      const { quantity, rate, subtotal } = req.body;
      
      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Invalid quantity" });
        return;
      }
      
      if (typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ error: "Invalid rate" });
        return;
      }

      const saleItem = await storage.updateSaleItem(req.params.id, {
        quantity,
        rate,
        subtotal: rate * quantity
      });
      
      res.json(saleItem);
    } catch (error) {
      console.error("Error updating sale item:", error);
      res.status(500).json({ error: "Failed to update sale item" });
    }
  });

  app.delete("/api/sale-items/:id", requirePerm('sales:delete'), async (req, res) => {
    try {
      await storage.deleteSaleItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale item:", error);
      res.status(500).json({ error: "Failed to delete sale item" });
    }
  });

  // Create manual pending balance (no items, just a balance record)
  app.post("/api/sales/manual-balance", requirePerm('sales:edit'), async (req, res) => {
    try {
      const { customerName, customerPhone, totalAmount, dueDate, notes } = req.body;
      
      if (!customerName || !customerPhone || !totalAmount) {
        res.status(400).json({ error: "Customer name, phone, and amount are required" });
        return;
      }
      
      if (parseFloat(totalAmount) <= 0) {
        res.status(400).json({ error: "Amount must be greater than 0" });
        return;
      }
      
      const sale = await storage.createManualBalance({
        customerName,
        customerPhone,
        totalAmount: totalAmount.toString(),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes
      });
      
      res.json(sale);
    } catch (error) {
      console.error("Error creating manual balance:", error);
      res.status(500).json({ error: "Failed to create manual balance" });
    }
  });

  // Update due date for a sale
  app.patch("/api/sales/:id/due-date", requirePerm('sales:edit'), async (req, res) => {
    try {
      const { dueDate, notes } = req.body;
      
      const sale = await storage.updateSaleDueDate(req.params.id, {
        dueDate: dueDate ? new Date(dueDate) : null,
        notes
      });
      
      res.json(sale);
    } catch (error) {
      console.error("Error updating due date:", error);
      res.status(500).json({ error: "Failed to update due date" });
    }
  });

  // Delete entire sale
  app.delete("/api/sales/:id", requirePerm('sales:delete'), async (req, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.json({ success: true, message: "Sale deleted successfully" });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard-stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Database Export/Import
  app.get("/api/database/export", async (_req, res) => {
    try {
      const { getDatabasePath } = await import("./db");
      const fs = await import("fs/promises");
      const path = await import("path");
      
      const dbPath = getDatabasePath();
      const fileName = `paintpulse-backup-${new Date().toISOString().split('T')[0]}.db`;
      
      // Check if database file exists
      const stats = await fs.stat(dbPath);
      if (!stats.isFile()) {
        throw new Error("Database file not found");
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', stats.size);
      
      // Stream the file
      const fileStream = (await import("fs")).createReadStream(dbPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  app.post("/api/database/import", async (req, res) => {
    try {
      const { getDatabasePath, setDatabasePath } = await import("./db");
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      
      // Get the uploaded file from request body (base64)
      const { fileData } = req.body;
      
      if (!fileData) {
        res.status(400).json({ error: "No file data provided" });
        return;
      }

      // Create temporary file
      const tempPath = path.join(os.tmpdir(), `paintpulse-import-${Date.now()}.db`);
      
      // Decode base64 and write to temp file
      const buffer = Buffer.from(fileData, 'base64');
      await fs.writeFile(tempPath, buffer);

      // Validate it's a SQLite database (basic check)
      const header = await fs.readFile(tempPath, { encoding: 'utf8', flag: 'r' });
      if (!header.startsWith('SQLite format 3')) {
        await fs.unlink(tempPath);
        res.status(400).json({ error: "Invalid database file format" });
        return;
      }

      // Backup current database
      const currentDbPath = getDatabasePath();
      const backupPath = `${currentDbPath}.backup-${Date.now()}`;
      
      try {
        await fs.copyFile(currentDbPath, backupPath);
      } catch (error) {
        console.log("No existing database to backup");
      }

      // Replace current database with uploaded one
      await fs.copyFile(tempPath, currentDbPath);
      await fs.unlink(tempPath);

      // Reinitialize database connection
      setDatabasePath(currentDbPath);

      res.json({ 
        success: true, 
        message: "Database imported successfully. Please refresh the page." 
      });
    } catch (error) {
      console.error("Error importing database:", error);
      res.status(500).json({ error: "Failed to import database" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("[API] Error getting settings:", error);
      res.status(200).json({ 
        id: 'default',
        storeName: 'PaintPulse',
        dateFormat: 'DD-MM-YYYY',
        cardBorderStyle: 'shadow',
        cardShadowSize: 'sm',
        cardButtonColor: 'gray-900',
        cardPriceColor: 'blue-600',
        showStockBadgeBorder: false,
        auditPinHash: null,
        auditPinSalt: null,
        permStockDelete: true,
        permStockEdit: true,
        permStockHistoryDelete: true,
        permSalesDelete: true,
        permSalesEdit: true,
        permPaymentEdit: true,
        permPaymentDelete: true,
        permDatabaseAccess: true,
        cloudDatabaseUrl: null,
        cloudSyncEnabled: false,
        lastSyncTime: null,
        updatedAt: new Date(),
      });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const updated = await storage.updateSettings(req.body);
      res.json(updated);
    } catch (error) {
      console.error("[API] Error updating settings:", error);
      res.status(500).json({ 
        error: "Failed to update settings",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Audit endpoints
  app.get("/api/audit/has-pin", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({ hasPin: !!settings.auditPinHash });
    } catch (error) {
      console.error("[API] Error checking PIN:", error);
      res.status(200).json({ hasPin: false });
    }
  });

  app.post("/api/audit/verify", async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ error: "PIN required" });
      }

      const settings = await storage.getSettings();
      // TODO: Implement PIN verification logic
      res.json({ verified: false });
    } catch (error) {
      console.error("[API] Error verifying PIN:", error);
      res.status(500).json({ error: "Failed to verify PIN" });
    }
  });

  // Returns
  app.get("/api/returns", async (req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      console.error("[API] Error fetching returns:", error);
      // Return empty array if table doesn't exist
      if (error instanceof Error && error.message.includes("no such table")) {
        res.json([]);
      } else {
        res.status(500).json({ 
          error: "Failed to fetch returns",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  app.get("/api/returns/:id", async (req, res) => {
    try {
      const returnRecord = await storage.getReturn(req.params.id);
      res.json(returnRecord);
    } catch (error) {
      console.error("[API] Error fetching return:", error);
      res.status(500).json({ 
        error: "Failed to fetch return",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/returns", requirePerm('sales:edit'), async (req, res) => {
    try {
      const result = await storage.createReturn(req.body.returnData, req.body.items);
      res.json(result);
    } catch (error) {
      console.error("[API] Error creating return:", error);
      res.status(500).json({ 
        error: "Failed to create return",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Audit
  app.get("/api/audit/has-pin", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({ hasPin: !!settings.auditPinHash });
    } catch (error) {
      console.error("[API] Error checking PIN:", error);
      res.status(200).json({ hasPin: false });
    }
  });

  // Verify audit PIN
  app.post("/api/audit/verify", async (req, res) => {
    try {
      const { pin } = req.body;
      
      if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
        res.status(400).json({ error: "PIN must be exactly 4 digits" });
        return;
      }

      const settings = await storage.getSettings();
      
      // If no PIN is set, default PIN is "0000"
      if (!settings.auditPinHash || !settings.auditPinSalt) {
        if (pin === "0000") {
          const token = crypto.randomBytes(24).toString('hex');
          auditTokens.set(token, { createdAt: Date.now() });
          res.json({ ok: true, isDefault: true, auditToken: token });
          return;
        } else {
          res.status(401).json({ error: "Invalid PIN", ok: false });
          return;
        }
      }

      const hashedInput = hashPin(pin, settings.auditPinSalt);
      if (hashedInput === settings.auditPinHash) {
        const token = crypto.randomBytes(24).toString('hex');
        auditTokens.set(token, { createdAt: Date.now() });
        res.json({ ok: true, isDefault: false, auditToken: token });
      } else {
        res.status(401).json({ error: "Invalid PIN", ok: false });
      }
    } catch (error) {
      console.error("Error verifying audit PIN:", error);
      res.status(500).json({ error: "Failed to verify audit PIN" });
    }
  });

  // Set or change audit PIN
  app.patch("/api/audit/pin", async (req, res) => {
    try {
      const { currentPin, newPin } = req.body;
      
      if (!newPin || typeof newPin !== 'string' || newPin.length !== 4) {
        res.status(400).json({ error: "New PIN must be 4 digits" });
        return;
      }

      const settings = await storage.getSettings();
      
      // Verify current PIN
      if (!settings.auditPinHash || !settings.auditPinSalt) {
        // No PIN set, current PIN must be "0000" (default)
        if (currentPin !== "0000") {
          res.status(401).json({ error: "Current PIN is incorrect" });
          return;
        }
      } else {
        // PIN is set, verify it
        if (!currentPin || typeof currentPin !== 'string' || currentPin.length !== 4) {
          res.status(400).json({ error: "Current PIN must be 4 digits" });
          return;
        }
        const hashedCurrent = hashPin(currentPin, settings.auditPinSalt);
        if (hashedCurrent !== settings.auditPinHash) {
          res.status(401).json({ error: "Current PIN is incorrect" });
          return;
        }
      }

      // Generate new salt and hash
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPin(newPin, newSalt);

      // Update settings
      await storage.updateSettings({
        auditPinSalt: newSalt,
        auditPinHash: newHash,
      });

      res.json({ success: true, message: "PIN changed successfully" });
    } catch (error) {
      console.error("Error changing audit PIN:", error);
      res.status(500).json({ error: "Failed to change audit PIN" });
    }
  });

  // Stock Out History for Audit (protected)
  app.get("/api/audit/stock-out", verifyAuditToken, async (_req, res) => {
    try {
      const stockOut = await storage.getStockOutHistory();
      res.json(stockOut);
    } catch (error) {
      console.error("Error fetching stock out history:", error);
      res.status(500).json({ error: "Failed to fetch stock out history" });
    }
  });

  // Unpaid Bills for Audit (protected)
  app.get("/api/audit/unpaid-bills", verifyAuditToken, async (_req, res) => {
    try {
      const unpaidSales = await storage.getUnpaidSales();
      res.json(unpaidSales);
    } catch (error) {
      console.error("Error fetching unpaid bills:", error);
      res.status(500).json({ error: "Failed to fetch unpaid bills" });
    }
  });

  // Payment History for Audit (protected)
  app.get("/api/audit/payments", verifyAuditToken, async (_req, res) => {
    try {
      const payments = await storage.getAllPaymentHistory();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // Returns for Audit (protected)
  app.get("/api/audit/returns", verifyAuditToken, async (_req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  // ============ CLOUD DATABASE SYNC ENDPOINTS ============
  
  // Test cloud database connection
  app.post("/api/cloud/test-connection", verifyAuditToken, async (req, res) => {
    try {
      const { connectionUrl } = req.body;
      if (!connectionUrl) {
        res.status(400).json({ error: "Connection URL is required" });
        return;
      }

      // Try to connect using @neondatabase/serverless
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(connectionUrl);
      
      // Test with a simple query
      await sql`SELECT 1 as test`;
      
      res.json({ ok: true, message: "Connection successful" });
    } catch (error: any) {
      console.error("Cloud connection test failed:", error);
      res.status(400).json({ 
        ok: false, 
        error: error.message || "Connection failed. Please check your connection URL." 
      });
    }
  });

  // Save cloud database settings
  app.post("/api/cloud/save-settings", verifyAuditToken, async (req, res) => {
    try {
      const { connectionUrl, syncEnabled } = req.body;
      
      await storage.updateSettings({
        cloudDatabaseUrl: connectionUrl || null,
        cloudSyncEnabled: syncEnabled ?? false,
      });
      
      res.json({ ok: true, message: "Cloud settings saved" });
    } catch (error: any) {
      console.error("Error saving cloud settings:", error);
      res.status(500).json({ error: "Failed to save cloud settings" });
    }
  });

  // Get cloud sync status
  app.get("/api/cloud/status", verifyAuditToken, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        hasConnection: !!settings.cloudDatabaseUrl,
        syncEnabled: settings.cloudSyncEnabled,
        lastSyncTime: settings.lastSyncTime,
      });
    } catch (error) {
      console.error("Error getting cloud status:", error);
      res.status(500).json({ error: "Failed to get cloud status" });
    }
  });

  // Export data to cloud PostgreSQL
  app.post("/api/cloud/export", verifyAuditToken, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings.cloudDatabaseUrl) {
        res.status(400).json({ error: "Cloud database not configured" });
        return;
      }

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(settings.cloudDatabaseUrl);

      // Create tables if they don't exist
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          product_name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS variants (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          packing_size TEXT NOT NULL,
          rate TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS colors (
          id TEXT PRIMARY KEY,
          variant_id TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
          color_name TEXT NOT NULL,
          color_code TEXT NOT NULL,
          stock_quantity INTEGER DEFAULT 0,
          rate_override TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          total_amount TEXT NOT NULL,
          amount_paid TEXT DEFAULT '0',
          payment_status TEXT DEFAULT 'unpaid',
          due_date TIMESTAMP,
          is_manual_balance BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          color_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          rate TEXT NOT NULL,
          subtotal TEXT NOT NULL
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS stock_in_history (
          id TEXT PRIMARY KEY,
          color_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          previous_stock INTEGER NOT NULL,
          new_stock INTEGER NOT NULL,
          stock_in_date TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS payment_history (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          amount TEXT NOT NULL,
          previous_balance TEXT NOT NULL,
          new_balance TEXT NOT NULL,
          payment_method TEXT DEFAULT 'cash',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS returns (
          id TEXT PRIMARY KEY,
          sale_id TEXT,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          return_type TEXT DEFAULT 'item',
          total_refund TEXT DEFAULT '0',
          reason TEXT,
          status TEXT DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS return_items (
          id TEXT PRIMARY KEY,
          return_id TEXT NOT NULL,
          color_id TEXT NOT NULL,
          sale_item_id TEXT,
          quantity INTEGER NOT NULL,
          rate TEXT NOT NULL,
          subtotal TEXT NOT NULL,
          stock_restored BOOLEAN DEFAULT TRUE
        )
      `;

      // Get all data from local storage
      const products = await storage.getProducts();
      const variants = await storage.getVariants();
      const colorsData = await storage.getColors();
      const sales = await storage.getSales();
      const saleItems = await storage.getSaleItems();
      const stockInHistory = await storage.getStockInHistory();
      const paymentHistory = await storage.getAllPaymentHistory();
      const returns = await storage.getReturns();
      const returnItems = await storage.getReturnItems();

      // Clear existing cloud data and insert new (using UPSERT pattern)
      let exportedCounts = {
        products: 0,
        variants: 0,
        colors: 0,
        sales: 0,
        saleItems: 0,
        stockInHistory: 0,
        paymentHistory: 0,
        returns: 0,
        returnItems: 0,
      };

      // Export products
      for (const p of products) {
        await sql`
          INSERT INTO products (id, company, product_name, created_at)
          VALUES (${p.id}, ${p.company}, ${p.productName}, ${p.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            company = EXCLUDED.company,
            product_name = EXCLUDED.product_name
        `;
        exportedCounts.products++;
      }

      // Export variants
      for (const v of variants) {
        await sql`
          INSERT INTO variants (id, product_id, packing_size, rate, created_at)
          VALUES (${v.id}, ${v.productId}, ${v.packingSize}, ${v.rate}, ${v.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            product_id = EXCLUDED.product_id,
            packing_size = EXCLUDED.packing_size,
            rate = EXCLUDED.rate
        `;
        exportedCounts.variants++;
      }

      // Export colors
      for (const c of colorsData) {
        await sql`
          INSERT INTO colors (id, variant_id, color_name, color_code, stock_quantity, rate_override, created_at)
          VALUES (${c.id}, ${c.variantId}, ${c.colorName}, ${c.colorCode}, ${c.stockQuantity}, ${c.rateOverride}, ${c.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            variant_id = EXCLUDED.variant_id,
            color_name = EXCLUDED.color_name,
            color_code = EXCLUDED.color_code,
            stock_quantity = EXCLUDED.stock_quantity,
            rate_override = EXCLUDED.rate_override
        `;
        exportedCounts.colors++;
      }

      // Export sales
      for (const s of sales) {
        await sql`
          INSERT INTO sales (id, customer_name, customer_phone, total_amount, amount_paid, payment_status, due_date, is_manual_balance, notes, created_at)
          VALUES (${s.id}, ${s.customerName}, ${s.customerPhone}, ${s.totalAmount}, ${s.amountPaid}, ${s.paymentStatus}, ${s.dueDate}, ${s.isManualBalance}, ${s.notes}, ${s.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            total_amount = EXCLUDED.total_amount,
            amount_paid = EXCLUDED.amount_paid,
            payment_status = EXCLUDED.payment_status,
            due_date = EXCLUDED.due_date,
            is_manual_balance = EXCLUDED.is_manual_balance,
            notes = EXCLUDED.notes
        `;
        exportedCounts.sales++;
      }

      // Export sale items
      for (const si of saleItems) {
        await sql`
          INSERT INTO sale_items (id, sale_id, color_id, quantity, rate, subtotal)
          VALUES (${si.id}, ${si.saleId}, ${si.colorId}, ${si.quantity}, ${si.rate}, ${si.subtotal})
          ON CONFLICT (id) DO UPDATE SET
            sale_id = EXCLUDED.sale_id,
            color_id = EXCLUDED.color_id,
            quantity = EXCLUDED.quantity,
            rate = EXCLUDED.rate,
            subtotal = EXCLUDED.subtotal
        `;
        exportedCounts.saleItems++;
      }

      // Export stock in history
      for (const sih of stockInHistory) {
        await sql`
          INSERT INTO stock_in_history (id, color_id, quantity, previous_stock, new_stock, stock_in_date, notes, created_at)
          VALUES (${sih.id}, ${sih.colorId}, ${sih.quantity}, ${sih.previousStock}, ${sih.newStock}, ${sih.stockInDate}, ${sih.notes}, ${sih.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            color_id = EXCLUDED.color_id,
            quantity = EXCLUDED.quantity,
            previous_stock = EXCLUDED.previous_stock,
            new_stock = EXCLUDED.new_stock,
            stock_in_date = EXCLUDED.stock_in_date,
            notes = EXCLUDED.notes
        `;
        exportedCounts.stockInHistory++;
      }

      // Export payment history
      for (const ph of paymentHistory) {
        await sql`
          INSERT INTO payment_history (id, sale_id, customer_phone, amount, previous_balance, new_balance, payment_method, notes, created_at)
          VALUES (${ph.id}, ${ph.saleId}, ${ph.customerPhone}, ${ph.amount}, ${ph.previousBalance}, ${ph.newBalance}, ${ph.paymentMethod}, ${ph.notes}, ${ph.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            sale_id = EXCLUDED.sale_id,
            customer_phone = EXCLUDED.customer_phone,
            amount = EXCLUDED.amount,
            previous_balance = EXCLUDED.previous_balance,
            new_balance = EXCLUDED.new_balance,
            payment_method = EXCLUDED.payment_method,
            notes = EXCLUDED.notes
        `;
        exportedCounts.paymentHistory++;
      }

      // Export returns
      for (const r of returns) {
        await sql`
          INSERT INTO returns (id, sale_id, customer_name, customer_phone, return_type, total_refund, reason, status, created_at)
          VALUES (${r.id}, ${r.saleId}, ${r.customerName}, ${r.customerPhone}, ${r.returnType}, ${r.totalRefund}, ${r.reason}, ${r.status}, ${r.createdAt})
          ON CONFLICT (id) DO UPDATE SET
            sale_id = EXCLUDED.sale_id,
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            return_type = EXCLUDED.return_type,
            total_refund = EXCLUDED.total_refund,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status
        `;
        exportedCounts.returns++;
      }

      // Export return items
      for (const ri of returnItems) {
        await sql`
          INSERT INTO return_items (id, return_id, color_id, sale_item_id, quantity, rate, subtotal, stock_restored)
          VALUES (${ri.id}, ${ri.returnId}, ${ri.colorId}, ${ri.saleItemId}, ${ri.quantity}, ${ri.rate}, ${ri.subtotal}, ${ri.stockRestored})
          ON CONFLICT (id) DO UPDATE SET
            return_id = EXCLUDED.return_id,
            color_id = EXCLUDED.color_id,
            sale_item_id = EXCLUDED.sale_item_id,
            quantity = EXCLUDED.quantity,
            rate = EXCLUDED.rate,
            subtotal = EXCLUDED.subtotal,
            stock_restored = EXCLUDED.stock_restored
        `;
        exportedCounts.returnItems++;
      }

      // Update last sync time
      await storage.updateSettings({ lastSyncTime: new Date() });

      res.json({ 
        ok: true, 
        message: "Export successful",
        counts: exportedCounts
      });
    } catch (error: any) {
      console.error("Cloud export failed:", error);
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  // Import data from cloud PostgreSQL
  app.post("/api/cloud/import", verifyAuditToken, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings.cloudDatabaseUrl) {
        res.status(400).json({ error: "Cloud database not configured" });
        return;
      }

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(settings.cloudDatabaseUrl);

      // Check if tables exist
      const tablesCheck = await sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'products'
      `;
      
      if (tablesCheck.length === 0) {
        res.status(400).json({ error: "No data found in cloud database. Please export first." });
        return;
      }

      // Fetch all data from cloud
      const cloudProducts = await sql`SELECT * FROM products ORDER BY created_at`;
      const cloudVariants = await sql`SELECT * FROM variants ORDER BY created_at`;
      const cloudColors = await sql`SELECT * FROM colors ORDER BY created_at`;
      const cloudSales = await sql`SELECT * FROM sales ORDER BY created_at`;
      const cloudSaleItems = await sql`SELECT * FROM sale_items`;
      const cloudStockInHistory = await sql`SELECT * FROM stock_in_history ORDER BY created_at`;
      const cloudPaymentHistory = await sql`SELECT * FROM payment_history ORDER BY created_at`;
      const cloudReturns = await sql`SELECT * FROM returns ORDER BY created_at`;
      const cloudReturnItems = await sql`SELECT * FROM return_items`;

      let importedCounts = {
        products: 0,
        variants: 0,
        colors: 0,
        sales: 0,
        saleItems: 0,
        stockInHistory: 0,
        paymentHistory: 0,
        returns: 0,
        returnItems: 0,
      };

      // Import products
      for (const p of cloudProducts) {
        await storage.upsertProduct({
          id: p.id,
          company: p.company,
          productName: p.product_name,
          createdAt: new Date(p.created_at),
        });
        importedCounts.products++;
      }

      // Import variants
      for (const v of cloudVariants) {
        await storage.upsertVariant({
          id: v.id,
          productId: v.product_id,
          packingSize: v.packing_size,
          rate: v.rate,
          createdAt: new Date(v.created_at),
        });
        importedCounts.variants++;
      }

      // Import colors
      for (const c of cloudColors) {
        await storage.upsertColor({
          id: c.id,
          variantId: c.variant_id,
          colorName: c.color_name,
          colorCode: c.color_code,
          stockQuantity: c.stock_quantity,
          rateOverride: c.rate_override,
          createdAt: new Date(c.created_at),
        });
        importedCounts.colors++;
      }

      // Import sales
      for (const s of cloudSales) {
        await storage.upsertSale({
          id: s.id,
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          totalAmount: s.total_amount,
          amountPaid: s.amount_paid,
          paymentStatus: s.payment_status,
          dueDate: s.due_date ? new Date(s.due_date) : null,
          isManualBalance: s.is_manual_balance,
          notes: s.notes,
          createdAt: new Date(s.created_at),
        });
        importedCounts.sales++;
      }

      // Import sale items
      for (const si of cloudSaleItems) {
        await storage.upsertSaleItem({
          id: si.id,
          saleId: si.sale_id,
          colorId: si.color_id,
          quantity: si.quantity,
          rate: si.rate,
          subtotal: si.subtotal,
        });
        importedCounts.saleItems++;
      }

      // Import stock in history
      for (const sih of cloudStockInHistory) {
        await storage.upsertStockInHistory({
          id: sih.id,
          colorId: sih.color_id,
          quantity: sih.quantity,
          previousStock: sih.previous_stock,
          newStock: sih.new_stock,
          stockInDate: sih.stock_in_date,
          notes: sih.notes,
          createdAt: new Date(sih.created_at),
        });
        importedCounts.stockInHistory++;
      }

      // Import payment history
      for (const ph of cloudPaymentHistory) {
        await storage.upsertPaymentHistory({
          id: ph.id,
          saleId: ph.sale_id,
          customerPhone: ph.customer_phone,
          amount: ph.amount,
          previousBalance: ph.previous_balance,
          newBalance: ph.new_balance,
          paymentMethod: ph.payment_method,
          notes: ph.notes,
          createdAt: new Date(ph.created_at),
        });
        importedCounts.paymentHistory++;
      }

      // Import returns
      for (const r of cloudReturns) {
        await storage.upsertReturn({
          id: r.id,
          saleId: r.sale_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          returnType: r.return_type,
          totalRefund: r.total_refund,
          reason: r.reason,
          status: r.status,
          createdAt: new Date(r.created_at),
        });
        importedCounts.returns++;
      }

      // Import return items
      for (const ri of cloudReturnItems) {
        await storage.upsertReturnItem({
          id: ri.id,
          returnId: ri.return_id,
          colorId: ri.color_id,
          saleItemId: ri.sale_item_id,
          quantity: ri.quantity,
          rate: ri.rate,
          subtotal: ri.subtotal,
          stockRestored: ri.stock_restored,
        });
        importedCounts.returnItems++;
      }

      // Update last sync time
      await storage.updateSettings({ lastSyncTime: new Date() });

      res.json({ 
        ok: true, 
        message: "Import successful",
        counts: importedCounts
      });
    } catch (error: any) {
      console.error("Cloud import failed:", error);
      res.status(500).json({ error: error.message || "Import failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate PDF content for stock history
function generateStockHistoryPDF(history: any[], filters: any): string {
  // Create a simple text-based PDF content
  let pdfContent = `Stock In History Report\n`;
  pdfContent += `Generated on: ${new Date().toLocaleDateString()}\n`;
  pdfContent += `Total Records: ${history.length}\n\n`;
  
  if (filters.startDate && filters.endDate) {
    pdfContent += `Date Range: ${filters.startDate} to ${filters.endDate}\n`;
  }
  if (filters.company && filters.company !== 'all') {
    pdfContent += `Company: ${filters.company}\n`;
  }
  if (filters.product && filters.product !== 'all') {
    pdfContent += `Product: ${filters.product}\n`;
  }
  
  pdfContent += `\n`;
  pdfContent += `Stock In Date | Date | Time | Company | Product | Size | Color Code | Color Name | Previous Stock | Quantity Added | New Stock | Notes\n`;
  pdfContent += `--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---\n`;
  
  history.forEach((record, index) => {
    const date = new Date(record.createdAt).toLocaleDateString();
    const time = new Date(record.createdAt).toLocaleTimeString();
    
    pdfContent += `${record.stockInDate} | ${date} | ${time} | ${record.color.variant.product.company} | ${record.color.variant.product.productName} | ${record.color.variant.packingSize} | ${record.color.colorCode} | ${record.color.colorName} | ${record.previousStock} | +${record.quantity} | ${record.newStock} | ${record.notes || '-'}\n`;
  });

  // Convert to base64 for PDF (simplified approach)
  const buffer = Buffer.from(pdfContent, 'utf-8');
  return buffer.toString('base64');
}