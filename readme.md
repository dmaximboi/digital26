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

## Env

Server secrets live only in the API host environment (never in the Vite client).

Frontend (Vercel) needs only:

- `VITE_API_URL`
- `VITE_NEON_AUTH_URL` (Neon Auth base ending in `/auth`, e.g. `https://….neonauth….aws.neon.tech/neondb/auth`)
- `VITE_PUBLIC_SITE_URL`
- Optional: `VITE_CONSOLE_PATH` (same value as server `CONSOLE_PATH`; if unset, the client checks `/api/public/gate`)

## Security notes

- Public verify/agreement APIs read public tables only
- Sensitive fields are encrypted at rest
- Staff access is JWT + server allowlist (`STAFF_EMAILS`)
- Console URL segment is not listed by the API; unknown paths redirect home (`CONSOLE_PATH` + `/api/public/gate`)
