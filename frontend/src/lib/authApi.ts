import { getToken, clearToken } from "../auth/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("Not signed in");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit" });

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired please sign in again");
  }

  return res;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await authorizedFetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data === "object" && data !== null && "error" in data
      ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await authorizedFetch(path, { method: "POST", body: form });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data === "object" && data !== null && "error" in data
      ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await authorizedFetch(path, {
    headers: { Accept: "application/octet-stream" },
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    const msg = typeof data === "object" && data !== null && "error" in data
      ? (data as { error: string }).error
      : `Download failed (${res.status})`;
    throw new Error(msg);
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
