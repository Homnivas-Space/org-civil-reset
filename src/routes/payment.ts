import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { sendEmail } from "../lib/email";

type Bindings = { DB: D1Database; JWT_SECRET: string; RESEND_API_KEY: string };
type Variables = { applicantId: string };

const payment = new Hono<{ Bindings: Bindings; Variables: Variables }>();
payment.use("*", requireAuth);

// TODO: replace with your real UPI VPA and ops inbox.
const UPI_ID = "homnivas@upi";
const OPS_EMAIL = "ops@homnivas.space";

payment.get("/info", async (c) => {
  const applicantId = c.get("applicantId");
  const application = await c.env.DB.prepare(
    `SELECT capital_allocation_amount, professional_retainer_amount, status
     FROM applications WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(applicantId)
    .first<{
      capital_allocation_amount: number;
      professional_retainer_amount: number;
      status: string;
    }>();

  if (!application) {
    return c.json({ error: "No application found" }, 404);
  }

  return c.json({
    upiId: UPI_ID,
    capitalAllocation: application.capital_allocation_amount,
    professionalRetainer: application.professional_retainer_amount,
    total: application.capital_allocation_amount + application.professional_retainer_amount,
    status: application.status,
  });
});

interface SubmitBody {
  utr?: string;
}

// Manual reconciliation, on purpose — see the note in the chat: Razorpay/
// Cashfree both gate on business-merchant verification, the same category
// of friction as the WhatsApp Business Platform you ruled out. This needs
// nothing but a UPI ID. The ops notification below includes the exact SQL
// to run in the D1 Console to confirm — no admin panel built for this yet.
payment.post("/submit", async (c) => {
  const applicantId = c.get("applicantId");
  const { utr } = await c.req.json<SubmitBody>();

  if (!utr || utr.trim().length < 4) {
    return c.json({ error: "utr (the UPI transaction reference) is required" }, 400);
  }

  const application = await c.env.DB.prepare(
    "SELECT id FROM applications WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(applicantId)
    .first<{ id: string }>();

  if (!application) {
    return c.json({ error: "No application found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  const cleanUtr = utr.trim();

  await c.env.DB.prepare(
    `UPDATE applications
     SET status = 'payment_submitted', payment_ref = ?, payment_method = 'manual_upi', updated_at = ?
     WHERE id = ?`
  )
    .bind(cleanUtr, now, application.id)
    .run();

  const applicant = await c.env.DB.prepare(
    "SELECT name, email FROM applicants WHERE id = ?"
  )
    .bind(applicantId)
    .first<{ name: string; email: string }>();

  const notifyResult = await sendEmail(c.env, {
    to: OPS_EMAIL,
    subject: `Payment submitted — ${applicant?.name ?? applicantId}`,
    html: `<p>${applicant?.name ?? "An applicant"} (${applicant?.email ?? applicantId}) submitted UPI reference <strong>${cleanUtr}</strong>.</p>
           <p>Verify it landed in your UPI account, then in the D1 Console run:</p>
           <pre>UPDATE applications SET status='payment_done', paid_at=${now} WHERE id='${application.id}';</pre>`,
  });
  if (!notifyResult.ok) {
    console.error(notifyResult.error);
    // The applicant's submission is saved regardless — don't fail their
    // request over a notification hiccup.
  }

  return c.json({ ok: true, status: "payment_submitted" });
});

export default payment;
