import { Hono } from "hono";
import { hashPanDob } from "../lib/pan";
import { createOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email-otp";

type Bindings = {
  DB: D1Database;
  PAN_PEPPER: string;
  OTP_KV: KVNamespace;
  RESEND_API_KEY: string;
};

const kyc = new Hono<{ Bindings: Bindings }>();

function maskPan(pan: string): string {
  const clean = pan.trim().toUpperCase();
  return "X".repeat(Math.max(clean.length - 4, 0)) + clean.slice(-4);
}

function last4Digits(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

interface KycBody {
  name?: string;
  email?: string;
  dob?: string;
  pan?: string;
  aadhaar?: string;
  mobile?: string;
}

// Typed-field intake only — no document photos, no selfie, no payment.
// On success, immediately sends the login OTP so a new applicant flows
// straight into verification instead of re-entering PAN+DOB right after
// just submitting it.
kyc.post("/submit", async (c) => {
  const body = await c.req.json<KycBody>();
  const { name, email, dob, pan, aadhaar, mobile } = body;

  if (!name || !email || !dob || !pan) {
    return c.json({ error: "name, email, dob, and pan are required" }, 400);
  }

  const cleanPan = pan.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const panDobHash = await hashPanDob(cleanPan, dob, c.env.PAN_PEPPER);
  const applicantId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO applicants
          (id, pan_dob_hash, pan_masked, name, email, mobile, aadhaar_last4, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        applicantId,
        panDobHash,
        maskPan(cleanPan),
        name.trim(),
        cleanEmail,
        mobile?.trim() ?? null,
        aadhaar ? last4Digits(aadhaar) : null,
        now
      ),
      c.env.DB.prepare(
        `INSERT INTO applications
          (id, applicant_id, status, created_at, updated_at)
         VALUES (?, ?, 'account_opened', ?, ?)`
      ).bind(crypto.randomUUID(), applicantId, now, now),
    ]);
  } catch (err) {
    console.error(err);
    return c.json(
      { error: "An application already exists for this PAN or email" },
      409
    );
  }

  const otp = await createOtp(c.env.OTP_KV, applicantId);
  const sendResult = await sendOtpEmail(c.env, cleanEmail, otp);
  if (!sendResult.ok) {
    console.error(sendResult.error);
    // The applicant record exists either way — don't fail signup over a
    // delivery hiccup, the frontend can offer "resend code."
    return c.json({ ok: true, applicantId, otpSent: false });
  }

  return c.json({ ok: true, applicantId, otpSent: true });
});

export default kyc;
