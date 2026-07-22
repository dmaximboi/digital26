import { getAccessToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

function withLegacyAlias(path: string): string[] {
  if (path.startsWith("/api/ops/")) {
    return [path, path.replace("/api/ops/", "/api/admin/")];
  }
  return [path];
}

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

  let lastStatus = 0;
  let lastData: unknown = {};

  for (const candidate of withLegacyAlias(path)) {
    const res = await fetch(`${API_BASE}${candidate}`, {
      ...init,
      headers,
      credentials: "include",
    });
    lastStatus = res.status;
    if (res.status === 404 && candidate !== withLegacyAlias(path).at(-1)) {
      continue;
    }
    if (res.status === 204) return undefined as T;
    lastData = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof lastData === "object" &&
        lastData !== null &&
        "error" in lastData &&
        typeof (lastData as { error: unknown }).error === "string"
          ? (lastData as { error: string }).error
          : `Request failed (${lastStatus})`;
      throw new Error(message);
    }
    return lastData as T;
  }

  throw new Error(`Request failed (${lastStatus})`);
}

export async function adminDownloadPdf(
  kind: "agreements" | "certificates",
  publicId: string,
): Promise<void> {
  const filename = publicId.endsWith(".pdf") ? publicId : `${publicId}.pdf`;
  const headers = await authHeaders();
  const h = headers as Record<string, string>;
  const paths = withLegacyAlias(
    `/api/ops/files/${kind}/${encodeURIComponent(filename)}`,
  );

  let res: Response | null = null;
  for (const p of paths) {
    res = await fetch(`${API_BASE}${p}`, {
      headers: {
        Authorization: h.Authorization ?? "",
        Accept: "application/pdf",
      },
      credentials: "include",
    });
    if (res.status !== 404) break;
  }
  if (!res || !res.ok) {
    const data: unknown = res ? await res.json().catch(() => ({})) : {};
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Download failed (${res?.status ?? 0})`;
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
