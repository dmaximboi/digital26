# Digital26 — Agreement & Certificate System

Internal system for Digital26 covering client deal agreements and course certification. Built for standardization, security, and public verifiability.

**Public site:** `https://digital26.online`  
**Later:** custom domain (`.io` or similar) when ready.

---

## Overview

Two connected parts with strict access separation:

1. **Agreement flow** — secure, time-limited process for a client to review and digitally sign a deal agreement (buy product / learn digital skills / other).
2. **Certificate system** — Certificate of Participation and Certificate of Completion, both issued **manually from the admin panel** (admin sets issue date/time). Existing students can be certified without going through a new agreement.

Every successful agreement and every issued certificate is **public**, each with its own public ID.

---

## Core Principle: Public vs Private

| Data | Visibility |
|---|---|
| Blank agreement template (clauses, wording) | Public |
| Signed agreement card — name, deal type, date, signature, public ID | **Public** (always, on successful sign) |
| Signed agreement — phone, email, NIN, photo, full PDF internals | **Private, admin-only** |
| Certificate — name, course, date, cert ID, status, type | **Public** |
| Certificate — linked private personal data beyond the above | **Private, admin-only** |

Public routes must query stripped public tables/views — never the private records table. This separation is non-negotiable.

---

## Public ID format

| Record | Format | Example |
|---|---|---|
| Agreement | `D26` + sequence + `agr` | `D2600001agr` |
| Certificate (participation or completion) | `D26` + sequence + `cert` | `D2600001cert` |

Public pages:

- `/a/:publicId` — agreement display card  
- `/verify/:publicId` — certificate verification (indexed, in `sitemap.xml`)

---

## Tech Stack (locked)

| Layer | Choice |
|---|---|
| Monorepo | **Turborepo** with `/frontend` + `/backend` |
| Frontend | React + Vite + React Router (TypeScript) |
| Backend | Node.js + Express (TypeScript) |
| Database | Neon (Postgres) + Prisma |
| Auth (admin) | Neon Auth (Managed Better Auth) + server-side allowlist |
| Email / OTP | Neon Auth Email OTP for auth; Nodemailer for agreement passkeys |
| PDF | pdf-lib (preferred) or Puppeteer |
| Phone validation | libphonenumber-js |
| Hosting | Frontend → Vercel / `digital26.online`; Backend → always-on Node host (Render paid / Railway / Fly — avoid free-tier sleep) |

**Repo layout**

```
digital26agreement/
  frontend/     # React (Vite)
  backend/      # Express + Prisma
  packages/     # shared types later
  turbo.json
```

**Admin allowlist (must pass Neon Auth *and* this list):**

- `mztasmith@gmail.com`
- `dmaximboi@gmail.com`

---

## Agreement Flow

1. Admin generates a deal → backend creates `session_id`, one-time passkey (**hash only stored**), link with **12-hour expiry**.
2. Passkey emailed to client (email-only v1; SMS later). Raw passkey never shown to admin after generation.
3. Client opens link → enters passkey before agreement renders. Rate-limit attempts (e.g. 5 then lock).
4. Form: full name, deal type (buy product / learn skills / other + free text), consent/evidence clauses, phone (libphonenumber-js), email OTP confirmation, typed signature (name + timestamp + IP).
5. On submit:
   - Invalidate session + passkey (single-use)
   - Save full private record
   - Always create public display record + public ID (`D26…agr`)
   - Generate PDF snapshot (private storage; public card is stripped)

After expiry or consumption → link shows expired/invalid only.

`nin_encrypted` is field-level encrypted (AES-256-GCM) before DB write.

---

## Certificate Flow

**Both types are manual in admin:**

- Admin opens Certificates tab → chooses person (or creates person) → type (participation | completion) → sets **issue date/time** → issues.
- System assigns public ID `D26…cert`, creates public verification record, generates PDF + QR → `/verify/:publicId`.
- Completion may still require a fresh photo upload before admin can issue (evidential weight) — photo stays private; public page does not expose it.

