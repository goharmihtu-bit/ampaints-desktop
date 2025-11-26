// storage.ts
import {
  products,
  variants,
  colors,
  sales,
  saleItems,
  settings,
  stockInHistory,
  paymentHistory,
  returns,
  returnItems,
  type Product,
  type InsertProduct,
  type Variant,
  type InsertVariant,
  type Color,
  type InsertColor,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type Settings,
  type UpdateSettings,
  type VariantWithProduct,
  type ColorWithVariantAndProduct,
  type SaleWithItems,
  type StockInHistoryWithColor,
  type PaymentHistory,
  type InsertPaymentHistory,
  type PaymentHistoryWithSale,
  type Return,
  type InsertReturn,
  type ReturnItem,
  type InsertReturnItem,
  type ReturnWithItems,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, sql, and } from "drizzle-orm";

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: { company: string; productName: string }): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Variants
  getVariants(): Promise<VariantWithProduct[]>;
  getVariant(id: string): Promise<Variant | undefined>;
  createVariant(variant: InsertVariant): Promise<Variant>;
  updateVariant(id: string, data: { productId: string; packingSize: string; rate: number }): Promise<Variant>;
  updateVariantRate(id: string, rate: number): Promise<Variant>;
  deleteVariant(id: string): Promise<void>;

  // Colors
  getColors(): Promise<ColorWithVariantAndProduct[]>;
  getColor(id: string): Promise<Color | undefined>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(id: string, data: { colorName: string; colorCode: string; stockQuantity: number }): Promise<Color>;
  updateColorStock(id: string, stockQuantity: number): Promise<Color>;
  updateColorRateOverride(id: string, rateOverride: number | null): Promise<Color>;
  stockIn(id: string, quantity: number, notes?: string, stockInDate?: string): Promise<Color>;
  deleteColor(id: string): Promise<void>;

  // Sales
  getSales(): Promise<Sale[]>;
  getSalesWithItems(): Promise<SaleWithItems[]>;
  getUnpaidSales(): Promise<Sale[]>;
  getSalesByCustomerPhone(customerPhone: string): Promise<Sale[]>;
  getSalesByCustomerPhoneWithItems(customerPhone: string): Promise<SaleWithItems[]>;
  findUnpaidSaleByPhone(customerPhone: string): Promise<Sale | undefined>;
  getSale(id: string): Promise<SaleWithItems | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  createManualBalance(data: { customerName: string; customerPhone: string; totalAmount: string; dueDate: Date | null; notes?: string }): Promise<Sale>;
  updateSalePayment(saleId: string, amount: number, paymentMethod?: string, notes?: string): Promise<Sale>;
  updateSaleDueDate(saleId: string, data: { dueDate: Date | null; notes?: string }): Promise<Sale>;
  addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem>;
  updateSaleItem(id: string, data: { quantity: number; rate: number; subtotal: number }): Promise<SaleItem>;
  deleteSaleItem(saleItemId: string): Promise<void>;

  // Stock In History
  getStockInHistory(): Promise<StockInHistoryWithColor[]>;
  getFilteredStockInHistory(filters: {
    startDate?: Date;
    endDate?: Date;
    company?: string;
    product?: string;
    colorCode?: string;
    colorName?: string;
  }): Promise<StockInHistoryWithColor[]>;
  recordStockIn(colorId: string, quantity: number, previousStock: number, newStock: number, notes?: string, stockInDate?: string): Promise<StockInHistoryWithColor>;
  deleteStockInHistory(id: string): Promise<void>;
  updateStockInHistory(id: string, data: { quantity?: number; notes?: string; stockInDate?: string }): Promise<StockInHistoryWithColor>;

  // Payment History
  recordPaymentHistory(data: {
    saleId: string;
    customerPhone: string;
    amount: number;
    previousBalance: number;
    newBalance: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<PaymentHistory>;
  getPaymentHistoryByCustomer(customerPhone: string): Promise<PaymentHistoryWithSale[]>;
  getPaymentHistoryBySale(saleId: string): Promise<PaymentHistory[]>;
  getAllPaymentHistory(): Promise<PaymentHistoryWithSale[]>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    todaySales: { revenue: number; transactions: number };
    monthlySales: { revenue: number; transactions: number };
    inventory: { totalProducts: number; totalVariants: number; totalColors: number; lowStock: number; totalStockValue: number };
    unpaidBills: { count: number; totalAmount: number };
    recentSales: Sale[];
    monthlyChart: { date: string; revenue: number }[];
    topCustomers: Array<{ customerName: string; customerPhone: string; totalPurchases: number; transactionCount: number }>;
  }>;

  // Returns
  getReturns(): Promise<ReturnWithItems[]>;
  getReturn(id: string): Promise<ReturnWithItems | undefined>;
  createReturn(returnData: InsertReturn, items: InsertReturnItem[]): Promise<Return>;
  getReturnsByCustomerPhone(customerPhone: string): Promise<ReturnWithItems[]>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(data: UpdateSettings): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  // Helper method to format dates to DD-MM-YYYY
  private formatDateToDDMMYYYY(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Helper method to validate DD-MM-YYYY format
  private isValidDDMMYYYY(dateString: string): boolean {
    const pattern = /^\d{2}-\d{2}-\d{4}$/;
    if (!pattern.test(dateString)) return false;
    
    const [day, month, year] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getDate() === day && 
           date.getMonth() === month - 1 && 
           date.getFullYear() === year;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product: Product = {
      id: crypto.randomUUID(),
      ...insertProduct,
      createdAt: new Date(),
    };
    await db.insert(products).values(product);
    return product;
  }

  async updateProduct(id: string, data: { company: string; productName: string }): Promise<Product> {
    await db
      .update(products)
      .set({ company: data.company, productName: data.productName })
      .where(eq(products.id, id));
    const updated = await this.getProduct(id);
    if (!updated) throw new Error("Product not found after update");
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Variants
  async getVariants(): Promise<VariantWithProduct[]> {
    const result = await db.query.variants.findMany({
      with: {
        product: true,
      },
      orderBy: desc(variants.createdAt),
    });
    return result;
  }

  async getVariant(id: string): Promise<Variant | undefined> {
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
    return variant || undefined;
  }

  async createVariant(insertVariant: InsertVariant): Promise<Variant> {
    const variant: Variant = {
      id: crypto.randomUUID(),
      ...insertVariant,
      rate: typeof insertVariant.rate === 'number' ? insertVariant.rate.toString() : insertVariant.rate,
      createdAt: new Date(),
    };
    await db.insert(variants).values(variant);
    return variant;
  }

  async updateVariant(id: string, data: { productId: string; packingSize: string; rate: number }): Promise<Variant> {
    await db
      .update(variants)
      .set({ 
        productId: data.productId,
        packingSize: data.packingSize,
        rate: data.rate.toString()
      })
      .where(eq(variants.id, id));
    
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
    if (!variant) throw new Error("Variant not found after update");
    return variant;
  }

  async updateVariantRate(id: string, rate: number): Promise<Variant> {
    await db
      .update(variants)
      .set({ rate: rate.toString() })
      .where(eq(variants.id, id));
    
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
    if (!variant) throw new Error("Variant not found after update");
    return variant;
  }

  async deleteVariant(id: string): Promise<void> {
    await db.delete(variants).where(eq(variants.id, id));
  }

  // Colors
  async getColors(): Promise<ColorWithVariantAndProduct[]> {
    const result = await db.query.colors.findMany({
      with: {
        variant: {
          with: {
            product: true,
          },
        },
      },
      orderBy: desc(colors.createdAt),
    });
    return result;
  }

  async getColor(id: string): Promise<Color | undefined> {
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color || undefined;
  }

  async createColor(insertColor: InsertColor): Promise<Color> {
    const color: Color = {
      id: crypto.randomUUID(),
      ...insertColor,
      rateOverride: typeof insertColor.rateOverride === 'number' 
        ? insertColor.rateOverride.toString() 
        : insertColor.rateOverride || null,
      createdAt: new Date(),
    };
    await db.insert(colors).values(color);
    return color;
  }

  async updateColor(id: string, data: { colorName: string; colorCode: string; stockQuantity: number }): Promise<Color> {
    await db
      .update(colors)
      .set({ 
        colorName: data.colorName, 
        colorCode: data.colorCode,
        stockQuantity: data.stockQuantity
      })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found after update");
    return color;
  }

  async updateColorStock(id: string, stockQuantity: number): Promise<Color> {
    await db
      .update(colors)
      .set({ stockQuantity })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found after update");
    return color;
  }

  async updateColorRateOverride(id: string, rateOverride: number | null): Promise<Color> {
    await db
      .update(colors)
      .set({ rateOverride: rateOverride !== null ? rateOverride.toString() : null })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found after update");
    return color;
  }

  async stockIn(id: string, quantity: number, notes?: string, stockInDate?: string): Promise<Color> {
    try {
      console.log(`[Storage] Starting stock in for color ${id}, quantity: ${quantity}, date: ${stockInDate}`);
      
      // Get current stock
      const [currentColor] = await db.select().from(colors).where(eq(colors.id, id));
      if (!currentColor) {
        console.error(`[Storage] Color not found: ${id}`);
        throw new Error("Color not found");
      }
      
      const previousStock = currentColor.stockQuantity;
      const newStock = previousStock + quantity;

      console.log(`[Storage] Stock update: Previous: ${previousStock}, Adding: ${quantity}, New: ${newStock}`);

      // Update color stock
      await db
        .update(colors)
        .set({
          stockQuantity: newStock,
        })
        .where(eq(colors.id, id));

      // Record in history
      try {
        // Use provided stockInDate or current date
        const actualStockInDate = stockInDate && this.isValidDDMMYYYY(stockInDate) 
          ? stockInDate 
          : this.formatDateToDDMMYYYY(new Date());
        
        const historyRecord = {
          id: crypto.randomUUID(),
          colorId: id,
          quantity,
          previousStock,
          newStock,
          notes: notes || "Stock added via stock management",
          stockInDate: actualStockInDate,
          createdAt: new Date(),
        };

        console.log("[Storage] Recording stock history:", historyRecord);
        await db.insert(stockInHistory).values(historyRecord);
      } catch (historyError) {
        console.error("[Storage] Error recording history (non-fatal):", historyError);
        // Continue even if history recording fails
      }

      // Fetch and return updated color
      const [updatedColor] = await db.select().from(colors).where(eq(colors.id, id));
      if (!updatedColor) {
        console.error(`[Storage] Color not found after update: ${id}`);
        throw new Error("Color not found after stock update");
      }
      
      console.log(`[Storage] Stock in successful: ${updatedColor.colorName} - New stock: ${updatedColor.stockQuantity}`);
      return updatedColor;
    } catch (error) {
      console.error("[Storage] Error in stockIn:", error);
      throw new Error(`Failed to add stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteColor(id: string): Promise<void> {
    await db.delete(colors).where(eq(colors.id, id));
  }

  // Stock In History
  async getStockInHistory(): Promise<StockInHistoryWithColor[]> {
    try {
      console.log("[Storage] Fetching stock in history");
      
      const result = await db.query.stockInHistory.findMany({
        with: {
          color: {
            with: {
              variant: {
                with: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: desc(stockInHistory.createdAt),
      });
      
      console.log(`[Storage] Found ${result.length} history records`);
      return result;
    } catch (error) {
      console.error("[Storage] Error fetching stock in history:", error);
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes("no such table")) {
        console.log("[Storage] stock_in_history table doesn't exist yet");
        return [];
      }
      throw error;
    }
  }

  async getFilteredStockInHistory(filters: {
    startDate?: Date;
    endDate?: Date;
    company?: string;
    product?: string;
    colorCode?: string;
    colorName?: string;
  }): Promise<StockInHistoryWithColor[]> {
    try {
      console.log("[Storage] Fetching filtered stock in history:", filters);
      
      let query = db.query.stockInHistory.findMany({
        with: {
          color: {
            with: {
              variant: {
                with: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: desc(stockInHistory.createdAt),
      });

      // Apply filters
      const result = await query;
      
      let filtered = result;

      // Date filter
      if (filters.startDate && filters.endDate) {
        const start = filters.startDate.getTime();
        const end = filters.endDate.getTime();
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.createdAt).getTime();
          return recordDate >= start && recordDate <= end;
        });
      } else if (filters.startDate) {
        const start = filters.startDate.getTime();
        filtered = filtered.filter(record => new Date(record.createdAt).getTime() >= start);
      } else if (filters.endDate) {
        const end = filters.endDate.getTime();
        filtered = filtered.filter(record => new Date(record.createdAt).getTime() <= end);
      }

      // Company filter
      if (filters.company && filters.company !== 'all') {
        filtered = filtered.filter(record => 
          record.color.variant.product.company === filters.company
        );
      }

      // Product filter
      if (filters.product && filters.product !== 'all') {
        filtered = filtered.filter(record => 
          record.color.variant.product.productName === filters.product
        );
      }

      // Color code filter
      if (filters.colorCode) {
        filtered = filtered.filter(record => 
          record.color.colorCode.toLowerCase().includes(filters.colorCode!.toLowerCase())
        );
      }

      // Color name filter
      if (filters.colorName) {
        filtered = filtered.filter(record => 
          record.color.colorName.toLowerCase().includes(filters.colorName!.toLowerCase())
        );
      }

      console.log(`[Storage] Found ${filtered.length} filtered history records`);
      return filtered;
    } catch (error) {
      console.error("[Storage] Error fetching filtered stock in history:", error);
      return [];
    }
  }

  async recordStockIn(
    colorId: string, 
    quantity: number, 
    previousStock: number, 
    newStock: number, 
    notes?: string,
    stockInDate?: string
  ): Promise<StockInHistoryWithColor> {
    try {
      const actualStockInDate = stockInDate && this.isValidDDMMYYYY(stockInDate) 
        ? stockInDate 
        : this.formatDateToDDMMYYYY(new Date());
      
      const historyRecord = {
        id: crypto.randomUUID(),
        colorId,
        quantity,
        previousStock,
        newStock,
        notes: notes || null,
        stockInDate: actualStockInDate,
        createdAt: new Date(),
      };

      console.log("Recording stock in history:", historyRecord);

      await db.insert(stockInHistory).values(historyRecord);

      // Return the created record with color details
      const result = await db.query.stockInHistory.findFirst({
        where: eq(stockInHistory.id, historyRecord.id),
        with: {
          color: {
            with: {
              variant: {
                with: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!result) throw new Error("Failed to create stock in history record");
      return result;
    } catch (error) {
      console.error("Error recording stock in history:", error);
      throw error;
    }
  }

  async deleteStockInHistory(id: string): Promise<void> {
    try {
      await db.delete(stockInHistory).where(eq(stockInHistory.id, id));
      console.log(`[Storage] Deleted stock history record: ${id}`);
    } catch (error) {
      console.error("[Storage] Error deleting stock history:", error);
      throw new Error("Failed to delete stock history record");
    }
  }

  // FIXED: Update stock history with proper new stock calculation
  async updateStockInHistory(id: string, data: { quantity?: number; notes?: string; stockInDate?: string }): Promise<StockInHistoryWithColor> {
    try {
      // First get the current record to know the previous stock
      const currentRecord = await db.query.stockInHistory.findFirst({
        where: eq(stockInHistory.id, id),
      });

      if (!currentRecord) {
        throw new Error("Stock history record not found");
      }

      const updateData: any = {};
      
      if (data.quantity !== undefined) {
        // Calculate new stock based on previous stock and updated quantity
        const newQuantity = data.quantity;
        const newStock = currentRecord.previousStock + newQuantity;
        
        updateData.quantity = newQuantity;
        updateData.newStock = newStock;

        // Also update the current stock in the color table
        await db
          .update(colors)
          .set({
            stockQuantity: newStock,
          })
          .where(eq(colors.id, currentRecord.colorId));
      }
      
      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      if (data.stockInDate !== undefined) {
        // Validate the date format
        if (data.stockInDate && !this.isValidDDMMYYYY(data.stockInDate)) {
          throw new Error("Invalid date format. Please use DD-MM-YYYY format.");
        }
        updateData.stockInDate = data.stockInDate;
      }

      await db
        .update(stockInHistory)
        .set(updateData)
        .where(eq(stockInHistory.id, id));

      const result = await db.query.stockInHistory.findFirst({
        where: eq(stockInHistory.id, id),
        with: {
          color: {
            with: {
              variant: {
                with: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!result) throw new Error("Stock history record not found after update");
      return result;
    } catch (error) {
      console.error("[Storage] Error updating stock history:", error);
      throw new Error("Failed to update stock history record");
    }
  }

  // Payment History
  async recordPaymentHistory(data: {
    saleId: string;
    customerPhone: string;
    amount: number;
    previousBalance: number;
    newBalance: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<PaymentHistory> {
    const paymentRecord: PaymentHistory = {
      id: crypto.randomUUID(),
      saleId: data.saleId,
      customerPhone: data.customerPhone,
      amount: data.amount.toString(),
      previousBalance: data.previousBalance.toString(),
      newBalance: data.newBalance.toString(),
      paymentMethod: data.paymentMethod || "cash",
      notes: data.notes || null,
      createdAt: new Date(),
    };

    await db.insert(paymentHistory).values(paymentRecord);
    return paymentRecord;
  }

  async getPaymentHistoryByCustomer(customerPhone: string): Promise<PaymentHistoryWithSale[]> {
    const result = await db.query.paymentHistory.findMany({
      where: eq(paymentHistory.customerPhone, customerPhone),
      with: {
        sale: true,
      },
      orderBy: desc(paymentHistory.createdAt),
    });
    return result;
  }

  async getPaymentHistoryBySale(saleId: string): Promise<PaymentHistory[]> {
    return await db.select().from(paymentHistory).where(eq(paymentHistory.saleId, saleId)).orderBy(desc(paymentHistory.createdAt));
  }

  async updatePaymentHistory(id: string, data: {
    amount?: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<PaymentHistory | null> {
    const [existing] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id));
    if (!existing) {
      return null;
    }

    const updateData: any = {};
    if (data.amount !== undefined) {
      updateData.amount = data.amount.toString();
    }
    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    await db
      .update(paymentHistory)
      .set(updateData)
      .where(eq(paymentHistory.id, id));

    const [updated] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id));
    return updated;
  }

  async deletePaymentHistory(id: string): Promise<boolean> {
    const [existing] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id));
    if (!existing) {
      return false;
    }
    await db.delete(paymentHistory).where(eq(paymentHistory.id, id));
    return true;
  }

  async getAllPaymentHistory(): Promise<PaymentHistoryWithSale[]> {
    const result = await db.query.paymentHistory.findMany({
      with: {
        sale: true,
      },
      orderBy: desc(paymentHistory.createdAt),
    });
    return result;
  }

  // Helper method to get color with relations
  private async getColorWithRelations(id: string): Promise<ColorWithVariantAndProduct> {
    const result = await db.query.colors.findFirst({
      where: eq(colors.id, id),
      with: {
        variant: {
          with: {
            product: true,
          },
        },
      },
    });
    
    if (!result) {
      throw new Error(`Color with id ${id} not found`);
    }
    
    return result;
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSalesWithItems(): Promise<SaleWithItems[]> {
    const allSales = await db.query.sales.findMany({
      with: {
        saleItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [desc(sales.createdAt)],
    });
    return allSales;
  }

  async getUnpaidSales(): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(sql`${sales.paymentStatus} != 'paid'`)
      .orderBy(desc(sales.createdAt));
  }

  async getSalesByCustomerPhone(customerPhone: string): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.customerPhone, customerPhone))
      .orderBy(desc(sales.createdAt));
  }

  async getSalesByCustomerPhoneWithItems(customerPhone: string): Promise<SaleWithItems[]> {
    const customerSales = await db.query.sales.findMany({
      where: eq(sales.customerPhone, customerPhone),
      with: {
        saleItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [desc(sales.createdAt)],
    });
    return customerSales;
  }

  async findUnpaidSaleByPhone(customerPhone: string): Promise<Sale | undefined> {
    const [sale] = await db
      .select()
      .from(sales)
      .where(and(
        eq(sales.customerPhone, customerPhone),
        sql`${sales.paymentStatus} != 'paid'`
      ))
      .orderBy(desc(sales.createdAt))
      .limit(1);
    return sale;
  }

  async getSale(id: string): Promise<SaleWithItems | undefined> {
    const result = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: {
        saleItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return result;
  }

  async createSale(insertSale: InsertSale, items: InsertSaleItem[]): Promise<Sale> {
    const sale: Sale = {
      id: crypto.randomUUID(),
      ...insertSale,
      totalAmount: typeof insertSale.totalAmount === 'number' ? insertSale.totalAmount.toString() : insertSale.totalAmount,
      amountPaid: typeof insertSale.amountPaid === 'number' ? insertSale.amountPaid.toString() : insertSale.amountPaid,
      dueDate: null,
      isManualBalance: false,
      notes: null,
      createdAt: new Date(),
    };
    await db.insert(sales).values(sale);

    // Insert sale items
    const saleItemsToInsert = items.map((item) => ({
      id: crypto.randomUUID(),
      ...item,
      saleId: sale.id,
      rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
    }));
    await db.insert(saleItems).values(saleItemsToInsert);

    // Update stock quantities in colors table
    console.log(`[Storage] Updating stock for ${items.length} items...`);
    for (const item of items) {
      // Get current stock before update
      const [currentColor] = await db.select().from(colors).where(eq(colors.id, item.colorId));
      const previousStock = currentColor?.stockQuantity ?? 0;
      
      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId));
      
      // Log the stock change
      const [updatedColor] = await db.select().from(colors).where(eq(colors.id, item.colorId));
      console.log(`[Storage] Stock reduced: ${currentColor?.colorName || item.colorId} - Previous: ${previousStock}, Sold: ${item.quantity}, New: ${updatedColor?.stockQuantity}`);
    }

    return sale;
  }

  async updateSalePayment(saleId: string, amount: number, paymentMethod?: string, notes?: string): Promise<Sale> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    if (!sale) {
      throw new Error("Sale not found");
    }

    const currentPaid = parseFloat(sale.amountPaid);
    const newPaid = currentPaid + amount;
    const total = parseFloat(sale.totalAmount);
    const previousBalance = total - currentPaid;
    const newBalance = total - newPaid;

    let paymentStatus: string;
    if (newPaid >= total) {
      paymentStatus = "paid";
    } else if (newPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        amountPaid: newPaid.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));

    // Record payment history
    await this.recordPaymentHistory({
      saleId,
      customerPhone: sale.customerPhone,
      amount,
      previousBalance,
      newBalance,
      paymentMethod,
      notes,
    });

    const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId));
    return updatedSale;
  }

  async createManualBalance(data: { customerName: string; customerPhone: string; totalAmount: string; dueDate: Date | null; notes?: string }): Promise<Sale> {
    const sale: Sale = {
      id: crypto.randomUUID(),
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      totalAmount: data.totalAmount,
      amountPaid: "0",
      paymentStatus: "unpaid",
      dueDate: data.dueDate,
      isManualBalance: true,
      notes: data.notes || null,
      createdAt: new Date(),
    };
    await db.insert(sales).values(sale);
    return sale;
  }

  async updateSaleDueDate(saleId: string, data: { dueDate: Date | null; notes?: string }): Promise<Sale> {
    const updateData: any = {
      dueDate: data.dueDate,
    };
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    
    await db
      .update(sales)
      .set(updateData)
      .where(eq(sales.id, saleId));

    const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId));
    return updatedSale;
  }

  async addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem> {
    // Add the item to the sale
    const saleItem: SaleItem = {
      id: crypto.randomUUID(),
      ...item,
      saleId,
      rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
    };
    await db.insert(saleItems).values(saleItem);

    // Update stock for this color
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
      })
      .where(eq(colors.id, item.colorId));

    // Recalculate sale total
    const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const amountPaid = parseFloat(sale.amountPaid);

    let paymentStatus: string;
    if (amountPaid >= newTotal) {
      paymentStatus = "paid";
    } else if (amountPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        totalAmount: newTotal.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));

    return saleItem;
  }

  async updateSaleItem(id: string, data: { quantity: number; rate: number; subtotal: number }): Promise<SaleItem> {
    try {
      // Get the current item to check stock changes
      const [currentItem] = await db.select().from(saleItems).where(eq(saleItems.id, id));
      if (!currentItem) {
        throw new Error("Sale item not found");
      }

      // Calculate stock difference
      const stockDifference = currentItem.quantity - data.quantity;

      // Update the sale item
      const [updatedItem] = await db
        .update(saleItems)
        .set({
          quantity: data.quantity,
          rate: data.rate.toString(),
          subtotal: data.subtotal.toString()
        })
        .where(eq(saleItems.id, id))
        .returning();

      // Update stock quantity if quantity changed
      if (stockDifference !== 0) {
        await db
          .update(colors)
          .set({
            stockQuantity: sql`${colors.stockQuantity} + ${stockDifference}`,
          })
          .where(eq(colors.id, currentItem.colorId));
      }

      // Recalculate sale total
      const saleId = currentItem.saleId;
      const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
      const amountPaid = parseFloat(sale.amountPaid);

      let paymentStatus: string;
      if (amountPaid >= newTotal) {
        paymentStatus = "paid";
      } else if (amountPaid > 0) {
        paymentStatus = "partial";
      } else {
        paymentStatus = "unpaid";
      }

      await db
        .update(sales)
        .set({
          totalAmount: newTotal.toString(),
          paymentStatus,
        })
        .where(eq(sales.id, saleId));

      return updatedItem;
    } catch (error) {
      console.error("Error updating sale item:", error);
      throw new Error("Failed to update sale item");
    }
  }

  async deleteSaleItem(saleItemId: string): Promise<void> {
    // Get the item details before deleting
    const [item] = await db.select().from(saleItems).where(eq(saleItems.id, saleItemId));
    if (!item) {
      throw new Error("Sale item not found");
    }

    const saleId = item.saleId;

    // Return stock to inventory
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} + ${item.quantity}`,
      })
      .where(eq(colors.id, item.colorId));

    // Delete the item
    await db.delete(saleItems).where(eq(saleItems.id, saleItemId));

    // Recalculate sale total
    const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const amountPaid = parseFloat(sale.amountPaid);

    let paymentStatus: string;
    if (newTotal === 0) {
      paymentStatus = "paid";
    } else if (amountPaid >= newTotal) {
      paymentStatus = "paid";
    } else if (amountPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        totalAmount: newTotal.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));
  }

  // Dashboard Stats
  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Convert dates to Unix timestamps for SQLite
    const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000) * 1000;
    const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000) * 1000;

    // Today's sales
    const todaySalesData = await db
      .select({
        revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
        transactions: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(sql`${sales.createdAt} >= ${todayStartTimestamp}`);

    // Monthly sales
    const monthlySalesData = await db
      .select({
        revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
        transactions: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(sql`${sales.createdAt} >= ${monthStartTimestamp}`);

    // Inventory stats
    const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
    const totalVariants = await db.select({ count: sql<number>`COUNT(*)` }).from(variants);
    const totalColors = await db.select({ count: sql<number>`COUNT(*)` }).from(colors);
    const lowStockColors = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(colors)
      .where(sql`${colors.stockQuantity} < 10 AND ${colors.stockQuantity} > 0`);
    
    // Calculate total stock value (stockQuantity * rate for all colors)
    const totalStockValue = await db
      .select({
        value: sql<number>`COALESCE(SUM(${colors.stockQuantity} * CAST(${variants.rate} AS REAL)), 0)`,
      })
      .from(colors)
      .innerJoin(variants, eq(colors.variantId, variants.id));

    // Unpaid bills
    const unpaidData = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL)), 0)`,
      })
      .from(sales)
      .where(sql`${sales.paymentStatus} != 'paid'`);

    // Recent sales
    const recentSales = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.createdAt))
      .limit(10);

    // Monthly chart data (last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000) * 1000;

    const dailySales = await db
      .select({
        date: sql<string>`DATE(${sales.createdAt} / 1000, 'unixepoch')`,
        revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
      })
      .from(sales)
      .where(sql`${sales.createdAt} >= ${thirtyDaysAgoTimestamp}`)
      .groupBy(sql`DATE(${sales.createdAt} / 1000, 'unixepoch')`)
      .orderBy(sql`DATE(${sales.createdAt} / 1000, 'unixepoch')`);

    // Top 20 customers by total purchases (exclude null/empty phone numbers)
    const topCustomersData = await db
      .select({
        customerName: sql<string>`${sales.customerName}`,
        customerPhone: sql<string>`${sales.customerPhone}`,
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(sql`${sales.customerPhone} IS NOT NULL AND ${sales.customerPhone} != ''`)
      .groupBy(sales.customerPhone, sales.customerName)
      .orderBy(sql`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0) DESC`)
      .limit(20);

    return {
      todaySales: {
        revenue: Number(todaySalesData[0]?.revenue || 0),
        transactions: Number(todaySalesData[0]?.transactions || 0),
      },
      monthlySales: {
        revenue: Number(monthlySalesData[0]?.revenue || 0),
        transactions: Number(monthlySalesData[0]?.transactions || 0),
      },
      inventory: {
        totalProducts: Number(totalProducts[0]?.count || 0),
        totalVariants: Number(totalVariants[0]?.count || 0),
        totalColors: Number(totalColors[0]?.count || 0),
        lowStock: Number(lowStockColors[0]?.count || 0),
        totalStockValue: Number(totalStockValue[0]?.value || 0),
      },
      unpaidBills: {
        count: Number(unpaidData[0]?.count || 0),
        totalAmount: Number(unpaidData[0]?.totalAmount || 0),
      },
      recentSales,
      monthlyChart: dailySales.map((day) => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Number(day.revenue),
      })),
      topCustomers: topCustomersData.map((customer) => ({
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        totalPurchases: Number(customer.totalPurchases || 0),
        transactionCount: Number(customer.transactionCount || 0),
      })),
    };
  }

  // Returns
  async getReturns(): Promise<ReturnWithItems[]> {
    const result = await db.query.returns.findMany({
      with: {
        sale: true,
        returnItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: desc(returns.createdAt),
    });
    return result as ReturnWithItems[];
  }

  async getReturn(id: string): Promise<ReturnWithItems | undefined> {
    const result = await db.query.returns.findFirst({
      where: eq(returns.id, id),
      with: {
        sale: true,
        returnItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return result as ReturnWithItems | undefined;
  }

  async createReturn(returnData: InsertReturn, items: InsertReturnItem[]): Promise<Return> {
    const returnRecord: Return = {
      id: crypto.randomUUID(),
      saleId: returnData.saleId || null,
      customerName: returnData.customerName,
      customerPhone: returnData.customerPhone,
      returnType: returnData.returnType || "item",
      totalRefund: String(returnData.totalRefund || "0"),
      reason: returnData.reason || null,
      status: returnData.status || "completed",
      createdAt: new Date(),
    };

    await db.insert(returns).values(returnRecord);

    // Insert return items and restore stock
    for (const item of items) {
      const returnItem: ReturnItem = {
        id: crypto.randomUUID(),
        returnId: returnRecord.id,
        colorId: item.colorId,
        saleItemId: item.saleItemId || null,
        quantity: item.quantity,
        rate: String(item.rate),
        subtotal: String(item.subtotal),
        stockRestored: item.stockRestored !== false,
      };
      await db.insert(returnItems).values(returnItem);

      // Restore stock if stockRestored is true
      if (returnItem.stockRestored) {
        const [color] = await db.select().from(colors).where(eq(colors.id, item.colorId));
        if (color) {
          const newStock = color.stockQuantity + item.quantity;
          await db.update(colors).set({ stockQuantity: newStock }).where(eq(colors.id, item.colorId));
        }
      }
    }

    return returnRecord;
  }

  async getReturnsByCustomerPhone(customerPhone: string): Promise<ReturnWithItems[]> {
    const result = await db.query.returns.findMany({
      where: eq(returns.customerPhone, customerPhone),
      with: {
        sale: true,
        returnItems: {
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: desc(returns.createdAt),
    });
    return result as ReturnWithItems[];
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).where(eq(settings.id, 'default'));
    if (!setting) {
      // Create default settings if not found
      const defaultSettings: Settings = {
        id: 'default',
        storeName: 'PaintPulse',
        dateFormat: 'DD-MM-YYYY',
        cardBorderStyle: 'shadow',
        cardShadowSize: 'sm',
        cardButtonColor: 'gray-900',
        cardPriceColor: 'blue-600',
        showStockBadgeBorder: false,
        updatedAt: new Date(),
      };
      await db.insert(settings).values(defaultSettings);
      return defaultSettings;
    }
    return setting;
  }

  async updateSettings(data: UpdateSettings): Promise<Settings> {
    await db
      .update(settings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(settings.id, 'default'));
    
    const updated = await this.getSettings();
    return updated;
  }

  async getStockOutHistory(): Promise<any[]> {
    const result = await db.query.saleItems.findMany({
      with: {
        color: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
        sale: true,
      },
    });
    
    return result.map(item => ({
      id: item.id,
      saleId: item.saleId,
      colorId: item.colorId,
      quantity: item.quantity,
      rate: item.rate,
      subtotal: item.subtotal,
      color: item.color,
      sale: item.sale,
      soldAt: item.sale?.createdAt,
      customerName: item.sale?.customerName,
      customerPhone: item.sale?.customerPhone,
    })).sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
  }
}

export const storage = new DatabaseStorage();