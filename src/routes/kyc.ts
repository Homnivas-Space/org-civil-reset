import { Hono } from "hono";
import { hashPanDob } from "../lib/pan";

type Bindings = {
  DB: D1Database;
  PAN_PEPPER: string;
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
  dob?: string;       // whatever format the form uses — login must send this back identically
  pan?: string;
  aadhaar?: string;    // full number accepted here, but only last 4 ever get stored
  mobile?: string;
}

// Typed-field intake only — no document photos, no selfie, no payment.
// Those are separate, undecided pieces (image handling + bank/ops handoff,
// payment gateway choice) — this just creates the applicant record so
// login has something to find.
kyc.post("/submit", async (c) => {
  const body = await c.req.json<KycBody>();
  const { name, email, dob, pan, aadhaar, mobile } = body;

  if (!name || !email || !dob || !pan) {
    return c.json({ error: "name, email, dob, and pan are required" }, 400);
  }

  const cleanPan = pan.trim().toUpperCase();
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
        email.trim().toLowerCase(),
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
    // Most likely cause: UNIQUE constraint on pan_dob_hash or email —
    // someone submitting the same PAN+DOB or email twice.
    console.error(err);
    return c.json(
      { error: "An application already exists for this PAN or email" },
      409
    );
  }

  return c.json({ ok: true, applicantId });
});

export default kyc;
