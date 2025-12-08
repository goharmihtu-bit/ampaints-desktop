# PaintPulse - Paint Store POS System

## Overview
PaintPulse is a professional Point of Sale (POS) and Inventory Management System designed for paint stores. It efficiently manages inventory, sales, customer records, and billing through an intuitive interface. The project aims to provide a robust, user-friendly web-based solution for paint store operations, adapted from an Electron desktop application while retaining all core functionalities. Key capabilities include comprehensive inventory tracking, efficient sales processing, flexible rate management, and robust unpaid bill tracking with PDF statement generation.

## User Preferences
None specified yet.

## System Architecture

### Technology Stack
- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Express.js, Node.js
- **Database**: SQLite (better-sqlite3)
- **ORM**: Drizzle ORM
- **UI Framework**: Radix UI, Tailwind CSS
- **State Management**: TanStack React Query

### Project Structure
- `client/`: Frontend React application.
- `server/`: Backend Express server with API routes and database logic.
- `shared/`: Code shared between client and server, including database schema.
- `migrations/`: Database migration scripts.

### Key Features
- **Inventory Management**: Tracks products, variants, colors, and stock levels with advanced filtering, multi-select, and bulk operations. Includes a unique ID system for duplicate handling.
  - **Stock Deficit Alert**: When adding stock, if a color has negative stock (deficit from prior sales), the system clearly shows: red "(Deficit)" badge on color selection, stock calculation preview (Previous + Adding = New Stock), and an amber warning explaining how the addition will cover or reduce the deficit.
- **POS Sales**: Streamlined transaction processing with real-time inventory updates, optimized color code matching, and enhanced product card displays.
- **Rate Management**: Manages product pricing and packing sizes, supporting per-color rate overrides.
- **Unpaid Bills & Customer Statements**: Tracks partial payments, due dates, manual balance additions (Manual Balance), and generates detailed PDF statements. Features a premium bank-style customer statement with transaction ledger, running balance, and various transaction type displays. Transaction History uses consolidated row display where each bill shows DEBIT (bill amount) and CREDIT (initial payment at POS) in the SAME row, so PAID bills immediately show Balance = 0. Recovery payments and returns appear as separate rows. 
  - **Consistent Balance Formula**: Both Unpaid Bills and Customer Statement use identical formula: `Outstanding = Total Bills - Payments - Return Credits`. Unpaid Bills page fetches returns data and aggregates return credits by customer phone to ensure accurate outstanding calculations that match Customer Statement exactly.
- **Returns Management**: Supports both full bill returns and individual item returns with automatic stock restoration. Tracks return reasons, refund amounts, and restock quantities. Returns are displayed on sale cards in the Sales page with orange "RETURNED" badges showing return count and total refund amount.
  - **Return Accounting**: All outstanding balance calculations properly subtract return credits using the formula: `Outstanding = Sales - Payments - ReturnCredits`. Full bill returns set sale.amountPaid to "0" and paymentStatus to "full_return". Item returns create separate return records with refund amounts that reduce outstanding balances.
- **Reporting**: Comprehensive financial reports with simplified Overview tab showing four summary cards (Total Bills, Collected, Unpaid, Refunds) for at-a-glance understanding. Detailed tabs for Bills, Payments, Returns, and Unpaid Bills with advanced filtering and sortable columns. Features a unified Transactions tab showing all bills (debits), payments (credits), and returns (credits) in a single timeline with clear type labels.
  - **Overview Tab Layout**: Simplified four-card summary at top (Total Bills, Collected, Unpaid, Refunds), prominent Cash in Hand card with breakdown (New Sales + Recovery - Refunds), and optional Collection Rate progress bar.
  - **Cash in Hand Calculation**: Uses TRUE CASH FLOW formula: `New Sales + Recovery - Refunds` where New Sales is initial payments on bills created in date range, Recovery is all payment_history entries in date range, avoiding double-counting.
  - **Pay Full Button**: Quick action in Customer Statement's Unpaid Bills and Scheduled Payments tabs to pre-fill full outstanding amount for fast payment recording.
