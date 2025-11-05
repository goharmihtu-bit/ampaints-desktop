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
- **Rate Management**: Tools for managing product pricing and packing sizes.
- **Unpaid Bills**: Robust system for tracking partial payments, including due dates, manual balance additions, and a PDF statement generation feature with detailed summaries.
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

## Recent Updates (November 5, 2025)

### Ultra-Professional Business Icon (11:56 PM - LATEST)
- ✅ Generated 3 ultra-professional, formal, modern business icons
- ✅ Modern SaaS Icon - ACTIVE (glass morphism, corporate blue, premium quality)
- ✅ Enterprise POS Icon (navy blue, professional business software)
- ✅ Professional Database Icon (tech branding, SaaS platform aesthetic)
- ✅ All converted to multi-size ICO format (256-16 pixels)
- ✅ Enterprise-grade design quality matching Fortune 500 standards
- ✅ Complete guide in PROFESSIONAL-ICON-UPDATE.md

### Professional Paint Icons (11:51 PM - Previous)
- ✅ Generated 3 professional paint-themed icons (Paint Store, Roller, Palette)
- ✅ Backed up as icon-paint-theme-backup.ico
- ✅ Guide in NEW-ICON-GUIDE.md

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