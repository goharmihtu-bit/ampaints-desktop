import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { log } from "./utils";

const app = express();

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
    console.log('[Server] Starting PaintPulse production server...');
    console.log('[Server] Database path:', process.env.DATABASE_PATH || 'default');
    console.log('[Server] Node environment:', process.env.NODE_ENV);
    
    const server = await registerRoutes(app);
    console.log('[Server] Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('[Server] Error handler caught:', err);
      res.status(status).json({ message });
      throw err;
    });

    // Production mode - only serve static files, NO vite
    serveStatic(app);
    console.log('[Server] Static files configured');

    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
      console.log('[Server] ✅ Server started successfully!');
      console.log('[Server] Access the app at: http://localhost:' + port);
    });
  } catch (error) {
    console.error('[Server] ❌ FATAL ERROR starting server:', error);
    console.error('[Server] Stack trace:', (error as Error).stack);
    process.exit(1);
  }
})();
