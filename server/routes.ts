import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertVariantSchema, insertColorSchema, insertSaleSchema, insertSaleItemSchema } from "@shared/schema";
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
      const { colorName, colorCode } = req.body;
      if (!colorName || !colorCode) {
        res.status(400).json({ error: "Color name and code are required" });
        return;
      }
      // Normalize color code (uppercase and trim)
      const normalizedCode = colorCode.trim().toUpperCase();
      const color = await storage.updateColor(req.params.id, { colorName: colorName.trim(), colorCode: normalizedCode });
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

  app.post("/api/colors/:id/stock-in", async (req, res) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Invalid quantity" });
        return;
      }
      const color = await storage.stockIn(req.params.id, quantity);
      res.json(color);
    } catch (error) {
      console.error("Error adding stock:", error);
      res.status(500).json({ error: "Failed to add stock" });
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

  // Sales
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getSales();
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

  // Customer Suggestions
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
            totalSpent: (existing?.totalSpent || 0) + parseFloat(sale.totalAmount)
          });
        } else {
          existing.totalSpent += parseFloat(sale.totalAmount);
        }
      });
      
      const suggestions = Array.from(customerMap.values())
        .sort((a, b) => new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime())
        .slice(0, 10);
      
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

      if (validatedSale.paymentStatus === "unpaid") {
        const existingUnpaidSale = await storage.findUnpaidSaleByPhone(validatedSale.customerPhone);
        
        if (existingUnpaidSale) {
          console.log("Found existing unpaid bill, adding items to it:", existingUnpaidSale.id);
          
          for (const item of validatedItems) {
            await storage.addSaleItem(existingUnpaidSale.id, item);
          }
          
          const updatedSale = await storage.getSale(existingUnpaidSale.id);
          console.log("Items added to existing unpaid bill successfully");
          
          res.json(updatedSale);
          return;
        }
      }

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
      const { amount } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "Invalid payment amount" });
        return;
      }
      const sale = await storage.updateSalePayment(req.params.id, amount);
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

  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const { customerName, customerPhone, notes, dueDate } = req.body;
      
      if (!customerName || !customerPhone) {
        res.status(400).json({ error: "Customer name and phone are required" });
        return;
      }

      const updateData: any = {
        customerName,
        customerPhone,
        notes: notes || null,
      };

      if (dueDate) {
        updateData.dueDate = new Date(dueDate);
      }

      const sale = await storage.updateSale(req.params.id, updateData);
      res.json(sale);
    } catch (error) {
      console.error("Error updating sale:", error);
      res.status(500).json({ error: "Failed to update sale" });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // UPDATE SALE ITEM ENDPOINT - ADD THIS
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

  // Update sale details
  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const { customerName, customerPhone, notes, dueDate } = req.body;
      
      const sale = await storage.updateSale(req.params.id, {
        customerName,
        customerPhone,
        notes,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });
      
      res.json(sale);
    } catch (error) {
      console.error("Error updating sale:", error);
      res.status(500).json({ error: "Failed to update sale" });
    }
  });

  // Delete sale
  app.delete("/api/sales/:id", async (req, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.json({ success: true });
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

  const httpServer = createServer(app);
  return httpServer;
}
