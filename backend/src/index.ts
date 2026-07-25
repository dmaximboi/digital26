import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { bootstrapStaffAllowlist } from "./lib/admins.js";
import { isResendConfigured, mailTransportLabel } from "./lib/mail.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Digital26 API listening on ${env.API_URL} (port ${env.PORT})`);
  if (!env.FIELD_ENCRYPTION_KEY) {
    console.warn(
      "[security] FIELD_ENCRYPTION_KEY is not set - sensitive field encryption will fail until configured",
    );
  }
  if (!env.GOOGLE_CLIENT_ID) {
    console.warn("[auth] GOOGLE_CLIENT_ID missing - Google Sign-In disabled");
  } else {
    console.log("[auth] Google Sign-In enabled");
  }
  if (!env.JWT_SECRET) {
    console.warn("[auth] JWT_SECRET not set - using dev default (unsafe in production)");
  }
  if (isResendConfigured()) {
    console.log(`[mail] ready via ${mailTransportLabel()}`);
  } else {
    console.warn("[mail] set RESEND_API_KEY — all app email uses Resend (SMTP is not used)");
  }

  void bootstrapStaffAllowlist()
    .then(() => console.log("[auth] staff allowlist bootstrapped"))
    .catch((err) => console.warn("[auth] allowlist bootstrap failed:", err));
});
