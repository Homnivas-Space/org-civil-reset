# Homnivas App

Single Cloudflare Worker: static frontend (`/public`, plain HTML/CSS/JS PWA) + API (`/api/*`) + D1 + KV — one deploy, one `wrangler.toml`.

## Implemented

- `POST /api/auth/login/start`, `POST /api/auth/login/verify` — PAN+DOB → email OTP (Resend) → session cookie
- `POST /api/kyc/submit` — typed-field intake, creates the applicant + an `account_opened` application row, auto-sends the login OTP
- `POST /api/cibil/upload` — PDF → text extraction (unpdf) → free-tier OpenRouter model → `cibil_reports`. **Provisional**: the model is the extractor, not a narrator over deterministic parsing — validate against real reports before trusting the numbers.
- `POST /api/income/declare` — manual monthly income/EMI entry
- `GET /api/payment/info`, `POST /api/payment/submit` — manual UPI: shows your UPI ID + the ₹10,000/₹6,000 split, applicant submits a transaction reference, status moves to `payment_submitted`. You confirm manually — the notification email includes the exact SQL to run in the D1 Console to flip it to `payment_done`. **Edit `UPI_ID` in `src/routes/payment.ts` before this is real.**
- `POST /api/documents/upload` — PAN/Aadhaar/selfie images, emailed to ops as an attachment, never written to D1/KV/anywhere. **Edit `OPS_EMAIL` in `src/routes/payment.ts` and `src/routes/documents.ts` before this is real.**
- `GET /api/dashboard` — applicant info, latest CIBIL report, latest income, application status
- Frontend (`/public`) — plain JS SPA covering the full loop: start → KYC or login → OTP → dashboard → CIBIL upload / income / payment / documents. Installable as a PWA. Functional, not designed.

## Not built

- Real payment gateway (Razorpay/Cashfree) — blocked on business merchant verification, not a code problem
- Automated bank-partner handoff for KYC documents — no such API exists yet; documents route above is the manual interim
- Admin/ops panel — payment and document confirmation both happen by hand via the D1 Console for now

## Before this is real, not just running

Two placeholder constants need your actual values:
- `src/routes/payment.ts` → `UPI_ID` (currently `"homnivas@upi"`)
- `src/routes/payment.ts` and `src/routes/documents.ts` → `OPS_EMAIL` (currently `"ops@homnivas.space"`)

## First-time setup

```bash
npm install
wrangler d1 create homnivas-db        # paste the id into wrangler.toml
wrangler kv namespace create OTP_KV   # paste the id into wrangler.toml
wrangler secret put JWT_SECRET
wrangler secret put PAN_PEPPER
wrangler secret put RESEND_API_KEY
wrangler secret put OPENROUTER_API_KEY
npm run db:migrate:remote
```

## Debugging

Every response includes a `requestId` when something fails — the frontend shows it as `(ref: xxxxxxxx)`. To find what actually happened: Cloudflare dashboard → the Worker → **Logs** tab, or `npx wrangler tail` for a live stream while you reproduce it. Search/filter by that ref. Every request is also logged on completion (method, path, status, duration), so a spike in 500s or slow requests is visible even without a specific ref to search for.

## Local dev

Create `.dev.vars` (gitignored) with the four secrets above, then:

```bash
npm run dev
```
