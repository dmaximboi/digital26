import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const ok = database === "ok";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    service: "digital26-api",
    env: env.NODE_ENV,
    database,
    timestamp: new Date().toISOString(),
  });
});
