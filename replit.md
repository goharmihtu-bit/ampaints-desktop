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
- **POS Sales**: Streamlined transaction processing with real-time inventory updates, optimized color code matching, and enhanced product card displays.
- **Rate Management**: Manages product pricing and packing sizes, supporting per-color rate overrides.
- **Unpaid Bills & Customer Statements**: Tracks partial payments, due dates, manual balance additions (cash loans), and generates detailed PDF statements. Features a premium bank-style customer statement with transaction ledger, running balance, and various transaction type displays.
- **Returns Management**: Supports both full bill returns and individual item returns with automatic stock restoration. Tracks return reasons, refund amounts, and restock quantities.
- **Reporting**: Comprehensive financial reports with summary cards, detailed views (All Sales, Unpaid Bills, Recovery Payments), advanced filtering, and sortable columns.
- **UI Customization**: Settings for store branding (name, logo), product card design (border style, shadow, button/price color), and badge appearance.
- **Thermal Receipt & Bill Print**: Customizable thermal receipt printing and professional PDF invoice generation with gradient branding and detailed line items.
- **WhatsApp PDF Sharing**: Direct PDF file sharing to WhatsApp using Web Share API on mobile devices, with text-based fallback for desktop browsers. Works for both invoices and customer statements.
- **Shared Receipt Settings**: Centralized hook (`use-receipt-settings.ts`) for consistent store header information across customer statements and bill prints.
- **Navigation Refresh**: Clicking the same menu item refreshes page content, resetting local state and refetching data.
- **Database Management**: Web-based export/import functionality, performance-optimized SQLite with composite indexes, and an automatic schema migration system for backward compatibility.
- **Activation System**: Uses a one-time activation code.
- **Desktop Application**: Features include a maximized (not fullscreen) windowed desktop mode with saved size and position, and solutions for Windows SmartScreen warnings.

### System Design Choices
- **Database**: Lightweight, file-based SQLite managed by Drizzle ORM.
- **Schema Management**: Automatic migration system for smooth upgrades and backward compatibility.
- **Performance**: Optimized SQLite queries with composite indexes.
- **UI/UX**: Clean, responsive interface using Radix UI and Tailwind CSS, with intuitive product card designs and a bank-style customer statement.
- **Error Handling**: Enhanced logging and debugging for troubleshooting.

## External Dependencies
- **better-sqlite3**: SQLite database driver for Node.js.
- **Drizzle ORM**: TypeScript ORM for SQLite.
- **TanStack React Query**: Data fetching and state management for React.
- **Radix UI**: Unstyled, accessible UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Frontend tooling.
- **Express.js**: Web application framework for Node.js.