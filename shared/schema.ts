// schema.ts
import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Helper function to generate UUIDs (used in SQLite as default)
// This will be replaced by actual UUID generation in the storage layer
const sqliteUuidDefault = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;

// Products table - stores company and product names
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  company: text("company").notNull(),
  productName: text("product_name").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Variants table - stores packing sizes and rates for each product
export const variants = sqliteTable("variants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  packingSize: text("packing_size").notNull(), // e.g., 1L, 4L, 16L
  rate: text("rate").notNull(), // stored as text to preserve decimal precision
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Colors table - stores color codes and inventory for each variant
export const colors = sqliteTable("colors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  variantId: text("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  colorName: text("color_name").notNull(), // e.g., "Sky Blue", "Sunset Red"
  colorCode: text("color_code").notNull(), // e.g., RAL1015, RAL5002
  stockQuantity: integer("stock_quantity").notNull().default(0),
  rateOverride: text("rate_override"), // optional per-color rate override (stored as text to preserve decimal precision)
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Sales table - stores transaction records
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  totalAmount: text("total_amount").notNull(), // stored as text to preserve decimal precision
  amountPaid: text("amount_paid").notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, partial, paid
  dueDate: integer("due_date", { mode: 'timestamp' }), // payment due date (nullable for old records)
  isManualBalance: integer("is_manual_balance", { mode: 'boolean' }).notNull().default(false), // true if added manually (not from POS)
  notes: text("notes"), // optional notes for manual balances
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Sale Items table - stores individual items in each sale
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  colorId: text("color_id").notNull().references(() => colors.id),
  quantity: integer("quantity").notNull(),
  rate: text("rate").notNull(), // stored as text to preserve decimal precision
  subtotal: text("subtotal").notNull(), // stored as text to preserve decimal precision
});

// Stock In History table - tracks all stock additions
export const stockInHistory = sqliteTable("stock_in_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  colorId: text("color_id").notNull().references(() => colors.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  stockInDate: text("stock_in_date").notNull(), // Store as TEXT in DD-MM-YYYY format
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Payment History table - tracks all payment transactions
export const paymentHistory = sqliteTable("payment_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  customerPhone: text("customer_phone").notNull(),
  amount: text("amount").notNull(), // payment amount
  previousBalance: text("previous_balance").notNull(), // balance before payment
  newBalance: text("new_balance").notNull(), // balance after payment
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, card, bank_transfer
  notes: text("notes"), // optional payment notes
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Returns table - stores return transactions
export const returns = sqliteTable("returns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").references(() => sales.id, { onDelete: "set null" }), // Original sale (nullable for bill returns)
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  returnType: text("return_type").notNull().default("item"), // "bill" for full bill return, "item" for partial return
  totalRefund: text("total_refund").notNull().default("0"), // Total refund amount
  reason: text("reason"), // Optional reason for return
  status: text("status").notNull().default("completed"), // completed, pending
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Return Items table - stores individual returned items
export const returnItems = sqliteTable("return_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  returnId: text("return_id").notNull().references(() => returns.id, { onDelete: "cascade" }),
  colorId: text("color_id").notNull().references(() => colors.id),
  saleItemId: text("sale_item_id").references(() => saleItems.id, { onDelete: "set null" }), // Original sale item
  quantity: integer("quantity").notNull(),
  rate: text("rate").notNull(), // Rate at time of return
  subtotal: text("subtotal").notNull(), // Refund subtotal
  stockRestored: integer("stock_restored", { mode: 'boolean' }).notNull().default(true), // Whether stock was restored
});

// Settings table - stores app preferences (single row)
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  // Store Settings
  storeName: text("store_name").notNull().default("PaintPulse"),
  // Date Format Setting (DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD)
  dateFormat: text("date_format").notNull().default("DD-MM-YYYY"),
  // Card Design Settings
  cardBorderStyle: text("card_border_style").notNull().default("shadow"), // shadow, border, none
  cardShadowSize: text("card_shadow_size").notNull().default("sm"), // sm, md, lg
  cardButtonColor: text("card_button_color").notNull().default("gray-900"), // gray-900, blue-600, green-600, etc
  cardPriceColor: text("card_price_color").notNull().default("blue-600"), // blue-600, green-600, gray-900, etc
  showStockBadgeBorder: integer("show_stock_badge_border", { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  colors: many(colors),
}));

export const colorsRelations = relations(colors, ({ one, many }) => ({
  variant: one(variants, {
    fields: [colors.variantId],
    references: [variants.id],
  }),
  saleItems: many(saleItems),
  stockInHistory: many(stockInHistory),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  saleItems: many(saleItems),
  paymentHistory: many(paymentHistory),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  color: one(colors, {
    fields: [saleItems.colorId],
    references: [colors.id],
  }),
}));

