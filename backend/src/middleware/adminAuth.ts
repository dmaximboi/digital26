import type { Request } from "express";

export type AuthedRequest = Request & {
  adminEmail?: string;
  adminUserId?: string;
};
