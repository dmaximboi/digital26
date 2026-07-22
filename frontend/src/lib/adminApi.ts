import { getAccessToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseHeaders = await authHeaders();
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(baseHeaders as Record<string, string>),
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (method === "GET" || method === "DELETE" || init?.body === undefined) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}


export async function adminDownloadPdf(
  kind: "agreements" | "certificates",
  publicId: string,
): Promise<void> {
  const filename = publicId.endsWith(".pdf") ? publicId : `${publicId}.pdf`;
  const headers = await authHeaders();
  const h = headers as Record<string, string>;
  const res = await fetch(`${API_BASE}/api/ops/files/${kind}/${encodeURIComponent(filename)}`, {
    headers: {
      Authorization: h.Authorization ?? "",
      Accept: "application/pdf",
    },
    credentials: "include",
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Download failed (${res.status})`;
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
