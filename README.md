# Homnivas App

Single Cloudflare Worker: static frontend (`/public`) + API (`/api/*`) + D1 + KV — one deploy, one `wrangler.toml`.

## Implemented

- `POST /api/auth/login/start` — PAN+DOB lookup, sends OTP via email (Resend)
- `POST /api/auth/login/verify` — OTP check (single-use, 5-attempt limit, 10-min expiry), issues a session cookie
- `requireAuth` middleware — gates any route behind the session cookie

## Stubbed (return 501, not designed yet)

- `POST /api/kyc/submit` — KYC form intake
- `POST /api/cibil/upload` — CIBIL PDF upload + AI parse
- `GET /api/dashboard` — CIBIL summary, income/EMI, 4-stage progress tracker

## Database

`migrations/0001_init.sql` — complete schema for everything specced so far: `applicants`, `cibil_reports`, `income_declarations`, `applications` (with the ₹10,000 + ₹6,000 payment split and the 4-stage status). Not modeled: dispute/cleanup tracking — not designed yet.

## First-time setup

```bash
npm install
wrangler d1 create homnivas-db        # copy the returned database_id into wrangler.toml
wrangler kv namespace create OTP_KV   # copy the returned id into wrangler.toml
wrangler secret put JWT_SECRET
wrangler secret put PAN_PEPPER
wrangler secret put RESEND_API_KEY
npm run db:migrate:remote
```

Resend also needs a verified sending domain (Resend dashboard → Domains) before `FROM_ADDRESS` in `src/lib/email-otp.ts` will actually deliver — update that address to match your verified domain.

## Local dev

Create `.dev.vars` (gitignored) with the three secrets above, then:

```bash
npm run dev
```
