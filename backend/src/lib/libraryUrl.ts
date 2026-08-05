/** Only allow https links for library resources (Drive, Docs, etc.). */
export function isSafeExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    if (!u.hostname || u.hostname.includes(" ")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer Google Drive preview/view URLs so the browser opens a viewer,
 * not a forced download from our app. We never proxy file bytes.
 */
export function toViewFocusedUrl(raw: string): string {
  const url = raw.trim();
  try {
    const u = new URL(url);
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("docs.google.com")) {
      return url;
    }

    // https://drive.google.com/file/d/FILE_ID/view?...
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // open?id=FILE_ID
    const id = u.searchParams.get("id");
    if (id && u.pathname.includes("/open")) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    // folders stay as-is (folder UI)
    return url;
  } catch {
    return url;
  }
}
