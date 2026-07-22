import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export async function writeAudit(opts: {
  adminEmail: string;
  action: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminEmail: opts.adminEmail,
      action: opts.action,
      targetId: opts.targetId,
      metadata: opts.metadata,
    },
  });
}
