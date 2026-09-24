import { sendEmail, type SendResult } from "./email";

interface EmailEnv {
  RESEND_API_KEY: string;
}

export async function sendOtpEmail(
  env: EmailEnv,
  toEmail: string,
  otp: string
): Promise<SendResult> {
  return sendEmail(env, {
    to: toEmail,
    subject: `Your Homnivas verification code: ${otp}`,
    html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes. Do not share this code with anyone.</p>`,
  });
}
