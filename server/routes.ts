// routes.ts - Complete Updated Version
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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

  app.post("/api/products", async (req, res) => {
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

  app.patch("/api/products/:id", async (req, res) => {
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

  app.delete("/api/products/:id", async (req, res) => {
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

  app.post("/api/variants", async (req, res) => {
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

  app.patch("/api/variants/:id", async (req, res) => {
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

  app.patch("/api/variants/:id/rate", async (req, res) => {
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

  app.delete("/api/variants/:id", async (req, res) => {
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

  app.post("/api/colors", async (req, res) => {
    try {
      const validated = insertColorSchema.parse(req.body);
      // Normalize color code (uppercase and trim)
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

  app.patch("/api/colors/:id", async (req, res) => {
    try {
      const { colorName, colorCode, stockQuantity } = req.body;
      if (!colorName || !colorCode || stockQuantity === undefined) {
        res.status(400).json({ error: "Color name, code, and stock quantity are required" });
        return;
      }
      // Normalize color code (uppercase and trim)
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

  app.patch("/api/colors/:id/stock", async (req, res) => {
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

  app.patch("/api/colors/:id/rate-override", async (req, res) => {
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
  app.post("/api/colors/:id/stock-in", async (req, res) => {
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

  app.delete("/api/colors/:id", async (req, res) => {
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
  app.delete("/api/stock-in/history/:id", async (req, res) => {
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
  app.patch("/api/stock-in/history/:id", async (req, res) => {
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
  app.patch("/api/payment-history/:id", async (req, res) => {
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
  app.delete("/api/payment-history/:id", async (req, res) => {
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

  app.post("/api/sales", async (req, res) => {
    try {
      const { items, ...saleData } = req.body;

      console.log("Creating sale - request body:", JSON.stringify(req.body, null, 2));

      const validatedSale = insertSaleSchema.parse(saleData);
      const validatedItems = z.array(insertSaleItemSchema).parse(items);

      // Always create a new sale - don't add to existing unpaid sale
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

  app.post("/api/sales/:id/payment", async (req, res) => {
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

  app.post("/api/sales/:id/items", async (req, res) => {
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
  app.patch("/api/sale-items/:id", async (req, res) => {
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

  app.delete("/api/sale-items/:id", async (req, res) => {
    try {
      await storage.deleteSaleItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale item:", error);
      res.status(500).json({ error: "Failed to delete sale item" });
    }
  });

  // Create manual pending balance (no items, just a balance record)
  app.post("/api/sales/manual-balance", async (req, res) => {
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
  app.patch("/api/sales/:id/due-date", async (req, res) => {
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
  app.get("/api/settings", async (_req, res) => {
    try {
      const settingsData = await storage.getSettings();
      res.json(settingsData);
    } catch (error) {
      console.error("Error getting settings:", error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const updated = await storage.updateSettings(req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Customer Balance Summary API
  app.get("/api/customer/:phone/balance-summary", async (req, res) => {
    try {
      const { phone } = req.params;
      const unpaidSales = await storage.getUnpaidSales();
      
      const customerBills = unpaidSales.filter(sale => sale.customerPhone === phone);
      
      if (customerBills.length === 0) {
        res.status(404).json({ error: "No unpaid bills found for this customer" });
        return;
      }
      
      const totalAmount = customerBills.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
      const totalPaid = customerBills.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
      const totalOutstanding = totalAmount - totalPaid;
      
      const oldestBill = customerBills.reduce((oldest, sale) => {
        return new Date(sale.createdAt) < new Date(oldest.createdAt) ? sale : oldest;
      });
      
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(oldestBill.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      const summary = {
        customerName: customerBills[0].customerName,
        customerPhone: phone,
        totalBills: customerBills.length,
        totalAmount,
        totalPaid,
        totalOutstanding,
        oldestBillDate: oldestBill.createdAt,
        daysOverdue,
        bills: customerBills
      };
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching customer balance summary:", error);
      res.status(500).json({ error: "Failed to fetch customer balance summary" });
    }
  });

  // Customer Statements API
  app.get("/api/customer/:phone/statement", async (req, res) => {
    try {
      const { phone } = req.params;
      const { format = 'html' } = req.query;
      
      const unpaidSales = await storage.getUnpaidSales();
      const paymentHistory = await storage.getPaymentHistoryByCustomer(phone);
      const allSales = await storage.getSales();
      
      const customerBills = unpaidSales.filter(sale => sale.customerPhone === phone);
      const customerNotes = allSales
        .filter(sale => sale.customerPhone === phone && sale.isManualBalance && sale.notes)
        .map(sale => ({
          id: sale.id,
          saleId: sale.id,
          note: sale.notes!,
          createdBy: "System",
          createdAt: sale.createdAt
        }));
      
      if (customerBills.length === 0) {
        res.status(404).json({ error: "No bills found for this customer" });
        return;
      }
      
      const totalAmount = customerBills.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
      const totalPaid = customerBills.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
      const totalOutstanding = totalAmount - totalPaid;
      
      const oldestBill = customerBills.reduce((oldest, sale) => {
        return new Date(sale.createdAt) < new Date(oldest.createdAt) ? sale : oldest;
      });
      
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(oldestBill.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      const statement = {
        customerName: customerBills[0].customerName,
        customerPhone: phone,
        totalBills: customerBills.length,
        totalAmount,
        totalPaid,
        totalOutstanding,
        oldestBillDate: oldestBill.createdAt,
        daysOverdue,
        bills: customerBills,
        paymentHistory,
        notes: customerNotes,
        generatedAt: new Date().toISOString()
      };
      
      if (format === 'pdf') {
        // Generate PDF statement (you can implement PDF generation here)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="statement-${phone}-${new Date().toISOString().split('T')[0]}.pdf"`);
        // For now, return JSON as we'll handle PDF generation in the frontend
        res.json(statement);
      } else {
        res.json(statement);
      }
    } catch (error) {
      console.error("Error generating customer statement:", error);
      res.status(500).json({ error: "Failed to generate customer statement" });
    }
  });

  // Returns API
  app.get("/api/returns", async (_req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  app.get("/api/returns/:id", async (req, res) => {
    try {
      const returnRecord = await storage.getReturn(req.params.id);
      if (!returnRecord) {
        res.status(404).json({ error: "Return not found" });
        return;
      }
      res.json(returnRecord);
    } catch (error) {
      console.error("Error fetching return:", error);
      res.status(500).json({ error: "Failed to fetch return" });
    }
  });

  app.post("/api/returns", async (req, res) => {
    try {
      const { returnData, items } = req.body;
      
      if (!returnData || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Return data and items are required" });
        return;
      }

      const validatedReturn = insertReturnSchema.parse(returnData);
      const validatedItems = items.map((item: any) => insertReturnItemSchema.parse(item));
      
      const returnRecord = await storage.createReturn(validatedReturn, validatedItems);
      res.json(returnRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid return data", details: error.errors });
      } else {
        console.error("Error creating return:", error);
        res.status(500).json({ error: "Failed to create return" });
      }
    }
  });

  app.get("/api/returns/customer/:phone", async (req, res) => {
    try {
      const returns = await storage.getReturnsByCustomerPhone(req.params.phone);
      res.json(returns);
    } catch (error) {
      console.error("Error fetching customer returns:", error);
      res.status(500).json({ error: "Failed to fetch customer returns" });
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