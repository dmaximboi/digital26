import { Router } from "express";
import { PaymentKind, PaymentStatus, StudentStatus } from "@prisma/client";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import {
  requireAuth,
  requireAdmin,
  requireAdminWrite,
} from "../middleware/requireAuth.js";
import { authLimiter } from "../middleware/security.js";
import { compressAndStoreStudentPhoto } from "../lib/studentPhoto.js";
import { isSafeExternalUrl, toViewFocusedUrl } from "../lib/libraryUrl.js";
import {
  createBachsCheckout,
  getBachsCheckout,
  isBachsConfigured,
  isSuccessfulCheckout,
} from "../lib/bachs.js";
import {
  hasLibraryAccess,
  newPaymentReference,
  paymentLabel,
  verifyAndFulfillOrder,
} from "../lib/payments.js";
import { writeAudit } from "../lib/audit.js";

export const libraryRouter = Router();

const uploadDir = path.resolve(
  env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"),
  "library",
);
try {
  mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  console.warn("[library] could not ensure upload dir", uploadDir, err);
}

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, or WebP cover images are allowed"));
      return;
    }
    cb(null, true);
  },
});

function siteBase(): string {
  return (env.PUBLIC_SITE_URL || env.APP_URL || "https://www.digital26.online").replace(
    /\/$/,
    "",
  );
}

function parsePrice(isFree: boolean, priceRaw: unknown): { isFree: boolean; priceUsd: string | null } {
  if (isFree) return { isFree: true, priceUsd: null };
  const price = String(priceRaw ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
    throw new Error("Paid items need a price greater than 0 (e.g. 2.00)");
  }
  return { isFree: false, priceUsd: Number(price).toFixed(2) };
}

type ActiveStudentGate =
  | { ok: true; profile: { id: string; fullName: string | null } }
  | { ok: false; error: string; status: 403 | 404 };

async function requireActiveStudent(req: AuthedRequest): Promise<ActiveStudentGate> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: req.userId! },
    select: { id: true, fullName: true, status: true, registrationPaidAt: true },
  });
  if (!profile) {
    return { ok: false, error: "Submit your application first", status: 404 };
  }
  if (profile.status !== StudentStatus.APPROVED || !profile.registrationPaidAt) {
    return {
      ok: false,
      error: "Library unlocks after admin approval and registration payment",
      status: 403,
    };
  }
  return { ok: true, profile: { id: profile.id, fullName: profile.fullName } };
}

function publicCoverUrl(coverUrl: string): string {
  if (coverUrl.startsWith("http") || coverUrl.startsWith("/")) return coverUrl;
  return `/api/public/files/library/${coverUrl}`;
}

/** Admin list (includes unpublished + external URLs for editing). */
libraryRouter.get("/ops/library", requireAdmin, async (_req, res) => {
  try {
    const items = await prisma.libraryItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.json({
      items: items.map((i) => ({
        ...i,
        coverUrl: publicCoverUrl(i.coverUrl),
      })),
    });
  } catch (err) {
    console.error("[library.ops.list]", err);
    // Table not migrated yet — return empty so admin UI isn't a hard error.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2021" || code === "P2010" || /library_items|LibraryItem/i.test(String(err))) {
      res.json({ items: [] });
      return;
    }
    res.status(500).json({ error: "Failed to load library" });
  }
});

