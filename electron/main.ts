import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";

// Initialize electron-store for persisting user settings
interface StoreType {
  databasePath?: string;
  windowBounds?: { width: number; height: number; x?: number; y?: number };
  isActivated?: boolean;
}

// Store will be initialized asynchronously
let store: any = null;

let mainWindow: BrowserWindow | null = null;
let serverReady = false;

// Database path management
function getDatabasePath(): string {
  let dbPath = store.get("databasePath");

  if (!dbPath) {
    // Default to Documents/PaintPulse/paintpulse.db
    const documentsPath = app.getPath("documents");
    const defaultPath = path.join(documentsPath, "PaintPulse", "paintpulse.db");
    dbPath = defaultPath;
    store.set("databasePath", defaultPath);
  }

  return dbPath;
}

async function selectDatabaseLocation(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: "Select Database Location",
    defaultPath: getDatabasePath(),
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["createDirectory", "showOverwriteConfirmation"]
  });

  if (!result.canceled && result.filePath) {
    store.set("databasePath", result.filePath);
    return result.filePath;
  }

  return null;
}

function createWindow() {
  // Get saved window bounds or use defaults
  const windowBounds = store.get("windowBounds") || {
    width: 1400,
    height: 900
  };

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 768,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "PaintPulse v1.4 FINAL - Paint Store Management",
    show: false, // Don't show until ready-to-show event
  });

  // Save window bounds on resize/move
  mainWindow.on("resize", () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", bounds);
  });

  mainWindow.on("move", () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", bounds);
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.setFullScreen(true);
  });

  // ✅ FIXED: Always load from local server (works for both dev and production)
  mainWindow.loadURL("http://localhost:5000");

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("get-database-path", () => {
  return getDatabasePath();
});

ipcMain.handle("select-database-location", async () => {
  const newPath = await selectDatabaseLocation();
  if (newPath) {
    // Restart app to apply new database location
    app.relaunch();
    app.exit();
  }
  return newPath;
});

ipcMain.handle("export-database", async () => {
  const currentDbPath = getDatabasePath();

  const result = await dialog.showSaveDialog({
    title: "Export Database",
    defaultPath: "paintpulse-backup.db",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ],
  });

  if (!result.canceled && result.filePath) {
    const fs = await import("fs/promises");
    try {
      await fs.copyFile(currentDbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return { success: false, error: "Export cancelled" };
});

ipcMain.handle("import-database", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import Database",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const newDbPath = result.filePaths[0];
    store.set("databasePath", newDbPath);

    // Restart app to apply new database
    app.relaunch();
    app.exit();

    return { success: true, path: newDbPath };
  }

  return { success: false, error: "Import cancelled" };
});

// Activation handlers
ipcMain.handle("get-activation-status", () => {
  return store.get("isActivated", false);
});

ipcMain.handle("set-activation-status", (_event, status: boolean) => {
  store.set("isActivated", status);
  return true;
});

// App lifecycle
app.whenReady().then(async () => {
  // ✅ Set production mode for packaged app
  process.env.NODE_ENV = "production";

  // ✅ CRITICAL FIX: Initialize electron-store with dynamic import
  const { default: ElectronStore } = await import("electron-store");
  store = new ElectronStore<StoreType>({
    schema: {
      databasePath: { type: 'string' },
      windowBounds: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' }
        }
      },
      isActivated: { type: 'boolean', default: false }
    }
  });

  // Ensure database directory exists
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  const fsPromises = await import("fs/promises");
  try {
    await fsPromises.mkdir(dbDir, { recursive: true });
  } catch (error) {
    console.error("Error creating database directory:", error);
  }

  // Set database path in server module
  process.env.DATABASE_PATH = dbPath;

  // ✅ Start Express server (built to dist/index.js for correct path resolution)
  const serverPath = path.join(__dirname, "..", "dist", "index.js");
  const serverModule = await import(pathToFileURL(serverPath).href);

  // ✅ Wait a moment for server to start before creating window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
