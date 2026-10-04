const GSI_SRC = "https://accounts.google.com/gsi/client";
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
const CLIENT_ID_TIMEOUT_MS = 20000;
const GSI_TIMEOUT_MS = 15000;

type GsiId = {
  initialize: (opts: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
  disableAutoSelect?: () => void;
};

type GsiWindow = {
  google?: { accounts?: { id?: GsiId } };
};

let cachedClientId: string | null = null;
let clientIdPromise: Promise<string | null> | null = null;
let gsiPromise: Promise<GsiId> | null = null;
let gsiInitedFor: string | null = null;
let credentialHandler: ((credential: string) => void) | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function preloadGoogleSignIn() {
  void loadGsiScript().catch(() => undefined);
  void loadGoogleClientId();
}

export async function loadGoogleClientId(): Promise<string | null> {
  if (cachedClientId) return cachedClientId;

  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
  if (fromEnv) {
    cachedClientId = fromEnv;
    return fromEnv;
  }

  if (clientIdPromise) return clientIdPromise;

  clientIdPromise = (async () => {
    const waits = [0, 700, 1600, 3200];
    for (const wait of waits) {
      if (wait) await sleep(wait);
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), CLIENT_ID_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}/api/auth/google-client-id`, {
          headers: { Accept: "application/json" },
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { clientId?: unknown };
        const id =
          typeof data.clientId === "string" && data.clientId.trim()
            ? data.clientId.trim()
            : null;
        if (id) {
          cachedClientId = id;
          return id;
        }
      } catch {
        // Render can be cold. Try again instead of locking a failed result.
      } finally {
        window.clearTimeout(timer);
      }
    }
    return null;
  })().finally(() => {
    clientIdPromise = null;
  });

  return clientIdPromise;
}

export function loadGsiScript(): Promise<GsiId> {
  const existing = (window as GsiWindow).google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise<GsiId>((resolve, reject) => {
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

    const timer = window.setTimeout(
      () => finish(new Error("Google Sign-In timed out")),
      GSI_TIMEOUT_MS,
    );

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

  return gsiPromise ?? Promise.reject(new Error("Google Sign-In failed to load"));
}

export async function renderGoogleSignInButton(
  el: HTMLElement | null,
  onCredential: (credential: string) => void,
): Promise<boolean> {
  if (!el) return false;

  const clientId = await loadGoogleClientId();
  if (!clientId) return false;

  const gsi = await loadGsiScript();
  credentialHandler = onCredential;

  if (gsiInitedFor !== clientId) {
    gsi.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => {
        if (response?.credential) credentialHandler?.(response.credential);
      },
      ux_mode: "popup",
      auto_select: false,
    });
    gsiInitedFor = clientId;
  }

  el.innerHTML = "";
  gsi.renderButton(el, {
    theme: "filled_black",
    size: "large",
    width: 320,
    shape: "pill",
    text: "signin_with",
  });
  return Boolean(el.childElementCount);
}
