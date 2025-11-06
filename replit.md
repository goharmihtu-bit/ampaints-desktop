# PaintPulse - Paint Store POS System

## Overview
PaintPulse is a professional Paint Store Point of Sale (POS) and Inventory Management System. It efficiently manages paint store inventory, sales, customer records, and billing through an intuitive interface. Initially developed as an Electron desktop application, it has been successfully adapted to run as a web application on Replit, retaining all core functionalities. The project aims to provide a robust and easy-to-use solution for paint store operations.

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
- **Inventory Management**: Comprehensive tracking of products, variants, colors, and stock levels. Includes advanced filtering, multi-select, bulk operations, and a unique ID system for handling duplicates.
- **POS Sales**: Efficient sales transaction processing with real-time inventory updates, optimized color code matching, and redesigned product cards for better display.
- **Rate Management**: Tools for managing product pricing and packing sizes, including per-color rate override capability.
- **Unpaid Bills**: Robust system for tracking partial payments, including due dates, manual balance additions, and a PDF statement generation feature with detailed summaries.
- **UI Customization**: Comprehensive settings system for customizing store branding (name, logo initial), product card design (border style, shadow size, button color, price color), and badge appearance.
- **Thermal Receipt Improvements**: Customizable thermal receipt printing with configurable header/footer, font sizes, and margins.
- **Dashboard Enhancements**: Includes a "Top 20 High Purchaser Customers" section for sales insights.
- **Database Management**: Web-based export/import functionality and performance-optimized SQLite with composite indexes.
- **Activation System**: Uses a one-time activation code (`3620192373285`).

### System Design Choices
- **Database**: Utilizes SQLite for a lightweight, file-based database solution, managed by Drizzle ORM.
- **Schema Management**: Features an automatic schema migration system to ensure backward compatibility and smooth upgrades for imported databases.
- **Performance**: Extensive use of composite SQLite indexes and optimized search algorithms for fast query responses.
- **UI/UX**: Employs Radix UI and Tailwind CSS for a clean, responsive, and customizable interface. Product cards are designed for clarity and efficiency.
- **Error Handling**: Enhanced logging and debugging guides for easier troubleshooting, particularly for desktop application issues.

## External Dependencies
- **better-sqlite3**: SQLite database driver for Node.js.
- **Drizzle ORM**: TypeScript ORM for SQLite.
- **TanStack React Query**: Data fetching and state management library for React.
- **Radix UI**: Unstyled, accessible UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Frontend tooling for development and build.
- **Express.js**: Web application framework for Node.js.

## Recent Updates (November 6, 2025)

### Bill Management System (2:15 AM - LATEST)
- ✅ Added comprehensive bill editing and deletion capabilities
- ✅ Created three-dot menu on each bill in Unpaid Bills page
- ✅ Implemented Edit Bill dialog for updating customer info, notes, and due date
- ✅ Implemented Add Items dialog for adding products to existing bills
- ✅ Implemented Delete Bill dialog with confirmation and stock restoration
- ✅ Backend API endpoints: PATCH /api/sales/:id and DELETE /api/sales/:id
- ✅ Storage methods: updateSale() and deleteSale() with automatic stock restoration
- ✅ Delete bill returns all items' stock quantities to inventory automatically
- ✅ Add items uses same color selection UI as POS with search functionality
- ✅ Edit bill updates customer name, phone, notes, and due date
- ✅ All operations properly invalidate React Query caches for instant UI updates
- ✅ Zero LSP errors, all features tested and working correctly

### Windows SmartScreen Solution (9:00 AM)
- ✅ Resolved Windows SmartScreen "Unknown publisher" warning issue
- ✅ Enhanced electron-builder configuration in package.json
- ✅ Added proper app metadata (appId, productName, copyright, publisherName)
- ✅ Improved NSIS installer configuration (custom install directory, shortcuts)
- ✅ Created comprehensive installation guides:
  - WINDOWS-SMARTSCREEN-GUIDE.md (English) - Complete documentation
  - WINDOWS-SMARTSCREEN-GUIDE-URDU.md (Urdu) - Customer-friendly guide
  - INSTALL-README.txt - Bundled installer instructions
- ✅ Documented bypass process: "More info" → "Run anyway"
- ✅ Included code signing information for future implementation
- ✅ Added user support templates (email, WhatsApp, SMS)
- 📝 Note: Code signing requires $200-400/year certificate from CA (optional)

