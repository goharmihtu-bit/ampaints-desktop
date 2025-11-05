# PaintPulse Desktop Application Build Instructions

## Prerequisites

Before building the desktop .exe application, ensure you have:

1. **Node.js** (v18 or higher)
2. **npm** package manager
3. **Windows Build Tools** (for building native modules)

## Build Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Application Icon - ✅ ADDED

**Status**: ✅ **COMPLETED** - Icon file is ready!

- **File name**: `icon.ico`
- **Location**: `build/icon.ico`
- **Format**: Windows ICO format (multi-resolution)
- **Size**: 128KB
- **Resolutions**: 256x256, 128x128, 64x64, 48x48, 32x32, 16x16

The A.M.P Paint Store logo has been successfully converted and placed in the correct location. You can proceed with the build!

### 3. Build Frontend (Vite)

```bash
npm run build
```

This command will:
- Build the React frontend using Vite
- Output files to `dist/public` directory

### 4. Build Electron Application

```bash
npm run build:electron
```

This command will:
- Compile Electron main process (`electron/main.ts` → `dist-electron/main.cjs`)
- Compile Electron preload script (`electron/preload.ts` → `dist-electron/preload.cjs`)
- Build production server (`server/index.production.ts` → `dist/index.js`)

### 5. Package Windows .exe

```bash
npm run package:win
```

This will create the Windows installer in the `release` folder:
- **Output**: `release/PaintPulse-Setup-0.1.7.exe`

## Build Configuration Files

### electron-builder.yml
Configuration for Electron Builder with the following settings:
- **App ID**: com.ampaints.paintpulse
- **Product Name**: PaintPulse
- **Target**: Windows NSIS installer (64-bit)
- **Compression**: Maximum
- **ASAR**: Enabled for better packaging

### package.json Scripts
- `build` - Build frontend and web server
- `build:electron` - Build Electron-specific files
- `package:win` - Create Windows installer

## Important Notes

### Database Location
The desktop application stores the database in:
```
C:\Users\[YourUsername]\Documents\PaintPulse\paintpulse.db
```

Users can change this location from within the application settings.

### Activation Code
The application requires a one-time activation code:
```
3620192373285
```

This is hardcoded in the application for the initial release.

### Production Server
The Electron app uses `server/index.production.ts` which:
- Serves static files from `dist/public`
- Does NOT use Vite (production mode only)
- Runs Express server on port 5000
- Uses SQLite database (better-sqlite3)

### Native Modules
The following native modules are included:
- **better-sqlite3** - SQLite database
- **electron-store** - Settings persistence

These will be automatically rebuilt for Electron during packaging.

## Troubleshooting

### Build Errors

1. **Missing icon.ico**
   - Ensure `build/icon.ico` exists before packaging
   - Use a proper Windows ICO format file

2. **Native module errors**
   - Run `npm rebuild better-sqlite3 --runtime=electron --target=XX.X.X`
   - Replace XX.X.X with your Electron version (currently 38.4.0)

3. **Path resolution errors**
   - Ensure all builds complete successfully before packaging
   - Check that `dist` and `dist-electron` folders exist

### Testing Before Packaging

You can test the Electron app in development mode:

```bash
# Terminal 1: Build and start the server
npm run build
npm start

# Terminal 2: Start Electron (in development)
electron .
```

## Distribution

After successful build:
1. Find the installer in `release/` folder
2. Test installation on a clean Windows machine
3. The installer will:
   - Install the application to Program Files
   - Create desktop and start menu shortcuts
   - Set up uninstaller

## Version Management

Current version: **0.1.7**

To update version:
1. Edit `package.json` → `version` field
2. Rebuild and repackage

---

**Built with:** React + Vite + Express + Electron + SQLite
**Target:** Windows x64
**License:** MIT
