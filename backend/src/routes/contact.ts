import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { contactLimiter } from "../middleware/security.js";
import { writeAudit } from "../lib/audit.js";
import type { AuthedRequest } from "../middleware/adminAuth.js";

/** Public contact form only */
export const contactPublicRouter = Router();

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(32).optional(),
  subject: z.string().max(120).optional(),
  message: z.string().min(10).max(2000),
});

contactPublicRouter.post("/contact", contactLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check your details and try again." });
    return;
  }

  const data = parsed.data;
  const row = await prisma.contactMessage.create({
    data: {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      subject: data.subject?.trim() || null,
      body: data.message.trim(),
    },
  });

  res.status(201).json({
    ok: true,
    id: row.id,
    message: "Message received. We’ll get back to you soon.",
  });
});

/** Admin inbox */
export const contactAdminRouter = Router();

contactAdminRouter.get("/admin/messages", requireAdmin, async (_req, res) => {
  const items = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      subject: m.subject,
      body: m.body,
      readAt: m.readAt,
      createdAt: m.createdAt,
    })),
    unread: items.filter((m) => !m.readAt).length,
  });
});

contactAdminRouter.post(
  "/admin/messages/:id/read",
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id ?? "");
    const row = await prisma.contactMessage.findUnique({ where: { id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { readAt: row.readAt ?? new Date() },
    });
    await writeAudit({
      adminEmail: req.adminEmail!,
      action: "message.read",
      targetId: id,
    });
    res.json({ id: updated.id, readAt: updated.readAt });
  },
);

contactAdminRouter.delete(
  "/admin/messages/:id",
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id ?? "");
    try {
      await prisma.contactMessage.delete({ where: { id } });
    } catch {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await writeAudit({
      adminEmail: req.adminEmail!,
      action: "message.delete",
      targetId: id,
    });
    res.json({ ok: true });
  },
);
