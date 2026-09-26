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
  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
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
  } catch (err) {
    // fetch() throws on network-level failures (DNS, connection refused,
    // TLS) — distinct from a bad HTTP status, which is handled below.
    // Previously this was unguarded, so a network blip here became an
    // uncaught exception all the way up to the global error handler.
    return {
      ok: false,
      error: `Resend network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend API ${res.status}: ${body}` };
  }
  return { ok: true };
}
