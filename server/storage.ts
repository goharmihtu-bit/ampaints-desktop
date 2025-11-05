import {
  products,
  variants,
  colors,
  sales,
  saleItems,
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
  type VariantWithProduct,
  type ColorWithVariantAndProduct,
  type SaleWithItems,
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
  updateVariantRate(id: string, rate: number): Promise<Variant>;
  deleteVariant(id: string): Promise<void>;

  // Colors
  getColors(): Promise<ColorWithVariantAndProduct[]>;
  getColor(id: string): Promise<Color | undefined>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(id: string, data: { colorName: string; colorCode: string }): Promise<Color>;
  updateColorStock(id: string, stockQuantity: number): Promise<Color>;
  stockIn(id: string, quantity: number): Promise<Color>;
  deleteColor(id: string): Promise<void>;

  // Sales
  getSales(): Promise<Sale[]>;
  getUnpaidSales(): Promise<Sale[]>;
  findUnpaidSaleByPhone(customerPhone: string): Promise<Sale | undefined>;
  getSale(id: string): Promise<SaleWithItems | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  createManualBalance(data: { customerName: string; customerPhone: string; totalAmount: string; dueDate: Date | null; notes?: string }): Promise<Sale>;
  updateSalePayment(saleId: string, amount: number): Promise<Sale>;
  updateSaleDueDate(saleId: string, data: { dueDate: Date | null; notes?: string }): Promise<Sale>;
  addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem>;
  updateSaleItem(id: string, data: { quantity: number; rate: number; subtotal: number }): Promise<SaleItem>;
  deleteSaleItem(saleItemId: string): Promise<void>;

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
}

export class DatabaseStorage implements IStorage {
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

  async updateVariantRate(id: string, rate: number): Promise<Variant> {
    await db
      .update(variants)
      .set({ rate: rate.toString() })
      .where(eq(variants.id, id));
    
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
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
      createdAt: new Date(),
    };
    await db.insert(colors).values(color);
    return color;
  }

  async updateColor(id: string, data: { colorName: string; colorCode: string }): Promise<Color> {
    await db
      .update(colors)
      .set({ colorName: data.colorName, colorCode: data.colorCode })
      .where(eq(colors.id, id));
    const updated = await this.getColor(id);
    if (!updated) throw new Error("Color not found after update");
    return updated;
  }

  async updateColorStock(id: string, stockQuantity: number): Promise<Color> {
    await db
      .update(colors)
      .set({ stockQuantity })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color;
  }

  async stockIn(id: string, quantity: number): Promise<Color> {
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} + ${quantity}`,
      })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color;
  }

  async deleteColor(id: string): Promise<void> {
    await db.delete(colors).where(eq(colors.id, id));
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getUnpaidSales(): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(sql`${sales.paymentStatus} != 'paid'`)
      .orderBy(desc(sales.createdAt));
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
    for (const item of items) {
      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId));
    }

    return sale;
  }

  async updateSalePayment(saleId: string, amount: number): Promise<Sale> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    if (!sale) {
      throw new Error("Sale not found");
    }

    const currentPaid = parseFloat(sale.amountPaid);
    const newPaid = currentPaid + amount;
    const total = parseFloat(sale.totalAmount);

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

  // UPDATE SALE ITEM METHOD - ADDED
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
}

export const storage = new DatabaseStorage();
