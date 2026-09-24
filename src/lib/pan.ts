// Deterministic, keyed hash of PAN+DOB used as a lookup index in D1.
// Login never needs the raw PAN — only enough to match what was captured
// at KYC time. Use this same function when writing the applicant row at
// signup, so the hash computed here actually matches something in D1.
//
// PAN_PEPPER is a secret (set via `wrangler secret put PAN_PEPPER`), never
// the same value as JWT_SECRET. Without the pepper, the hash can't be
// brute-forced offline even if the D1 table leaks.

export async function hashPanDob(
  pan: string,
  dob: string,
  pepper: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${pan}|${dob}`)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Call this at KYC-form-submit time, before the row is written:
//   const pan_dob_hash = await hashPanDob(pan.trim().toUpperCase(), dob, env.PAN_PEPPER);
// Normalize the same way every time (trim + uppercase PAN, same DOB format)
// or login will silently never match.
