# Desktop App 500 Error - Debugging Guide

## ❌ Problem
When running PaintPulse desktop app on Windows, these errors appear:
```
api/dashboard-stats: 500 Internal Server Error
api/customers/suggestions: 500 Internal Server Error
api/sales: 500 Internal Server Error
```

---

## 🔍 Root Cause Analysis

500 errors mean the server is running but API calls are failing. Possible causes:

### 1. Database Not Initializing
- Database file not created at correct path
- Permission issues with Documents folder
- SQLite connection failing

### 2. Server Module Import Failing
- Missing dependencies
- Path resolution issues
- better-sqlite3 not rebuilt correctly

### 3. Missing Data Directory
- PaintPulse folder not created in Documents
- Database file cannot be written

---

## ✅ SOLUTION 1: Check Database File

### Step 1: Locate Database File
The database should be at:
```
C:\Users\[YourUsername]\Documents\PaintPulse\paintpulse.db
```

### Step 2: Verify Folder Exists
Open File Explorer and check if:
```
C:\Users\[YourUsername]\Documents\PaintPulse\
```
Exists? If not, create it manually.

### Step 3: Check File Permissions
- Right-click on PaintPulse folder
- Properties → Security
- Make sure your user has "Full Control"

---

## ✅ SOLUTION 2: View Console Logs

### For Development Build:
1. Open app
2. Press `Ctrl + Shift + I` to open DevTools
3. Go to Console tab
4. Look for error messages

### For Production Build:
The app doesn't show DevTools by default. To enable logging:

**Option A: Run from Command Prompt**
```cmd
cd "C:\path\to\app\installation\folder"
PaintPulse.exe
```
Check the command prompt window for error logs.

**Option B: Check Event Viewer**
1. Press `Win + R`
2. Type `eventvwr.msc` and press Enter
3. Windows Logs → Application
4. Look for PaintPulse errors

---

## ✅ SOLUTION 3: Fresh Database Setup

If database is corrupted or missing:

### Step 1: Delete Old Database
```
1. Navigate to: C:\Users\[YourUsername]\Documents\PaintPulse\
2. Delete paintpulse.db (if exists)
3. Delete paintpulse.db-shm and paintpulse.db-wal (if exist)
```

### Step 2: Restart App
```
1. Close PaintPulse completely
2. Open PaintPulse again
3. Database will be created automatically
4. Enter activation code: 3620192373285
```

---

## ✅ SOLUTION 4: Reinstall Application

### Clean Uninstall:
```
1. Uninstall PaintPulse from Control Panel
2. Delete: C:\Users\[YourUsername]\AppData\Roaming\ampaints-paintpulse
3. Delete: C:\Users\[YourUsername]\Documents\PaintPulse
4. Restart computer
```

### Fresh Install:
```
1. Run PaintPulse-Setup-0.1.7.exe
2. Complete installation
3. Launch app
4. Enter activation code
5. Test features
```

---

## ✅ SOLUTION 5: Check Windows Defender/Antivirus

Sometimes Windows Defender blocks database operations:

### Step 1: Add Exclusion
```
1. Windows Security → Virus & threat protection
2. Manage settings → Add or remove exclusions
3. Add folder: C:\Users\[YourUsername]\Documents\PaintPulse
4. Add folder: C:\Program Files\PaintPulse (or installation path)
```

### Step 2: Allow App
```
1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Find PaintPulse and enable it
```

---

## ✅ SOLUTION 6: Run as Administrator

Sometimes permission issues cause 500 errors:

```
1. Right-click on PaintPulse shortcut
2. Select "Run as administrator"
3. Test if errors are gone
```

If this fixes it, make it permanent:
```
1. Right-click on PaintPulse shortcut
2. Properties → Compatibility
3. Check "Run this program as an administrator"
4. Apply → OK
```

---

## 🔧 TECHNICAL DEBUG (Advanced)

### Enable Console Logging in Production Build:

Edit the installed app's main process to enable DevTools:

**Location:**
```
C:\Users\[YourUsername]\AppData\Local\Programs\PaintPulse\resources\app.asar.unpacked\
```

**Note:** This requires unpacking the ASAR file. Better to rebuild with logging enabled.

---

## 📋 REBUILD WITH DEBUG LOGGING

If you have the source code, rebuild with enhanced logging:

### Step 1: Download Fresh ZIP from Replit

### Step 2: Modify electron/main.ts
Add this after line 95:
```typescript
// Always open DevTools for debugging
mainWindow.webContents.openDevTools();
```

### Step 3: Rebuild
```bash
npm install
npm run build
npm run build:electron
npm run package:win
```

### Step 4: Install New Build
```
1. Find: release\PaintPulse-Setup-0.1.7.exe
2. Uninstall old version
3. Install new version
4. DevTools will open automatically
5. Check Console for errors
```

---

## 🎯 MOST LIKELY FIX

Based on common issues, try these in order:

### ✅ Quick Fix (5 minutes):
```
1. Close PaintPulse
2. Delete: C:\Users\[YourUsername]\Documents\PaintPulse\paintpulse.db
3. Restart PaintPulse
4. Let it recreate database
5. Enter activation code
```

### ✅ Full Reset (10 minutes):
```
1. Uninstall PaintPulse
2. Delete AppData folder: C:\Users\[YourUsername]\AppData\Roaming\ampaints-paintpulse
3. Delete Documents folder: C:\Users\[YourUsername]\Documents\PaintPulse
4. Reinstall from PaintPulse-Setup-0.1.7.exe
5. Launch and activate
```

### ✅ Permission Fix (2 minutes):
```
1. Right-click PaintPulse shortcut
2. Properties → Compatibility
3. Check "Run this program as an administrator"
4. Apply → Launch app
```

---

## 📞 Still Having Issues?

If none of these work, the issue might be:

1. **Windows Version Compatibility**
   - Requires Windows 10/11
   - May not work on Windows 7/8

2. **Missing Visual C++ Redistributables**
   - Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
   - Install and restart

3. **Corrupted Installation Files**
   - Download fresh ZIP from Replit
   - Verify all files present with verify-download.sh
   - Rebuild from scratch

---

## 🚀 Prevention

To avoid 500 errors in future:

```
✅ Always run as administrator (if needed)
✅ Don't delete database files manually during operation
✅ Close app completely before system shutdown
✅ Add PaintPulse folders to antivirus exclusions
✅ Keep backups of database file (Export from Settings)
```

---

## 📊 Success Indicators

After applying fixes, you should see:
```
✅ Activation screen loads
✅ No 500 errors in browser console (Ctrl+Shift+I)
✅ Dashboard shows data
✅ All pages load properly
✅ Database operations work
```

---

**Most users fix 500 errors by simply deleting the database file and letting the app recreate it fresh!**