No auto-issue on agreement sign. 90-day eligibility can still be shown as a *hint* on the dashboard, but issuance is always an admin action.

---

## Database (Prisma / Neon) — high level

```
people
  id, name, phone, email, created_at

agreements          # private
  id, person_id, deal_type, other_deal_text, terms_snapshot,
  signature_name, signed_at, passkey_hash, session_id,
  link_expires_at, consumed_at, nin_encrypted, photo_url, pdf_url,
  public_id, requesting_ip

agreements_public   # stripped — public routes only
  public_id, display_name, deal_type, signed_at, signature_name

certificates        # private (may hold photo_url etc.)
  id, person_id, public_id, type [participation|completion],
  course, issue_date, status [valid|revoked], photo_url, pdf_url

certificates_public # stripped — public routes only
  public_id, display_name, course, type, issue_date, status

admin_audit_log
  id, admin_email, action, target_id, metadata, timestamp
```

Sensitive fields encrypted at column/field level, not only at rest via Neon.

---

## Admin Panel (Neon Auth + allowlist)

Login via Neon Auth (email OTP / passwordless as configured). On session establish, backend checks email against allowlist above. No match → deny, even if Neon Auth succeeded. Every protected route re-checks allowlist server-side.

Sections:

1. **Dashboard** — agreements this month, certs issued, expired/unused links, optional 90-day eligibility hints  
2. **Agreements** — searchable private list + public card status / public ID  
3. **Certificates** — issue participation/completion manually (set date/time), photo-upload trigger for completion, revoke  
4. **Clients** — person view: linked agreements + certs  
5. **Verification** — revoke / status controls  
6. **Audit Log** — every admin action

---

## Security Checklist

- [ ] Passkeys stored as hashes, never plaintext  
- [ ] Links and passkeys single-use, enforced server-side  
- [ ] NIN and sensitive fields encrypted at field level  
- [ ] Public API responses never include private fields (explicit tests)  
- [ ] Admin routes reject non-allowlisted emails even with valid Neon Auth session  
- [ ] Rate limiting on passkey entry and admin login  
- [ ] Secrets only in `.env`, `.env` in `.gitignore`, never in git history  
- [ ] Audit log for every admin action  

**Important:** A Neon connection string was shared in chat. Rotate the Neon role password in the Neon console and update local `.env` before any public repo push.

---

## Local development

```bash
# 1. Copy env, fill Neon URLs (rotate any password shared in chat first)
cp .env.example backend/.env

# 2. Install
npm install

# 3. Generate Prisma client + push schema
npm run db:generate
npm run db:push

# 4. Run both apps (Turbo)
npm run dev
```

- Frontend: http://localhost:5173  
- Backend health: http://localhost:4000/health  

---

## Requirements Before / During Build

- [ ] Neon **direct** (non-pooler) URL for Prisma migrations  
- [ ] Enable Neon Auth + Email OTP; note Auth URL / keys  
- [ ] `FIELD_ENCRYPTION_KEY` (`openssl rand -base64 32`)  
- [ ] Production SMTP for Nodemailer  
- [ ] Always-on backend host (not free Render sleep)  
- [ ] Logo, brand colors, final agreement clause wording  
- [ ] CAC / RC number when available  

---

## Phase Order

1. **Done (scaffold):** Turborepo, React frontend, Express backend, Prisma schema (public/private tables), health + public verify stubs, security middleware  
2. Agreement flow (full security behavior tested)  
3. Certificate issue/revoke in admin + sitemap  
4. Admin panel (Neon Auth + allowlist + audit log)  
5. Production harden + deploy  

Do not skip security tests between phases when real client data is involved.

---

## Deployment Target

- Frontend: `digital26.online`  
- Backend: always-on Node host  
- Database: Neon (eu-central-1)  

## Security built into Phase 1

- Helmet, CORS allowlist, rate limits, no `X-Powered-By`  
- Env validated with Zod; secrets only via `.env`  
- Public routes query `*_public` tables only  
- Passkey hashing + AES-256-GCM field encryption helpers ready  
- Admin allowlist helper (`isAllowlistedAdmin`)
