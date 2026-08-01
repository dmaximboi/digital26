import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { isResendConfigured, mailTransportLabel } from "../lib/mail.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      mail: mailTransportLabel(),
      emailFromConfigured: Boolean(env.EMAIL_FROM?.trim()),
      resendConfigured: isResendConfigured(),
    });
  } catch {
    res.status(503).json({ status: "error" });
  }
});