- **Audit Reports**: Comprehensive PIN-protected audit section with sidebar navigation menu containing six sections: Stock Audit (IN/OUT/RETURN movements, current inventory), Sales Audit (all sales, payments, outstanding), Unpaid Bills (outstanding balances, due dates), Payment History (unified transaction view combining payments, returns, and manual balances with type badges), Returns (full bill and item returns), and Settings (PIN management, permissions, cloud sync, system info). Features secure 4-digit PIN verification with SHA-256 salted hash storage, session-based token authentication (24-byte random token, 1-hour TTL), downloadable branded PDF reports for each section, and comprehensive filtering options. Default PIN is "0000" with change prompt.
- **UI Customization**: Settings for store branding (name, logo), product card design (border style, shadow, button/price color), and badge appearance.
- **Thermal Receipt & Bill Print**: Customizable thermal receipt printing and professional PDF invoice generation with gradient branding and detailed line items.
- **WhatsApp PDF Sharing**: Direct PDF file sharing to WhatsApp using Web Share API on mobile devices, with text-based fallback for desktop browsers. Works for both invoices and customer statements. Electron desktop app uses native IPC handlers (`share-pdf-to-whatsapp`, `save-pdf-to-documents`) to save PDFs to `Documents/PaintPulse/Statements` folder, open WhatsApp Web with customer's phone number, and show saved file in Explorer for easy drag-and-drop attachment.
- **Shared Receipt Settings**: Centralized hook (`use-receipt-settings.ts`) for consistent store header information across customer statements and bill prints.
- **Navigation Refresh**: Clicking the same menu item refreshes page content, resetting local state and refetching data.
- **Database Management**: Web-based export/import functionality, performance-optimized SQLite with composite indexes, and an automatic schema migration system for backward compatibility.
- **Cloud Database Sync**: Smart multi-device data synchronization via cloud PostgreSQL (Neon/Supabase). Features include:
  - **Real-Time Sync**: Auto-syncs every 5 seconds (configurable 3-30 seconds) for near-instant cloud updates
  - **Delta Sync**: Only syncs changes since last sync for faster performance
  - **Batch Processing**: Processes 50 records at a time with parallel operations
  - **Offline Queue**: Queues changes when offline, syncs automatically when back online
  - **Auto-Retry**: 3 retry attempts with exponential backoff for failed operations
  - **Conflict Detection**: Tracks and reports sync conflicts for multi-user scenarios
  - **Live Status Display**: Shows last sync time and sync active status indicator
  - **Connection Status**: Automatic online/offline detection with sync on reconnect
  - All cloud operations protected by audit PIN verification. Enables installing software on multiple laptops with shared data access.
- **Activation System**: Uses a one-time activation code.
- **Desktop Application**: Features include a maximized (not fullscreen) windowed desktop mode with saved size and position, and solutions for Windows SmartScreen warnings.

### System Design Choices
- **Database**: Lightweight, file-based SQLite managed by Drizzle ORM.
- **Schema Management**: Automatic migration system for smooth upgrades and backward compatibility.
- **Performance**: Optimized SQLite queries with composite indexes. Smart database pagination system with configurable limits (DEFAULT_LIMIT: 100, MAX_LIMIT: 500) to prevent software hangs with large datasets. Background data loading with React.lazy + Suspense for instant navigation, useDeferredValue for deferred heavy processing, and sidebar hover prefetching to warm caches before navigation. 
  - **Frontend Optimizations**:
    - **Debounced Search**: All search inputs use 300ms debounce delay via shared `useDebounce` hook (`client/src/hooks/use-debounce.ts`) to prevent excessive filtering on every keystroke.
    - **Visible Row Limits**: All data tables use visible limits (50 initial rows, load 30 more at a time) with "Load More" buttons to prevent UI hangs with large datasets. Applied across:
      - Stock Management: Products, Variants, Colors, Stock In, Stock History, Stock Out tabs
      - Sales: Customer sales list with debounced search
      - Unpaid Bills: Customer consolidated view with debounced search
      - Returns: Return history table with debounced search
      - Reports: All Sales and Recovery Payments tabs with debounced search
      - Audit: Stock movements and Sales audit tables with debounced search
  - **Backend Optimizations**:
    - **Response Compression**: Gzip compression enabled via `compression` middleware for faster API response delivery over network.
    - **In-Memory Caching**: Frequently accessed endpoints cached with automatic invalidation (60-second TTL):
      - Products: `/api/products` cached, invalidated on create/update/delete
      - Variants: `/api/variants` cached, invalidated on create/update/delete
      - Colors: `/api/colors` cached, invalidated on create/update/delete/stock-in/returns
      - Settings: `/api/settings` cached, invalidated on update
    - **Cache Invalidation Strategy**: All modification operations (create, update, delete, stock-in, returns) automatically invalidate relevant caches to ensure data consistency.
    - **Combined API Endpoints**: Customer statement page uses single combined endpoint (`/api/customer/:phone/statement`) that fetches sales, payments, and returns data in parallel, reducing 3 API calls to 1 with response times of 6-66ms.
- **Pagination API**: Paginated endpoints for Sales (`/api/sales/paginated`), Unpaid Sales (`/api/sales/unpaid/paginated`), Stock History (`/api/stock-in/history/paginated`), and Payment History (`/api/payment-history/paginated`). Each returns data with pagination metadata (page, limit, total, totalPages, hasMore).
- **UI/UX**: Clean, responsive interface using Radix UI and Tailwind CSS, with intuitive product card designs and a bank-style customer statement. Glassmorphism theme with blue accent icons and neutral color scheme.
- **Error Handling**: Enhanced logging and debugging for troubleshooting.

## External Dependencies
- **better-sqlite3**: SQLite database driver for Node.js.
- **Drizzle ORM**: TypeScript ORM for SQLite.
- **TanStack React Query**: Data fetching and state management for React.
- **Radix UI**: Unstyled, accessible UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Frontend tooling.
- **Express.js**: Web application framework for Node.js.