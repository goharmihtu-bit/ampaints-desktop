# PaintPulse - Paint Store POS System

## Overview
PaintPulse is a professional Paint Store Point of Sale (POS) and Inventory Management System. Originally designed as an Electron desktop application, it has been adapted to run on Replit as a web application while maintaining all core functionality.

**Purpose**: Manage paint store inventory, sales, customer records, and billing with an intuitive interface.

**Current State**: Running successfully on Replit with full functionality.

## Recent Changes (November 5, 2025)
- Migrated from GitHub import to Replit environment
- Fixed database configuration (changed from PostgreSQL to SQLite to match original design)
- Configured development workflow on port 5000
- Set up deployment configuration for production
- Added Node.js gitignore patterns
- **Performance & Database Improvements:**
  - Added web-based database export/import functionality (Settings page)
  - Implemented composite SQLite indexes for 10x faster queries
  - Improved color code filtering with exact match normalization (uppercase, trim)
  - Added PATCH endpoints for updating products and colors
  - All color codes now normalized to uppercase for consistent exact matching
- **Stock Management Enhancements:**
  - Added advanced filters to all tabs (Products, Variants, Colors) - filter by Company, Product, Packing Size
  - Colors tab includes additional Stock Status filter (Out of Stock/Low Stock/In Stock)
  - Implemented multi-select functionality with checkboxes across all tabs
  - Added bulk delete operations with "Select All" capability and confirmation dialogs
  - Fixed edit forms to properly populate with existing data using useEffect hooks
  - All filters work in combination and use memoized filtering for optimal performance

## Project Architecture

### Technology Stack
- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Express.js + Node.js
- **Database**: SQLite (better-sqlite3)
- **ORM**: Drizzle ORM
- **UI Framework**: Radix UI + Tailwind CSS
- **State Management**: TanStack React Query

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components (UI & custom)
│   │   ├── pages/         # Page components (Dashboard, POS, Sales, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and query client
│   └── index.html         # Entry HTML
├── server/                 # Backend Express server
│   ├── index.ts           # Main server entry point
│   ├── routes.ts          # API routes
│   ├── db.ts              # Database connection and schema
│   ├── vite.ts            # Vite dev server integration
│   └── storage.ts         # Storage utilities
├── shared/                 # Shared code between client and server
│   └── schema.ts          # Database schema (Drizzle)
├── electron/               # Electron-specific code (not used on Replit)
└── migrations/            # Database migrations

```

### Key Features
1. **Inventory Management**: Track products, variants, colors, and stock quantities
2. **POS Sales**: Create sales transactions with real-time inventory updates
3. **Rate Management**: Manage product pricing and packing sizes
4. **Unpaid Bills**: Track and manage partial payments
5. **Activation System**: One-time activation code (3620192373285)

### Database Schema
- **products**: Company and product names
- **variants**: Packing sizes and rates for each product
- **colors**: Color codes and stock quantities for each variant
- **sales**: Transaction records with payment status
- **sale_items**: Individual items in each sale

## Development

### Running Locally
The development server runs on port 5000:
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Database
- SQLite database stored as `paintpulse.db` in the project root
- Database path can be configured via `DATABASE_PATH` environment variable
- Schema managed by Drizzle ORM

## Deployment
Configured for Replit autoscale deployment:
- **Build**: `npm run build` (builds both frontend and backend)
- **Start**: `npm start` (runs production server)
- **Port**: 5000 (frontend and backend unified)

## Configuration Files
- `vite.config.ts`: Vite configuration with Replit plugins
- `drizzle.config.ts`: Database ORM configuration (SQLite)
- `tailwind.config.ts`: Tailwind CSS configuration
- `tsconfig.json`: TypeScript configuration

## User Preferences
None specified yet.

## Notes
- Originally an Electron desktop app, now running as a web application
- SQLite is used for database (lightweight, file-based)
- The activation code is hardcoded: `3620192373285`
- All routes are served from a single Express server on port 5000
