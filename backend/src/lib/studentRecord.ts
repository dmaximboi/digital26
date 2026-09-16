import { AssessmentKind } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { programmeLabel } from "./programme.js";
import { isSafeHttpUrl } from "./safeUrl.js";
import { optimizedPhotoUrl } from "./studentPhoto.js";

export function publicPhotoUrl(
  photoUrl: string | null | undefined,
  opts?: { width?: number; allowInvalid?: boolean; status?: string },
): string | null {
  if (!photoUrl) return null;
  if (!opts?.allowInvalid && opts?.status && opts.status !== "VALID") return null;
  let url = photoUrl.trim();
  if (!url || url.startsWith("//") || /^(javascript|data|vbscript):/i.test(url)) return null;
  if (!url.startsWith("http") && !url.startsWith("/")) {
    if (!/^[A-Za-z0-9._-]+$/.test(url)) return null;
    url = `/api/public/files/students/${url}`;
  }
  if (url.startsWith("/") && url.startsWith("//")) return null;
  return optimizedPhotoUrl(url, opts?.width ?? 400, 70);
}

export async function resolveStudentProfileForCert(opts: {
  studentProfileId?: string | null;
  inviteEmail?: string | null;
}) {
  if (opts.studentProfileId) {
    const byId = await prisma.studentProfile.findUnique({
      where: { id: opts.studentProfileId },
      include: {
        user: { select: { email: true } },
        projects: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        credentials: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        assessments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (byId) return byId;
  }

  const email = opts.inviteEmail?.trim().toLowerCase();
  if (!email) return null;

  return prisma.studentProfile.findFirst({
    where: { user: { email } },
    include: {
      user: { select: { email: true } },
      projects: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      credentials: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      assessments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

function mapAssessment(row: {
  id: string;
  title: string;
  score: string | null;
  maxScore: string | null;
  notes: string | null;
  takenAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    score: row.score,
    maxScore: row.maxScore,
    notes: row.notes,
    takenAt: row.takenAt,
  };
}

export async function publicStudentBundle(opts: {
  studentProfileId?: string | null;
  inviteEmail?: string | null;
}) {
  const profile = await resolveStudentProfileForCert(opts);
  if (!profile) {
    return {
      student: null,
      projects: [] as Array<{
        id: string;
        title: string;
        url: string;
        description: string | null;
        completedAt: Date | null;
      }>,
      credentials: [] as Array<{
        id: string;
        title: string;
        url: string;
        issuer: string | null;
        earnedAt: Date | null;
      }>,
      assessments: {
        performance: [] as ReturnType<typeof mapAssessment>[],
        tests: [] as ReturnType<typeof mapAssessment>[],
        examinations: [] as ReturnType<typeof mapAssessment>[],
      },
    };
  }

  return {
    student: {
      fullName: profile.fullName,
      photoUrl: publicPhotoUrl(profile.photoUrl, { width: 480, allowInvalid: true }),
      programme: profile.programme,
      programmeLabel: programmeLabel(profile.programme, profile.customMonths),
      classMode: profile.classMode,
      startDate: profile.startDate,
      headline: profile.headline,
      directorComment: profile.directorComment,
    },
    projects: profile.projects
      .filter((p) => isSafeHttpUrl(p.url))
      .map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        description: p.description,
        completedAt: p.completedAt,
      })),
    credentials: profile.credentials
      .filter((c) => isSafeHttpUrl(c.url))
      .map((c) => ({
        id: c.id,
        title: c.title,
        url: c.url,
        issuer: c.issuer,
        earnedAt: c.earnedAt,
      })),
    assessments: {
      performance: profile.assessments
        .filter((a) => a.kind === AssessmentKind.PERFORMANCE)
        .map(mapAssessment),
      tests: profile.assessments
        .filter((a) => a.kind === AssessmentKind.TEST)
        .map(mapAssessment),
      examinations: profile.assessments
        .filter((a) => a.kind === AssessmentKind.EXAMINATION)
        .map(mapAssessment),
    },
  };
}
