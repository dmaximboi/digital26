import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { isSmtpConfigured } from "./lib/mail.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Digital26 API listening on ${env.API_URL} (port ${env.PORT})`);
  if (!env.FIELD_ENCRYPTION_KEY) {
    console.warn(
      "[security] FIELD_ENCRYPTION_KEY is not set - sensitive field encryption will fail until configured",
    );
  }
  if (!env.NEON_AUTH_URL) {
    console.warn("[auth] NEON_AUTH_URL missing - admin Neon Auth JWT verify disabled");
  } else {
    console.log(`[auth] Neon Auth: ${env.NEON_AUTH_URL}`);
  }
  console.log(
    isSmtpConfigured()
      ? `[mail] SMTP ready (${env.SMTP_HOST})`
      : "[mail] SMTP not configured - emails log to console in development",
  );
});
