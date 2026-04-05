import nodemailer from 'nodemailer';
import { env } from '../config/env';

function smtpConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASS,
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Recipe AI — איפוס סיסמה / Password reset';
  const text =
    `שלום,\n\nלאיפוס הסיסמה לחצו על הקישור (בתוקף שעה אחת):\n${resetUrl}\n\n` +
    `אם לא ביקשתם איפוס — התעלמו מהודעה זו.\n\n---\n` +
    `Reset your Recipe AI password (link valid 1 hour):\n${resetUrl}\n`;
  const html = `<p>שלום,</p><p><a href="${resetUrl}">לחצו כאן לאיפוס הסיסמה</a> (תוקף: שעה אחת)</p><p>אם לא ביקשתם איפוס — התעלמו מהודעה זו.</p><hr/><p><a href="${resetUrl}">Reset your Recipe AI password</a> (valid 1 hour)</p>`;

  if (!smtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      console.log('[mail] Password reset link (SMTP not configured):', resetUrl);
    } else {
      console.warn('[mail] SMTP not configured — password reset email was NOT sent');
    }
    return;
  }

  const port = parseInt(env.SMTP_PORT!, 10);
  // smtp-connection supports extra fields (family, timeouts) not in @types/nodemailer
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
