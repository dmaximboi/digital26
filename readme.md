# The Digital 26

Agreements and verifiable Vibe Coding certificates.

- Site: https://digital26.online
- Frontend: Vercel (`frontend/`)
- API: always-on Node host (`backend/`)
- Database: Neon Postgres

## Local

```bash
cp .env.example backend/.env
npm install
npm run db:generate
npm run db:push
npm run dev
```

- App: http://localhost:5173
- API health: http://localhost:4000/health

## Production

Site is Vercel (`frontend/`). API is Render (`backend/`, service `digital26-api`). Database is Neon. Do not put localhost URLs in live env.

### 1. Render env (API)

Copy from `backend/.env.example`. Set `NODE_ENV=production`.

| Key | Live value |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled + direct |
| `FIELD_ENCRYPTION_KEY` | random 32+ chars, never change after first encrypt |
| `JWT_SECRET` | random 32+ chars |
| `STAFF_EMAILS` | your Google admin email(s), comma-separated |
| `GOOGLE_CLIENT_ID` | Google Cloud → APIs → Credentials → Web client ID |
| `API_URL` | Render public URL, e.g. `https://….onrender.com` (dashboard → service → URL). Not localhost. |
| `APP_URL` / `PUBLIC_SITE_URL` | `https://www.digital26.online` |
| `CORS_ORIGINS` | `https://digital26.online,https://www.digital26.online` |
| `CRON_SECRET` | random 32+ chars (`openssl rand -hex 32`) |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `GNEWS_API_KEY` | https://gnews.io |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend, from address on verified `digital26.online` |
| `BACHS_API_KEY` / `BACHS_WEBHOOK_SECRET` | live `sk_live_…` only |
| `IMAGEKIT_*` | ImageKit keys + `https://ik.imagekit.io/…` |

### 2. Vercel env (frontend)

Set for **Production**, then redeploy. `VITE_*` is baked in at build time.

| Key | Live value |
| --- | --- |
| `VITE_API_URL` | same as Render `API_URL` (no trailing slash) |
| `VITE_PUBLIC_SITE_URL` | `https://www.digital26.online` |
| `VITE_GOOGLE_CLIENT_ID` | optional, same public Google client ID (faster sign-in) |

Never put `JWT_SECRET`, DB URLs, or Groq/Resend/Bachs keys on Vercel.

### 3. Cron (one job)

Render free sleeps, so the in-process 15-minute filler is not enough. Quiz and news are written only by cron.

**What:** `POST {API_URL}/api/cron/daily-quiz`  
**Header:** `X-Cron-Secret: {CRON_SECRET}`  
**When:** `10 0 * * *` (00:10 UTC, once a day)

**GitHub (already in repo):** repo → Settings → Secrets → Actions → add `API_URL` and `CRON_SECRET`. Workflow `.github/workflows/daily-pack.yml` runs on that schedule. You can also run it by hand (Actions → Daily pack → Run workflow).

**cron-job.org (recommended backup, wakes Render even if GitHub skips):**

1. https://cron-job.org → Create cron job
2. URL: `https://YOUR-SERVICE.onrender.com/api/cron/daily-quiz`
3. Schedule: every day at 00:10 UTC (optional extra: every 6 hours)
4. Request method: POST
5. Headers: `X-Cron-Secret` = the same secret as Render
6. Enable job

Test:

```bash
curl -X POST -H "X-Cron-Secret: YOUR_SECRET" https://YOUR-SERVICE.onrender.com/api/cron/daily-quiz
```

Expect JSON like `{ "ok": true, "poolSize": 30, "newsCount": 20 }`.

### 4. Google, Bachs, Resend

Google Cloud OAuth Web client:

- Authorized JavaScript origins: `https://digital26.online` and `https://www.digital26.online`
- Authorized redirect URIs: the same two origins

Bachs dashboard webhook URL:

`{API_URL}/api/public/payments/bachs/webhook`

Resend: verify `digital26.online`, then `EMAIL_FROM=The Digital 26 <noreply@digital26.online>`. Render free blocks SMTP; use `RESEND_API_KEY` only.

### 5. After deploy

- `GET {API_URL}/health` → `{ "status": "ok" }`
- https://www.digital26.online/signin → Google button (not a config error)
- https://www.digital26.online/quiz and `/news` after the cron has run once

## Env

Server secrets live only in the API host environment (never in the Vite client).

Email on Render: use **Resend HTTPS API** (`RESEND_API_KEY`) - not SMTP.

Student apply no longer needs an email OTP - Google Sign-In already verifies the address. Resend is still used for admin emails, agreement passkeys, etc.

## Security notes

- Public verify/agreement APIs read public tables only
- Sensitive fields are encrypted at rest
- Staff access is JWT + server allowlist (`STAFF_EMAILS`)
- Console URL segment is not listed by the API; unknown paths redirect home (`CONSOLE_PATH` + `/api/public/gate`)