libraryRouter.post(
  "/ops/library",
  authLimiter,
  requireAdminWrite,
  (req, res, next) => {
    coverUpload.single("cover")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Cover upload failed" });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const title = String(req.body?.title ?? "").trim();
      const description = String(req.body?.description ?? "").trim();
      const externalUrl = String(req.body?.externalUrl ?? "").trim();
      const isFree = String(req.body?.isFree ?? "true") === "true";
      const published = String(req.body?.published ?? "true") === "true";
      const sortOrder = Number.parseInt(String(req.body?.sortOrder ?? "0"), 10) || 0;

      if (title.length < 2 || title.length > 160) {
        res.status(400).json({ error: "Title must be 2–160 characters" });
        return;
      }
      if (!isSafeExternalUrl(externalUrl)) {
        res.status(400).json({ error: "Link must be a valid https URL (e.g. Google Drive)" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Cover image is required" });
        return;
      }

      const pricing = parsePrice(isFree, req.body?.priceUsd);
      const stored = await compressAndStoreStudentPhoto(req.file.path, uploadDir, {
        folder: "digital26/library",
        tags: ["library"],
        publicKind: "library",
      });

      const item = await prisma.libraryItem.create({
        data: {
          title,
          description: description || null,
          coverUrl: stored.publicPath,
          externalUrl,
          isFree: pricing.isFree,
          priceUsd: pricing.priceUsd,
          published,
          sortOrder,
          createdBy: req.userEmail || null,
        },
      });

      await writeAudit({
        adminEmail: req.userEmail || "admin",
        action: "library.create",
        targetId: item.id,
        metadata: { title: item.title, isFree: item.isFree },
      });

      res.status(201).json({
        item: { ...item, coverUrl: publicCoverUrl(item.coverUrl) },
      });
    } catch (err) {
      console.error("[library.ops.create]", err);
      res.status(400).json({
        error: err instanceof Error ? err.message : "Failed to create library item",
      });
    }
  },
);

libraryRouter.patch(
  "/ops/library/:id",
  authLimiter,
  requireAdminWrite,
  (req, res, next) => {
    coverUpload.single("cover")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Cover upload failed" });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const existing = await prisma.libraryItem.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Library item not found" });
        return;
      }

      const title =
        req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
      const description =
        req.body?.description !== undefined
          ? String(req.body.description).trim()
          : existing.description || "";
      const externalUrl =
        req.body?.externalUrl !== undefined
          ? String(req.body.externalUrl).trim()
          : existing.externalUrl;
      const isFree =
        req.body?.isFree !== undefined
          ? String(req.body.isFree) === "true"
          : existing.isFree;
      const published =
        req.body?.published !== undefined
          ? String(req.body.published) === "true"
          : existing.published;
      const sortOrder =
        req.body?.sortOrder !== undefined
          ? Number.parseInt(String(req.body.sortOrder), 10) || 0
          : existing.sortOrder;

      if (title.length < 2 || title.length > 160) {
        res.status(400).json({ error: "Title must be 2–160 characters" });
        return;
      }
      if (!isSafeExternalUrl(externalUrl)) {
        res.status(400).json({ error: "Link must be a valid https URL" });
        return;
      }

      const pricing = parsePrice(
        isFree,
        req.body?.priceUsd !== undefined ? req.body.priceUsd : existing.priceUsd,
      );

      let coverUrl = existing.coverUrl;
      if (req.file) {
        const stored = await compressAndStoreStudentPhoto(req.file.path, uploadDir, {
          folder: "digital26/library",
          tags: ["library"],
          publicKind: "library",
        });
        coverUrl = stored.publicPath;
      }

      const item = await prisma.libraryItem.update({
        where: { id },
        data: {
          title,
          description: description || null,
          externalUrl,
          coverUrl,
          isFree: pricing.isFree,
          priceUsd: pricing.priceUsd,
          published,
          sortOrder,
        },
      });

      await writeAudit({
        adminEmail: req.userEmail || "admin",
        action: "library.update",
        targetId: item.id,
        metadata: { title: item.title },
      });

      res.json({ item: { ...item, coverUrl: publicCoverUrl(item.coverUrl) } });
    } catch (err) {
      console.error("[library.ops.update]", err);
      res.status(400).json({
        error: err instanceof Error ? err.message : "Failed to update library item",
      });
    }
  },
);

libraryRouter.delete(
  "/ops/library/:id",
  authLimiter,
  requireAdminWrite,
  async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id || "").trim();
      await prisma.libraryItem.delete({ where: { id } });
      await writeAudit({
        adminEmail: req.userEmail || "admin",
        action: "library.delete",
        targetId: id,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("[library.ops.delete]", err);
      res.status(500).json({ error: "Failed to delete library item" });
    }
  },
);

/** Student catalog — never includes externalUrl until /open. */
libraryRouter.get("/student/library", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const gate = await requireActiveStudent(req);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.error });
      return;
    }

    const items = await prisma.libraryItem.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    const paidIds = new Set(
      (
        await prisma.paymentOrder.findMany({
          where: {
            kind: PaymentKind.LIBRARY,
            userId: req.userId!,
            status: PaymentStatus.PAID,
            publicId: { in: items.map((i) => i.id) },
          },
          select: { publicId: true },
        })
      )
        .map((p) => p.publicId)
        .filter(Boolean) as string[],
    );

    res.json({
      items: items.map((i) => {
        const unlocked = i.isFree || paidIds.has(i.id);
        return {
          id: i.id,
          title: i.title,
          description: i.description,
          coverUrl: publicCoverUrl(i.coverUrl),
          isFree: i.isFree,
          priceUsd: i.priceUsd,
          unlocked,
        };
      }),
    });
  } catch (err) {
    console.error("[library.student.list]", err);
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2021" || code === "P2010" || /library_items|LibraryItem/i.test(String(err))) {
      res.json({ items: [] });
      return;
    }
    res.status(500).json({ error: "Failed to load library" });
  }
});

