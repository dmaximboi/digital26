const GSI_SRC = "https://accounts.google.com/gsi/client";
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
const CLIENT_ID_TIMEOUT_MS = 2500;
const GSI_TIMEOUT_MS = 5000;

type GsiId = {
  initialize: (opts: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
  disableAutoSelect?: () => void;
};

type GsiWindow = {
  google?: { accounts?: { id?: GsiId } };
};

let cachedClientId: string | null | undefined;
let clientIdPromise: Promise<string | null> | null = null;
let gsiPromise: Promise<GsiId> | null = null;

export function preloadGoogleSignIn() {
  void loadGsiScript();
  void loadGoogleClientId();
}

export function loadGoogleClientId(): Promise<string | null> {
  if (cachedClientId !== undefined) return Promise.resolve(cachedClientId);
  if (clientIdPromise) return clientIdPromise;

  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
  if (fromEnv) {
    cachedClientId = fromEnv;
    return Promise.resolve(fromEnv);
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), CLIENT_ID_TIMEOUT_MS);

  clientIdPromise = fetch(`${API_BASE}/api/auth/google-client-id`, {
    headers: { Accept: "application/json" },
    signal: ctrl.signal,
  })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as { clientId?: unknown };
      const id = typeof data.clientId === "string" && data.clientId.trim() ? data.clientId.trim() : null;
      cachedClientId = id;
      return id;
    })
    .catch(() => {
      cachedClientId = null;
      return null;
    })
    .finally(() => {
      window.clearTimeout(timer);
      clientIdPromise = null;
    });

  return clientIdPromise;
}

export function loadGsiScript(): Promise<GsiId> {
  const existing = (window as GsiWindow).google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    const finish = (err?: Error) => {
      window.clearTimeout(timer);
      if (err) {
        reject(err);
        return;
      }
      const api = (window as GsiWindow).google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error("Google Sign-In failed to load"));
    };

    const timer = window.setTimeout(() => finish(new Error("Google Sign-In timed out")), GSI_TIMEOUT_MS);

    const already = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (already) {
      if ((window as GsiWindow).google?.accounts?.id) {
        finish();
        return;
      }
      already.addEventListener("load", () => finish(), { once: true });
      already.addEventListener("error", () => finish(new Error("Google Sign-In failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => finish();
    script.onerror = () => finish(new Error("Google Sign-In failed to load"));
    document.head.appendChild(script);
  }).finally(() => {
    if (!(window as GsiWindow).google?.accounts?.id) gsiPromise = null;
  });

  return gsiPromise;
}