export const stockInHistoryRelations = relations(stockInHistory, ({ one }) => ({
  color: one(colors, {
    fields: [stockInHistory.colorId],
    references: [colors.id],
  }),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  sale: one(sales, {
    fields: [paymentHistory.saleId],
    references: [sales.id],
  }),
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  sale: one(sales, {
    fields: [returns.saleId],
    references: [sales.id],
  }),
  returnItems: many(returnItems),
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  return: one(returns, {
    fields: [returnItems.returnId],
    references: [returns.id],
  }),
  color: one(colors, {
    fields: [returnItems.colorId],
    references: [colors.id],
  }),
  saleItem: one(saleItems, {
    fields: [returnItems.saleItemId],
    references: [saleItems.id],
  }),
}));

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertVariantSchema = createInsertSchema(variants).omit({
  id: true,
  createdAt: true,
}).extend({
  rate: z.string().or(z.number()),
});

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
  createdAt: true,
}).extend({
  stockQuantity: z.number().int().min(0),
  rateOverride: z.string().or(z.number()).optional().nullable(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
}).extend({
  totalAmount: z.string().or(z.number()),
  amountPaid: z.string().or(z.number()),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
  saleId: true,
}).extend({
  quantity: z.number().int().min(1),
  rate: z.string().or(z.number()),
  subtotal: z.string().or(z.number()),
});

export const insertStockInHistorySchema = createInsertSchema(stockInHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  stockInDate: z.string().min(1, "Stock in date is required"), // Changed to string only
});

export const insertPaymentHistorySchema = createInsertSchema(paymentHistory).omit({
  id: true,
  createdAt: true,
});

export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  createdAt: true,
}).extend({
  returnType: z.enum(["bill", "item"]),
  totalRefund: z.string().or(z.number()),
});

export const insertReturnItemSchema = createInsertSchema(returnItems).omit({
  id: true,
}).extend({
  quantity: z.number().int().min(1),
  rate: z.string().or(z.number()),
  subtotal: z.string().or(z.number()),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const updateSettingsSchema = insertSettingsSchema.partial();

// Select schemas
export const selectProductSchema = createSelectSchema(products);
export const selectVariantSchema = createSelectSchema(variants);
export const selectColorSchema = createSelectSchema(colors);
export const selectSaleSchema = createSelectSchema(sales);
export const selectSaleItemSchema = createSelectSchema(saleItems);
export const selectStockInHistorySchema = createSelectSchema(stockInHistory);
export const selectPaymentHistorySchema = createSelectSchema(paymentHistory);
export const selectReturnSchema = createSelectSchema(returns);
export const selectReturnItemSchema = createSelectSchema(returnItems);
export const selectSettingsSchema = createSelectSchema(settings);

// Types
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type Variant = typeof variants.$inferSelect;

export type InsertColor = z.infer<typeof insertColorSchema>;
export type Color = typeof colors.$inferSelect;

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;

export type InsertStockInHistory = z.infer<typeof insertStockInHistorySchema>;
export type StockInHistory = typeof stockInHistory.$inferSelect;

export type InsertPaymentHistory = z.infer<typeof insertPaymentHistorySchema>;
export type PaymentHistory = typeof paymentHistory.$inferSelect;

export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returns.$inferSelect;

export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type ReturnItem = typeof returnItems.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Extended types for queries with relations
export type VariantWithProduct = Variant & {
  product: Product;
};

export type ColorWithVariantAndProduct = Color & {
  variant: VariantWithProduct;
};

export type SaleWithItems = Sale & {
  saleItems: (SaleItem & {
    color: ColorWithVariantAndProduct;
  })[];
};

export type SaleItemWithDetails = SaleItem & {
  color: ColorWithVariantAndProduct;
};

export type StockInHistoryWithColor = StockInHistory & {
  color: ColorWithVariantAndProduct;
};

export type PaymentHistoryWithSale = PaymentHistory & {
  sale: Sale;
};

export type ReturnItemWithDetails = ReturnItem & {
  color: ColorWithVariantAndProduct;
};

export type ReturnWithItems = Return & {
  sale?: Sale | null;
  returnItems: ReturnItemWithDetails[];
};

// Helper function to compute effective rate for a color
// Returns rateOverride if set, otherwise falls back to variant rate
export function getEffectiveRate(color: ColorWithVariantAndProduct): string {
  return color.rateOverride ?? color.variant.rate;
}

// Helper function to format date to DD-MM-YYYY
export function formatDateToDDMMYYYY(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY to Date
export function parseDDMMYYYYToDate(dateString: string): Date {
  const [day, month, year] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to validate DD-MM-YYYY format
export function isValidDDMMYYYY(dateString: string): boolean {
  const pattern = /^\d{2}-\d{2}-\d{4}$/;
  if (!pattern.test(dateString)) return false;
  
  const [day, month, year] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  return date.getDate() === day && 
         date.getMonth() === month - 1 && 
         date.getFullYear() === year;
}