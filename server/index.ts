import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { log } from "./utils";
import { isDatabaseReady } from "./db";
import { startHeartbeatInterval, isNeonLicenseConfigured } from "./neonLicenseService";

const app = express();

// Enable gzip compression for all responses
app.use(compression({
  level: 6, // Balanced compression level (1-9, higher = more compression but slower)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Compress JSON and text responses
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Check if database is ready (already initialized when db module was loaded)
    if (!isDatabaseReady()) {
      console.error("[Server] Database not initialized!");
      process.exit(1);
    }
    console.log("[Server] Database is ready");

    // Register routes after database is ready
    console.log("[Server] Registering API routes...");
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // Setup static files or Vite
    if (app.get("env") === "development") {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      log(`[Server] serving on port ${port}`);
    });

    // Start Neon license heartbeat if configured
    let stopHeartbeat: (() => void) | null = null;
    if (isNeonLicenseConfigured()) {
      log("[NeonLicense] Starting heartbeat interval for license tracking...");
      stopHeartbeat = startHeartbeatInterval();
      log("[NeonLicense] ✅ Heartbeat service started");
    } else {
      log("[NeonLicense] Not configured - heartbeat disabled (set NEON_LICENSE_DB_URL to enable)");
    }

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      log("[Server] Shutting down gracefully...");
      if (stopHeartbeat) {
        stopHeartbeat();
        log("[NeonLicense] Heartbeat stopped, session ended");
      }
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      log("[Server] Shutting down gracefully...");
      if (stopHeartbeat) {
        stopHeartbeat();
        log("[NeonLicense] Heartbeat stopped, session ended");
      }
      process.exit(0);
    });
  } catch (error) {
    console.error("[Server] ❌ FATAL ERROR starting server:", error);
    console.error("[Server] Stack trace:", error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
})();
