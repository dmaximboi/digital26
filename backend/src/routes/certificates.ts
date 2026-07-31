import { Router } from "express";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { CertificateStatus, CertificateType, ProgrammeType, StudentStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { nextPublicId } from "../lib/publicId.js";
import { writeAudit } from "../lib/audit.js";
import { buildCertificatePdf } from "../lib/pdf.js";
import { requireAdmin, requireAdminWrite } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { authLimiter } from "../middleware/security.js";
import { EvidenceKind } from "@prisma/client";
import { evidenceUpload, storeEvidenceFiles } from "../lib/evidence.js";
import { buildCertificatePng4k } from "../lib/certPng.js";
import { trySendMail } from "../lib/mail.js";
import { compressAndStoreStudentPhoto, studentPhotoAbsoluteUrl } from "../lib/studentPhoto.js";
import { programmeCourseName, PROGRAMME_CODES } from "../lib/programme.js";
import { issueTemplateDownloadToken } from "../lib/downloadToken.js";

export const certificatesRouter = Router();

const uploadDir = path.resolve(process.cwd(), "uploads", "students");
mkdirSync(uploadDir, { recursive: true });

const issueSchema = z.object({
  studentProfileId: z.string().min(1),
  type: z.nativeEnum(CertificateType),
  course: z.string().min(2).max(200).optional(),
  programme: z.enum(["THREE_MONTH", "FOUR_MONTH", "FIVE_MONTH", "SIX_MONTH", "CUSTOM"]).optional(),
  customMonths: z.coerce.number().int().min(1).max(24).optional(),
});

certificatesRouter.post(
  "/ops/certificates",
  authLimiter,
  requireAdminWrite,
  (req, res, next) => {
    evidenceUpload.fields([
      { name: "together", maxCount: 1 },
      { name: "portrait", maxCount: 1 },
    ])(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Photo upload failed",
        });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const parsed = issueSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Select a student and certificate type" });
        return;
      }

      const bag = req.files as Record<string, Express.Multer.File[]> | undefined;
      const togetherFile = bag?.together?.[0];
      const portraitFile = bag?.portrait?.[0];
      if (!togetherFile) {
        res.status(400).json({
          error: "Upload 1 photo of admin and student together",
        });
        return;
      }

      const data = parsed.data;

      const profile = await prisma.studentProfile.findUnique({
        where: { id: data.studentProfileId },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      if (!profile) {
        res.status(404).json({ error: "Student not found" });
        return;
      }
      if (profile.status !== StudentStatus.APPROVED) {
        res.status(400).json({ error: "Only approved students can receive certificates" });
        return;
      }

      const programmeOverride =
        data.programme && PROGRAMME_CODES.includes(data.programme)
          ? data.programme
          : profile.programme;
      const customMonths =
        programmeOverride === "CUSTOM"
          ? (data.customMonths ?? profile.customMonths ?? null)
          : null;

      if (
        data.programme &&
        (data.programme !== profile.programme || customMonths !== profile.customMonths)
      ) {
        await prisma.studentProfile.update({
          where: { id: profile.id },
          data: {
            programme: programmeOverride as ProgrammeType,
            customMonths,
          },
        });
      }

      const courseName =
        data.course?.trim() ||
        programmeCourseName(programmeOverride, customMonths);

      let photoUrl = profile.photoUrl
        ? (profile.photoUrl.startsWith("http") ? profile.photoUrl : studentPhotoAbsoluteUrl(profile.photoUrl))
        : null;

      if (portraitFile) {
        const stored = await compressAndStoreStudentPhoto(portraitFile.path, uploadDir);
        photoUrl = stored.publicPath.startsWith("http")
          ? stored.publicPath
          : studentPhotoAbsoluteUrl(stored.publicPath);
        await prisma.studentProfile.update({
          where: { id: profile.id },
          data: { photoUrl: stored.publicPath },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const publicId = await nextPublicId(tx);

        const cert = await tx.certificate.create({
          data: {
            type: data.type,
            course: courseName,
            issueDate: new Date(),
            status: CertificateStatus.VALID,
            publicId,
            photoUrl,
            inviteEmail: profile.user.email.toLowerCase(),
          },
        });

        await tx.certificatePublic.create({
          data: {
            publicId,
            certificateId: cert.id,
            displayName: profile.fullName,
            course: courseName,
            type: data.type,
            issueDate: cert.issueDate,
            status: CertificateStatus.VALID,
            photoUrl,
          },
        });

        return { publicId, certificateId: cert.id, issueDate: cert.issueDate };
      });

      await storeEvidenceFiles({
        files: [togetherFile],
        kind: EvidenceKind.CERT_ADMIN_STUDENT,
        uploadedBy: "admin",
        certificateId: result.certificateId,
      });

      let pdfUrl: string | null = null;
      try {
        const pdf = await buildCertificatePdf({
          publicId: result.publicId,
          displayName: profile.fullName,
          course: courseName,
          type: data.type,
          issueDate: result.issueDate,
          status: "VALID",
          photoUrl: photoUrl || undefined,
        });
        pdfUrl = pdf.publicUrl;
        await prisma.certificate.update({
          where: { id: result.certificateId },
          data: { pdfUrl },
        });
      } catch (pdfErr) {
        console.error("[cert.pdf]", pdfErr);
      }

      const verifyUrl = `${env.PUBLIC_SITE_URL || env.APP_URL}/verify/${result.publicId}`;

      trySendMail({
        to: profile.user.email,
        subject: `[Digital 26] Your certificate is ready: ${result.publicId}`,
        text: [
          `Hi ${profile.fullName},`,
          ``,
          `Your Digital 26 certificate has been issued.`,
          ``,
          `Type: Certificate of ${data.type === "COMPLETION" ? "Completion" : "Participation"}`,
          `Course: ${courseName}`,
          `Public ID: ${result.publicId}`,
          ``,
          `View and verify your certificate:`,
          verifyUrl,
          ``,
          `Congratulations from The Digital 26 team.`,
        ].join("\n"),
      }).catch(() => {});

      try {
        await writeAudit({
          adminEmail: req.userEmail!,
          action: "certificate.issue",
          targetId: result.certificateId,
          metadata: {
            publicId: result.publicId,
            type: data.type,
            studentEmail: profile.user.email,
            studentName: profile.fullName,
          },
        });
      } catch {}

      const download = issueTemplateDownloadToken("certificate", result.publicId);
      res.status(201).json({
        ok: true,
        publicId: result.publicId,
        certificateId: result.certificateId,
        type: data.type,
        course: courseName,
        studentName: profile.fullName,
        studentEmail: profile.user.email,
        photoUrl,
        issueDate: result.issueDate,
        verifyUrl,
        pdfUrl,
        canDownloadTemplatePng: true,
        downloadToken: download.token,
      });
    } catch (err) {
      console.error("[certificate.issue]", err);
      res.status(500).json({ error: "Failed to issue certificate" });
    }
  },
);

certificatesRouter.get(
  "/ops/certificates/:publicId/png",
  requireAdmin,
  async (req, res) => {
    try {
      const publicId = String(req.params.publicId ?? "").trim();
      const row = await prisma.certificatePublic.findUnique({ where: { publicId } });
      if (!row || row.status !== CertificateStatus.VALID) {
        res.status(404).json({ error: "Certificate not found" });
        return;
      }
      const png = await buildCertificatePng4k({
        publicId: row.publicId,
        displayName: row.displayName,
        course: row.course,
        type: row.type,
        issueDate: row.issueDate,
        status: row.status,
        photoUrl: row.photoUrl,
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${publicId}-4k.png"`,
      );
      res.send(png);
    } catch (err) {
      console.error("[cert.png]", err);
      res.status(500).json({ error: "Failed to render certificate image" });
    }
  },
);

certificatesRouter.post(
  "/ops/certificates/:publicId/revoke",
  authLimiter,
  requireAdminWrite,
  async (req: AuthedRequest, res) => {
    const publicId = String(req.params.publicId ?? "");
    const cert = await prisma.certificate.findUnique({ where: { publicId } });
    if (!cert) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: cert.id },
        data: { status: CertificateStatus.REVOKED },
      }),
      prisma.certificatePublic.update({
        where: { publicId },
        data: { status: CertificateStatus.REVOKED },
      }),
    ]);

    await writeAudit({
      adminEmail: req.userEmail!,
      action: "certificate.revoke",
      targetId: cert.id,
      metadata: { publicId },
    });

    res.json({ ok: true, publicId, status: "REVOKED" });
  },
);

certificatesRouter.get("/ops/approved-students", requireAdmin, async (_req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      where: { status: StudentStatus.APPROVED },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    res.json({
      items: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.user.email,
        programme: s.programme,
        customMonths: s.customMonths,
        photoUrl: s.photoUrl,
      })),
    });
  } catch (err) {
    console.error("[approved-students]", err);
    res.status(500).json({ error: "Failed to load students" });
  }
});
