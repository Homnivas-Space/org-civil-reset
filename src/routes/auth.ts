import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { createOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email-otp";
import { hashPanDob } from "../lib/pan";

type Bindings = {
  DB: D1Database;
  OTP_KV: KVNamespace;
  JWT_SECRET: string;
  PAN_PEPPER: string;
  RESEND_API_KEY: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

const SESSION_TTL_SECONDS = 30 * 60; // 30 min

// Step 1: PAN + DOB -> look up applicant, send OTP to their registered email.
auth.post("/login/start", async (c) => {
  const { pan, dob } = await c.req.json<{ pan?: string; dob?: string }>();

  if (!pan || !dob) {
    return c.json({ error: "pan and dob are required" }, 400);
  }

  const hash = await hashPanDob(pan.trim().toUpperCase(), dob, c.env.PAN_PEPPER);

  const applicant = await c.env.DB.prepare(
    "SELECT id, email FROM applicants WHERE pan_dob_hash = ?"
  )
    .bind(hash)
    .first<{ id: string; email: string }>();

  // Same response whether or not the applicant exists — don't let this
  // endpoint be used to confirm which PANs are registered.
  if (!applicant) {
    return c.json({ ok: true });
  }

  const otp = await createOtp(c.env.OTP_KV, applicant.id);
  const result = await sendOtpEmail(c.env, applicant.email, otp);

  if (!result.ok) {
    console.error(result.error);
    return c.json({ error: "Could not send the code, try again" }, 502);
  }

  return c.json({ ok: true, applicantId: applicant.id });
});

// Step 2: OTP -> verify, issue session cookie.
auth.post("/login/verify", async (c) => {
  const { applicantId, otp } = await c.req.json<{
    applicantId?: string;
    otp?: string;
  }>();

  if (!applicantId || !otp) {
    return c.json({ error: "applicantId and otp are required" }, 400);
  }

  const result = await verifyOtp(c.env.OTP_KV, applicantId, otp.trim());

  if (result !== "ok") {
    const messages: Record<string, string> = {
      invalid: "Incorrect code",
      expired: "Code expired — request a new one",
      too_many_attempts: "Too many attempts — request a new code",
    };
    return c.json({ error: messages[result] ?? "Verification failed" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: applicantId, iat: now, exp: now + SESSION_TTL_SECONDS },
    c.env.JWT_SECRET
  );

  setCookie(c, "session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return c.json({ ok: true });
});

export default auth;
