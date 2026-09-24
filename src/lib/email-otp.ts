// Sends the OTP via Resend (https://resend.com). No business/telecom
// verification needed beyond a domain verified in your Resend account —
// this is the low-friction path compared to WhatsApp Cloud API (Meta
// Business verification) or SMS (India DLT/Principal Entity registration).

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Homnivas <otp@homnivas.space>"; // must be a domain verified in Resend

interface EmailEnv {
  RESEND_API_KEY: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendOtpEmail(
  env: EmailEnv,
  toEmail: string,
  otp: string
): Promise<SendResult> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [toEmail],
      subject: `Your Homnivas verification code: ${otp}`,
      html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes. Do not share this code with anyone.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend API ${res.status}: ${body}` };
  }
  return { ok: true };
}
