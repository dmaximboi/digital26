export function checkoutStorageKey(kind: string, publicId: string): string {
  return `d26_checkout_${kind}_${publicId}`;
}

export function getCheckoutProof(kind: string, publicId: string): string | null {
  try {
    return sessionStorage.getItem(checkoutStorageKey(kind, publicId));
  } catch {
    return null;
  }
}

export function setCheckoutProof(kind: string, publicId: string, checkoutId: string): void {
  try {
    sessionStorage.setItem(checkoutStorageKey(kind, publicId), checkoutId);
  } catch {
    /* ignore */
  }
}

/** Persist Bachs return `checkout_id` (and any stored proof) for payer-bound download. */
export function captureCheckoutProof(kind: string, publicId: string): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("checkout_id")?.trim();
    if (fromUrl) {
      setCheckoutProof(kind, publicId, fromUrl);
      return fromUrl;
    }
  } catch {
    /* ignore */
  }
  return getCheckoutProof(kind, publicId);
}

export function publicLookupPath(kind: "CERTIFICATE" | "AGREEMENT", publicId: string): string {
  const proof = captureCheckoutProof(kind, publicId);
  const q = proof ? `?checkout_id=${encodeURIComponent(proof)}` : "";
  return kind === "CERTIFICATE"
    ? `/api/public/verify/${encodeURIComponent(publicId)}${q}`
    : `/api/public/a/${encodeURIComponent(publicId)}${q}`;
}