/**
 * Issue a one-time view URL after access check.
 * We do not stream or attach files — client opens external viewer only.
 */
libraryRouter.post(
  "/student/library/:id/open",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const gate = await requireActiveStudent(req);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }

      const id = String(req.params.id || "").trim();
      const item = await prisma.libraryItem.findFirst({
        where: { id, published: true },
      });
      if (!item) {
        res.status(404).json({ error: "Library item not found" });
        return;
      }

      const unlocked = item.isFree || (await hasLibraryAccess(req.userId!, item.id));
      if (!unlocked) {
        res.status(402).json({
          error: `Pay $${item.priceUsd || "0.00"} to unlock this resource`,
          amountUsd: item.priceUsd,
        });
        return;
      }

      const viewUrl = toViewFocusedUrl(item.externalUrl);
      res.setHeader("Cache-Control", "no-store");
      res.json({
        ok: true,
        viewUrl,
        title: item.title,
      });
    } catch (err) {
      console.error("[library.student.open]", err);
      res.status(500).json({ error: "Failed to open resource" });
    }
  },
);

libraryRouter.post(
  "/student/library/:id/checkout",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      if (!isBachsConfigured()) {
        res.status(503).json({ error: "Payments are not configured yet" });
        return;
      }

      const gate = await requireActiveStudent(req);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }

      const id = String(req.params.id || "").trim();
      const item = await prisma.libraryItem.findFirst({
        where: { id, published: true },
      });
      if (!item) {
        res.status(404).json({ error: "Library item not found" });
        return;
      }
      if (item.isFree) {
        res.json({ ok: true, alreadyPaid: true, free: true });
        return;
      }
      if (await hasLibraryAccess(req.userId!, item.id)) {
        res.json({ ok: true, alreadyPaid: true });
        return;
      }

      const amountUsd = item.priceUsd || "1.00";
      const email = (req.userEmail || "").toLowerCase();
      if (!email) {
        res.status(400).json({ error: "Email required for payment" });
        return;
      }

      const recent = await prisma.paymentOrder.findFirst({
        where: {
          kind: PaymentKind.LIBRARY,
          publicId: item.id,
          userId: req.userId!,
          status: PaymentStatus.PENDING,
          checkoutId: { not: null },
          createdAt: { gte: new Date(Date.now() - 45 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent?.checkoutId) {
        try {
          const remote = await getBachsCheckout(recent.checkoutId);
          if (isSuccessfulCheckout(remote)) {
            await verifyAndFulfillOrder({
              orderId: recent.id,
              checkoutId: recent.checkoutId,
              reference: recent.reference,
            });
            res.json({ ok: true, alreadyPaid: true });
            return;
          }
          if (String(remote.status).toUpperCase() === "OPEN" && remote.checkout_url) {
            res.json({
              ok: true,
              reused: true,
              checkoutUrl: remote.checkout_url,
              amountUsd: recent.amountUsd,
            });
            return;
          }
        } catch {
          /* create new */
        }
      }

      const reference = newPaymentReference(PaymentKind.LIBRARY);
      const order = await prisma.paymentOrder.create({
        data: {
          kind: PaymentKind.LIBRARY,
          status: PaymentStatus.PENDING,
          amountUsd,
          reference,
          customerEmail: email,
          userId: req.userId!,
          profileId: gate.profile.id,
          publicId: item.id,
          metadata: { label: paymentLabel(PaymentKind.LIBRARY), title: item.title },
        },
      });

      const session = await createBachsCheckout({
        amountUsd,
        customerEmail: email,
        customerName: gate.profile.fullName || email.split("@")[0] || "Student",
        successUrl: `${siteBase()}/dashboard/library`,
        cancelUrl: `${siteBase()}/dashboard/library`,
        reference,
        metadata: {
          kind: "LIBRARY",
          reference,
          order_id: order.id,
          public_id: item.id,
          user_id: req.userId!,
        },
      });

      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { checkoutId: session.checkout_id },
      });

      res.status(201).json({
        ok: true,
        checkoutId: session.checkout_id,
        checkoutUrl: session.checkout_url,
        amountUsd,
        label: paymentLabel(PaymentKind.LIBRARY),
      });
    } catch (err) {
      console.error("[library.student.checkout]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to start checkout",
      });
    }
  },
);
