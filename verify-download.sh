#!/bin/bash

# PaintPulse ZIP Download Verification Script
# Run this after extracting ZIP to verify all files are present

echo "🔍 PaintPulse Download Verification"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
all_good=true

# Function to check if directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
    else
        echo -e "${RED}❌${NC} $1 - MISSING!"
        all_good=false
    fi
}

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
    else
        echo -e "${RED}❌${NC} $1 - MISSING!"
        all_good=false
    fi
}

# Check critical folders
echo "📁 Checking Critical Folders..."
echo "--------------------------------"
check_dir "client"
check_dir "server"
check_dir "electron"
check_dir "shared"
check_dir "build"
check_dir "migrations"
echo ""

# Check icon file specifically
echo "🎨 Checking Application Icon..."
echo "--------------------------------"
if [ -f "build/icon.ico" ]; then
    size=$(ls -lh build/icon.ico | awk '{print $5}')
    echo -e "${GREEN}✅${NC} build/icon.ico exists ($size)"
    if [ "$size" != "128K" ] && [ "$size" != "130K" ]; then
        echo -e "${YELLOW}⚠️${NC}  Expected size: 128KB, got: $size"
    fi
else
    echo -e "${RED}❌${NC} build/icon.ico - CRITICAL FILE MISSING!"
    all_good=false
fi
echo ""

# Check configuration files
echo "⚙️  Checking Configuration Files..."
echo "------------------------------------"
check_file "package.json"
check_file "package-lock.json"
check_file "tsconfig.json"
check_file "vite.config.ts"
check_file "tailwind.config.ts"
check_file "electron-builder.yml"
check_file "build-electron.js"
check_file "drizzle.config.ts"
echo ""

# Check source files count
echo "📊 Counting Source Files..."
echo "----------------------------"
client_files=$(find client/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l)
server_files=$(find server -name "*.ts" 2>/dev/null | wc -l)
electron_files=$(find electron -name "*.ts" 2>/dev/null | wc -l)

echo "Client TypeScript files: $client_files"
if [ "$client_files" -lt 60 ]; then
    echo -e "${YELLOW}⚠️${NC}  Expected 70+, got: $client_files"
    all_good=false
else
    echo -e "${GREEN}✅${NC} Client files count looks good"
fi

echo "Server TypeScript files: $server_files"
if [ "$server_files" -ne 7 ]; then
    echo -e "${YELLOW}⚠️${NC}  Expected 7, got: $server_files"
else
    echo -e "${GREEN}✅${NC} Server files count correct"
fi

echo "Electron TypeScript files: $electron_files"
if [ "$electron_files" -ne 2 ]; then
    echo -e "${YELLOW}⚠️${NC}  Expected 2, got: $electron_files"
else
    echo -e "${GREEN}✅${NC} Electron files count correct"
fi
echo ""

# Check for unwanted files/folders
echo "🧹 Checking for Unwanted Files..."
echo "----------------------------------"
unwanted_found=false

if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️${NC}  node_modules/ found (should not be in ZIP)"
    echo "   → Delete it and run 'npm install' to regenerate"
    unwanted_found=true
fi

if [ -d "dist" ]; then
    echo -e "${YELLOW}⚠️${NC}  dist/ found (build output, can be deleted)"
    unwanted_found=true
fi

if [ -d "dist-electron" ]; then
    echo -e "${YELLOW}⚠️${NC}  dist-electron/ found (build output, can be deleted)"
    unwanted_found=true
fi

if [ -f "paintpulse.db" ]; then
    echo -e "${YELLOW}⚠️${NC}  paintpulse.db found (can be deleted - will regenerate)"
    unwanted_found=true
fi

if [ "$unwanted_found" = false ]; then
    echo -e "${GREEN}✅${NC} No unwanted files found"
fi
echo ""

# Final summary
echo "=================================="
echo "📋 Verification Summary"
echo "=================================="
if [ "$all_good" = true ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Your download is complete and ready for building."
    echo ""
    echo "Next steps:"
    echo "1. npm install"
    echo "2. npm run build"
    echo "3. npm run build:electron"
    echo "4. npm run package:win"
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please review the errors above and:"
    echo "1. Download fresh ZIP from Replit"
    echo "2. Check ESSENTIAL-FILES-LIST.md for details"
    echo "3. Manually add missing files if needed"
fi
echo ""
