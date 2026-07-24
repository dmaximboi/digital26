import {
  clearAccessToken,
  forceRefreshAccessToken,
  getAccessToken,
} from "./auth";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

function withLegacyAlias(path: string): string[] {
  if (path.startsWith("/api/ops/")) {
    return [path, path.replace("/api/ops/", "/api/admin/")];
  }
  return [path];
}

function errorMessage(data: unknown, status: number, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return `${fallback} (${status})`;
}

async function authorizedFetch(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const method = (init?.method || "GET").toUpperCase();
  if (
    (method === "GET" || method === "DELETE" || init?.body === undefined) &&
    headers.get("Content-Type") === "application/json"
  ) {
    headers.delete("Content-Type");
  }

  let last: Response | null = null;
  for (const candidate of withLegacyAlias(path)) {
    last = await fetch(`${API_BASE}${candidate}`, {
      ...init,
      headers,
      credentials: "omit",
    });
    if (last.status === 404 && candidate !== withLegacyAlias(path).at(-1)) {
      continue;
    }
    break;
  }

  if (!last) throw new Error("Request failed");

  if ((last.status === 401 || last.status === 403) && !retried) {
    if (last.status === 401) {
      const refreshed = await forceRefreshAccessToken();
      if (refreshed) {
        return authorizedFetch(path, init, true);
      }
    }
    clearAccessToken();
  }

  return last;
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await authorizedFetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data, res.status, "Request failed"));
  }
  return data as T;
}

export async function adminPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await authorizedFetch(path, {
    method: "POST",
    body: form,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data, res.status, "Request failed"));
  }
  return data as T;
}

export async function adminDownloadPdf(
  kind: "agreements" | "certificates",
  publicId: string,
): Promise<void> {
  const filename = publicId.endsWith(".pdf") ? publicId : `${publicId}.pdf`;
  const res = await authorizedFetch(
    `/api/ops/files/${kind}/${encodeURIComponent(filename)}`,
    { headers: { Accept: "application/pdf" } },
  );
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res.status, "Download failed"));
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

export async function adminDownloadCertPng(publicId: string): Promise<void> {
  const res = await authorizedFetch(
    `/api/ops/certificates/${encodeURIComponent(publicId)}/png`,
    { headers: { Accept: "image/png" } },
  );
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res.status, "PNG download failed"));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${publicId}-4k.png`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
