import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { sendEmail } from "../lib/email";

type Bindings = { DB: D1Database; JWT_SECRET: string; RESEND_API_KEY: string };
type Variables = { applicantId: string };

const documents = new Hono<{ Bindings: Bindings; Variables: Variables }>();
documents.use("*", requireAuth);

// TODO: replace with your ops team's real inbox.
const OPS_EMAIL = "ops@homnivas.space";

interface DocBody {
  kind?: "pan" | "aadhaar" | "selfie";
  filename?: string;
  contentBase64?: string; // raw base64, no "data:" prefix
}

// No bank-partner API exists yet, so this is the honest interim: forward
// the image straight to ops for manual verification/bank handoff, and
// never write it anywhere on this end — same no-storage principle as
// everything else. This route is what gets replaced once a real bank
// integration exists.
documents.post("/upload", async (c) => {
  const applicantId = c.get("applicantId");
  const { kind, filename, contentBase64 } = await c.req.json<DocBody>();

  if (!kind || !filename || !contentBase64) {
    return c.json({ error: "kind, filename, and contentBase64 are required" }, 400);
  }
  if (!["pan", "aadhaar", "selfie"].includes(kind)) {
    return c.json({ error: "kind must be pan, aadhaar, or selfie" }, 400);
  }

  const applicant = await c.env.DB.prepare(
    "SELECT name, email FROM applicants WHERE id = ?"
  )
    .bind(applicantId)
    .first<{ name: string; email: string }>();

  const result = await sendEmail(c.env, {
    to: OPS_EMAIL,
    subject: `KYC document (${kind}) — ${applicant?.name ?? applicantId}`,
    html: `<p>${kind} document uploaded by ${applicant?.name ?? "unknown"} (${applicant?.email ?? applicantId}).</p><p>Applicant ID: ${applicantId}</p>`,
    attachments: [{ filename, content: contentBase64 }],
  });

  if (!result.ok) {
    console.error(result.error);
    return c.json({ error: "Could not deliver the document, try again" }, 502);
  }

  return c.json({ ok: true });
});

export default documents;