### Comprehensive System Verification (8:45 AM)
- ✅ Conducted full system review of all critical modules
- ✅ Verified all API endpoints working correctly
- ✅ Tested Dashboard Stats API (inventory, sales, unpaid bills)
- ✅ Tested Colors API (product data retrieval)
- ✅ Tested Settings API (UI customization persistence)
- ✅ Reviewed Stock Management: Stock operations, rate overrides
- ✅ Reviewed POS Sales: Cart operations, payment processing, negative stock handling
- ✅ Reviewed Unpaid Bills: Payment validation, overpayment prevention
- ✅ Reviewed Database Import/Export: SQLite validation, backup creation, migration
- ✅ Confirmed error handling in all storage operations
- ✅ Verified Settings System: Store name, card styling, all customizations working
- ✅ No LSP diagnostics or compilation errors found
- ✅ All critical systems operational and stable
- 📝 Design Note: POS intentionally allows sales with insufficient stock (shows warnings but doesn't block) - this is a common requirement for paint stores to handle future delivery scenarios

### UI Customization Settings System (1:24 AM)
- ✅ Created comprehensive settings system for UI customization
- ✅ Added settings database table with automatic migration
- ✅ Implemented backend API (GET/PATCH /api/settings) with validation
- ✅ Created "UI" tab in Settings page with customization controls
- ✅ Store Branding: Customizable store name (displays in sidebar)
- ✅ Card Border Style: Shadow (Modern), Border (Classic), or None (Minimal)
- ✅ Card Shadow Size: Small, Medium, or Large options
- ✅ Button Color: Black, Blue, Green, Purple, or Red "Add to Cart" button
- ✅ Price Color: Blue, Green, Purple, Black, or Orange price text
- ✅ Stock Badge Border: Toggle border visibility on stock badges
- ✅ ProductCard component now dynamically applies all settings
- ✅ Sidebar displays store name from settings with dynamic initial
- ✅ All settings persist in database and load automatically
- ✅ Architect review: PASS - complete end-to-end implementation

### POS Cards Border Removal (1:10 AM)
- ✅ Removed all extra borders from product cards for cleaner look
- ✅ Removed card outline borders - now using shadow-based design
- ✅ Removed internal border-t from stock/price section
- ✅ Removed colored borders from stock badges
- ✅ Cards now have subtle shadow with hover effect for modern appearance

### POS Add to Cart Button Styling (1:05 AM)
- ✅ Changed "Add to Cart" button color from blue to dark black (gray-900)
- ✅ Added shadow effect for better visual prominence
- ✅ Updated hover state to gray-800 for smooth interaction
- ✅ Button now stands out more clearly in product cards

### Fullscreen Desktop Mode (1:00 AM)
- ✅ Desktop application now launches in fullscreen mode by default
- ✅ Added `fullscreen: true` option to BrowserWindow configuration
- ✅ Added `setFullScreen(true)` on window ready-to-show event
- ✅ Users can press F11 or ESC to exit fullscreen if needed

### Per-Color Rate Override System (12:50 AM)
- ✅ Added `rateOverride` column to colors table (nullable TEXT for decimal precision)
- ✅ Implemented automatic migration for backward compatibility with existing databases
- ✅ Created API endpoint (PATCH /api/colors/:id/rate-override) for rate updates
- ✅ Added `getEffectiveRate()` helper function (rateOverride ?? variant.rate)
- ✅ Enhanced Quick Add wizard Step 3 with optional per-color rate input
- ✅ Updated Stock Management view dialog to show Default/Custom/Effective rates
- ✅ Updated Stock Management edit dialog to allow rate override modification
- ✅ Integrated effective rates throughout POS sales for accurate pricing
- ✅ Architect review: PASS - implementation is complete and functioning correctly

## Recent Updates (November 5, 2025)

### AMP Clean Teal Icon (12:14 AM)
- ✅ Generated clean minimalist teal icon with white "AMP" letters
- ✅ Rounded square (squircle) shape, solid teal background
- ✅ Ultra-clean flat design with modern geometric fonts
- ✅ High contrast white on teal for fresh, professional look
- ✅ 3 clean teal variations available (solid, subtle gradient, dark)
- ✅ Installed as build/icon.ico (153KB)
- ✅ Complete guide in AMP-STORE-ICON.md

### Database Import Migration System (11:43 PM)
- ✅ Created automatic schema migration system in server/migrations.ts
- ✅ Detects and adds missing columns in imported databases
- ✅ Ensures backward compatibility with old database backups
- ✅ Preserves all data while enabling new features
- ✅ Complete guides: DATABASE-IMPORT-FIX.md and DATABASE-IMPORT-GUIDE-URDU.md

### Enhanced Error Logging (11:20 PM)
- ✅ Added comprehensive console logging for database initialization
- ✅ Added detailed server startup logging
- ✅ Enhanced error messages with stack traces
- ✅ Complete guides: DESKTOP-APP-DEBUG-GUIDE.md and DESKTOP-500-ERROR-FIX.md