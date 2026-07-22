import express from "express";
import { applySecurity, globalLimiter } from "./middleware/security.js";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { agreementsRouter } from "./routes/agreements.js";
import { certificatesRouter } from "./routes/certificates.js";
import { adminRouter } from "./routes/admin.js";
import { filesRouter } from "./routes/files.js";
import { contactPublicRouter, contactAdminRouter } from "./routes/contact.js";

export function createApp() {
  const app = express();

  applySecurity(app);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT || "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(globalLimiter);

  app.use(healthRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/public", filesRouter);
  app.use("/api/public", contactPublicRouter);
  app.use("/api", agreementsRouter);
  app.use("/api", certificatesRouter);
  app.use("/api", contactAdminRouter);
  app.use("/api", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : "Server error";
      const isCors = message.startsWith("CORS blocked");
      if (isCors) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
