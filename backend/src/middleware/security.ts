import type { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const neonOrigin = (() => {
  try {
    return env.NEON_AUTH_URL ? new URL(env.NEON_AUTH_URL).origin : null;
  } catch {
    return null;
  }
})();

const imageKitOrigin = (() => {
  try {
    return env.IMAGEKIT_URL_ENDPOINT ? new URL(env.IMAGEKIT_URL_ENDPOINT).origin : null;
  } catch {
    return null;
  }
})();

export function applySecurity(app: Express): void {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  const connectSrc = ["'self'", ...env.corsOrigins];
  if (neonOrigin) connectSrc.push(neonOrigin);
  if (imageKitOrigin) connectSrc.push(imageKitOrigin);
  if (env.API_URL) {
    try {
      connectSrc.push(new URL(env.API_URL).origin);
    } catch {
      /* ignore */
    }
  }

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
              scriptSrc: ["'self'"],
              connectSrc,
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      frameguard: { action: "deny" },
      hsts: env.isProd
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
      noSniff: true,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(origin)) {
          callback(null, origin);
          return;
        }
        callback(new Error("CORS blocked"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
      maxAge: 600,
    }),
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (env.isProd) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
    }
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.url || "";
    if (raw.includes("..") || raw.includes("%2e%2e") || raw.includes("\\")) {
      res.status(400).json({ error: "Bad request" });
      return;
    }
    next();
  });
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 240 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 15 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Try again later." },
});

export const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 45 : 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookup requests. Try again later." },
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.isProd ? 8 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Try again later." },
});
