// Generic Resend sender — email-otp.ts and anything that needs to notify
// ops (payment submissions, document handoff) both go through this.

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Homnivas <otp@homnivas.space>"; // must be a domain verified in Resend

interface EmailEnv {
  RESEND_API_KEY: string;
}

interface Attachment {
  filename: string;
  content: string; // base64, no "data:" prefix
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(
  env: EmailEnv,
  opts: { to: string; subject: string; html: string; attachments?: Attachment[] }
): Promise<SendResult> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend API ${res.status}: ${body}` };
  }
  return { ok: true };
}
