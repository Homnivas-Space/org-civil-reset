// OTP storage and verification, backed by Cloudflare KV.
// - expiresAt is stored explicitly and checked in-app; KV's own
//   expirationTtl is just a backstop cleanup so a re-put on a wrong
//   attempt can't silently extend the real expiry window.
// - single-use: verifyOtp deletes the record on success.
// - attempt-limited: 5 wrong guesses kills the code outright.

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const KV_MIN_TTL_SECONDS = 60; // Cloudflare KV won't accept less than this

interface OtpRecord {
  code: string;
  attempts: number;
  expiresAt: number; // epoch ms
}

function otpKey(applicantId: string): string {
  return `otp:${applicantId}`;
}

function generateOtp(): string {
  // crypto.getRandomValues, not Math.random() — this gates access to
  // someone's credit report and card status.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const num = buf[0] % 10 ** OTP_LENGTH;
  return num.toString().padStart(OTP_LENGTH, "0");
}

/** Generates a fresh OTP and stores it, replacing any prior code for this applicant. */
export async function createOtp(
  kv: KVNamespace,
  applicantId: string
): Promise<string> {
  const code = generateOtp();
  const record: OtpRecord = {
    code,
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  await kv.put(otpKey(applicantId), JSON.stringify(record), {
    expirationTtl: OTP_TTL_SECONDS,
  });
  return code;
}

export type VerifyResult = "ok" | "invalid" | "expired" | "too_many_attempts";

/** Checks a submitted code. Deletes it on success (single-use) or on lockout. */
export async function verifyOtp(
  kv: KVNamespace,
  applicantId: string,
  submitted: string
): Promise<VerifyResult> {
  const key = otpKey(applicantId);
  const raw = await kv.get(key);
  if (!raw) return "expired"; // never existed, already used, or TTL swept it

  const record: OtpRecord = JSON.parse(raw);

  if (Date.now() > record.expiresAt) {
    await kv.delete(key);
    return "expired";
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await kv.delete(key);
    return "too_many_attempts";
  }

  if (record.code !== submitted) {
    record.attempts += 1;
    const remainingTtl = Math.max(
      KV_MIN_TTL_SECONDS,
      Math.ceil((record.expiresAt - Date.now()) / 1000)
    );
    await kv.put(key, JSON.stringify(record), { expirationTtl: remainingTtl });
    return "invalid";
  }

  await kv.delete(key);
  return "ok";
}
