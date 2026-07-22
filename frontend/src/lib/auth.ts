import { getAdminPath } from "./adminPath";

function resolveAuthBase(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (!u) return "";

  u = u.replace(/\/(sign-in|sign-up|sign-out|get-session|forget-password|request-password-reset|token)(\/.*)?$/i, "");
  u = u.replace(/\/$/, "");

  if (u.endsWith("/auth")) return u;
  return `${u}/auth`;
}

const AUTH_URL = resolveAuthBase(import.meta.env.VITE_NEON_AUTH_URL || "");

const SITE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

function adminCallbackBase(): string {
  const path = getAdminPath();
  return path ? `${SITE_ORIGIN}/${path}` : SITE_ORIGIN;
}

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

type AuthResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function neonErrorMessage(data: Record<string, unknown>, status: number): string {
  const code = typeof data.code === "string" ? data.code : "";
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "object" &&
    data.error &&
    "message" in data.error &&
    typeof (data.error as { message?: unknown }).message === "string"
      ? (data.error as { message: string }).message
      : null) ||
    (typeof data.error === "string" ? data.error : null);

  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || /already exists/i.test(message || "")) {
    return "Unable to continue with this email.";
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Wrong email or password.";
  }
  if (code === "MISSING_ORIGIN") {
    return "This site origin is not allowed for sign-in. Add digital26.online in Neon Auth trusted origins.";
  }
  if (/route\s+post:/i.test(message || "") || /not found/i.test(message || "")) {
    return "Sign-in endpoint not found. Set VITE_NEON_AUTH_URL to your Neon Auth base ending in /auth (for example …/neondb/auth).";
  }

  return message || `Auth request failed (${status})`;
}

async function authFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<AuthResult<T>> {
  if (!AUTH_URL) {
    return { data: null, error: { message: "Auth is not configured" } };
  }

  const res = await fetch(`${AUTH_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const jwtHeader =
    res.headers.get("set-auth-jwt") || res.headers.get("Set-Auth-Jwt");
  if (jwtHeader) {
    sessionStorage.setItem("d26_access_token", jwtHeader);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      data: null,
      error: {
        message: neonErrorMessage(data, res.status),
        code: typeof data.code === "string" ? data.code : undefined,
      },
    };
  }

  return { data: data as T, error: null };
}

async function refreshJwt(): Promise<string | null> {
  if (!AUTH_URL) return sessionStorage.getItem("d26_access_token");
  try {
    const res = await fetch(`${AUTH_URL}/token`, {
      method: "GET",
      credentials: "include",
    });
    const header = res.headers.get("set-auth-jwt") || res.headers.get("Set-Auth-Jwt");
    if (header) {
      sessionStorage.setItem("d26_access_token", header);
      return header;
    }
    const body = (await res.json().catch(() => ({}))) as { token?: string };
    if (body.token) {
      sessionStorage.setItem("d26_access_token", body.token);
      return body.token;
    }
  } catch {
    
  }
  return sessionStorage.getItem("d26_access_token");
}

export const authClient = {
  signUp: {
    email: (args: { email: string; password: string; name: string }) =>
      authFetch("/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          ...args,
          callbackURL: adminCallbackBase(),
        }),
      }),
  },
  signIn: {
    email: (args: { email: string; password: string }) =>
      authFetch("/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          ...args,
          callbackURL: adminCallbackBase(),
        }),
      }),
  },
  async requestPasswordReset(email: string) {
    const path = getAdminPath();
    return authFetch("/forget-password", {
      method: "POST",
      body: JSON.stringify({
        email,
        redirectTo: path ? `${SITE_ORIGIN}/${path}/login` : `${SITE_ORIGIN}/`,
      }),
    });
  },
  async getSession() {
    const result = await authFetch<{
      user?: AuthUser;
      session?: { token?: string; access_token?: string };
    }>("/get-session", { method: "GET" });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const user = result.data.user;
    const session = result.data.session;

    if (session?.access_token) {
      sessionStorage.setItem("d26_access_token", session.access_token);
    } else if (session?.token) {
      await refreshJwt();
    }

    if (!user || !session) {
      return { data: null, error: null };
    }

    return { data: { user, session }, error: null };
  },
  async signOut() {
    sessionStorage.removeItem("d26_access_token");
    return authFetch("/sign-out", { method: "POST", body: "{}" });
  },
};

export async function getAccessToken(): Promise<string | null> {
  const cached = sessionStorage.getItem("d26_access_token");
  if (cached) return cached;
  return refreshJwt();
}
