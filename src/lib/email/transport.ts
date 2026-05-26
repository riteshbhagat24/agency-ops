import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

/**
 * Lazy-initialized SMTP transporter, reused across requests in the same Node
 * process. Reads SMTP settings from environment variables:
 *
 *   SMTP_HOST              required, e.g. smtp.gmail.com
 *   SMTP_PORT              default 587
 *   SMTP_SECURE            'true' for SSL/465, 'false' for STARTTLS/587 (default)
 *   SMTP_USER              required, e.g. notifications@futureadymedia.com
 *   SMTP_PASS              required (use Gmail App Password if SMTP_HOST is Gmail)
 *   EMAIL_FROM             required, e.g. "Agency Ops <noreply@futureadymedia.com>"
 */
export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in your environment.',
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return _transporter;
}

export function getDefaultFrom(): string {
  return process.env.EMAIL_FROM ?? 'Agency Ops <noreply@example.com>';
}
