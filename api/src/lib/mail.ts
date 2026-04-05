import nodemailer from 'nodemailer';
import { env } from '../config/env';

function useResend(): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

function useSmtp(): boolean {
  return Boolean(
    env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASS,
  );
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend HTTP ${res.status}: ${errBody}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Recipe AI — איפוס סיסמה / Password reset';
  const text =
    `שלום,\n\nלאיפוס הסיסמה לחצו על הקישור (בתוקף שעה אחת):\n${resetUrl}\n\n` +
    `אם לא ביקשתם איפוס — התעלמו מהודעה זו.\n\n---\n` +
    `Reset your Recipe AI password (link valid 1 hour):\n${resetUrl}\n`;
  const html = `<p>שלום,</p><p><a href="${resetUrl}">לחצו כאן לאיפוס הסיסמה</a> (תוקף: שעה אחת)</p><p>אם לא ביקשתם איפוס — התעלמו מהודעה זו.</p><hr/><p><a href="${resetUrl}">Reset your Recipe AI password</a> (valid 1 hour)</p>`;

  if (!useResend() && !useSmtp()) {
    if (env.NODE_ENV === 'development') {
      console.log('[mail] Password reset link (no mail transport):', resetUrl);
    } else {
      console.warn(
        '[mail] No RESEND_* or SMTP_* — password reset email was NOT sent',
      );
    }
    return;
  }

  if (useResend()) {
    await sendViaResend(to, subject, text, html);
    return;
  }

  const port = parseInt(env.SMTP_PORT!, 10);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 25_000,
    family: 4,
    tls: {
      minVersion: 'TLSv1.2' as const,
    },
  } as Parameters<typeof nodemailer.createTransport>[0]);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}
