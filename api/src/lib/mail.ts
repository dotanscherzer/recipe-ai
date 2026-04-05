import nodemailer from 'nodemailer';
import { env } from '../config/env';

function smtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
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
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}
