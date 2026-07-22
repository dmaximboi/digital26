/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  /** Secret admin URL segment — set only in local/Vercel env, never commit a real value */
  readonly VITE_ADMIN_PATH?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
