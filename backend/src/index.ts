import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { isResendConfigured, isSmtpConfigured, mailTransportLabel } from "./lib/mail.js";

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
  if (isResendConfigured() || isSmtpConfigured()) {
    console.log(`[mail] ready via ${mailTransportLabel()}`);
  } else {
    console.warn(
      "[mail] no transport - set RESEND_API_KEY (works on Render free) or SMTP_* on a host that allows SMTP",
    );
  }
});
