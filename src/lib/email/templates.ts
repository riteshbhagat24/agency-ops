import 'server-only';

/**
 * Renders the HTML body of a notification email.
 *
 * Strategy: one minimal, table-based template that works in every email
 * client (Gmail, Outlook, Apple Mail). The event-specific content is
 * injected as a key/value table + a CTA button if the payload has a link.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Agency Ops';

export interface EmailPayload {
  type: string;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  recipientName?: string | null;
}

interface EventConfig {
  heading: string;
  intro: (p: Record<string, unknown>) => string;
  fields: Array<{ label: string; key: string; format?: (v: unknown, all: Record<string, unknown>) => string }>;
  ctaLabel: string;
  ctaPath: (p: Record<string, unknown>) => string | null;
  tone: 'info' | 'warning' | 'success' | 'danger';
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  task_assigned: {
    heading: 'New task assigned to you',
    intro: (p) => `A new task on the ${p.client_name ?? 'agency'} account is on your queue.`,
    fields: [
      { label: 'Task', key: 'task_title' },
      { label: 'Client', key: 'client_name' },
      { label: 'Ticket', key: 'ticket_number', format: (v) => `#${v}` },
      { label: 'Due', key: 'due_date', format: (v) => v ? formatDate(v as string) : 'No deadline' },
    ],
    ctaLabel: 'Open task',
    ctaPath: (p) => p.ticket_id ? `/tickets/${p.ticket_id}` : null,
    tone: 'info',
  },

  approval_requested: {
    heading: 'Approval required',
    intro: (p) => `${p.client_name ?? 'A client'} has a request that needs management approval.`,
    fields: [
      { label: 'Request', key: 'ticket_title' },
      { label: 'Client', key: 'client_name' },
      { label: 'Classification', key: 'classification', format: (v) => formatEnum(v as string) },
      { label: 'Stage', key: 'stage', format: (v) => formatEnum(v as string) },
      { label: 'Amount', key: 'amount', format: (v, p) => formatMoney(v, p.currency as string) },
    ],
    ctaLabel: 'Review',
    ctaPath: (p) => p.ticket_id ? `/tickets/${p.ticket_id}` : null,
    tone: 'warning',
  },

  approval_approved: {
    heading: 'Approval granted',
    intro: (p) => `The approval for ${p.client_name ?? 'this client'} has been recorded.`,
    fields: [
      { label: 'Request', key: 'ticket_title' },
      { label: 'Client', key: 'client_name' },
      { label: 'Stage', key: 'stage', format: (v) => formatEnum(v as string) },
      { label: 'Decision', key: 'decision' },
      { label: 'Amount', key: 'amount', format: (v, p) => formatMoney(v, p.currency as string) },
      { label: 'Comment', key: 'comment' },
    ],
    ctaLabel: 'Open ticket',
    ctaPath: (p) => p.ticket_id ? `/tickets/${p.ticket_id}` : null,
    tone: 'success',
  },

  approval_rejected: {
    heading: 'Approval rejected',
    intro: (p) => `The approval for ${p.client_name ?? 'this client'} was rejected.`,
    fields: [
      { label: 'Request', key: 'ticket_title' },
      { label: 'Client', key: 'client_name' },
      { label: 'Stage', key: 'stage', format: (v) => formatEnum(v as string) },
      { label: 'Comment', key: 'comment' },
    ],
    ctaLabel: 'Open ticket',
    ctaPath: (p) => p.ticket_id ? `/tickets/${p.ticket_id}` : null,
    tone: 'danger',
  },

  invoice_created: {
    heading: 'New invoice draft',
    intro: (p) => `A new invoice for ${p.client_name ?? 'a client'} is ready for review.`,
    fields: [
      { label: 'Invoice', key: 'invoice_number' },
      { label: 'Client', key: 'client_name' },
      { label: 'Amount', key: 'amount', format: (v, p) => formatMoney(v, p.currency as string) },
      { label: 'Due', key: 'due_at', format: (v) => v ? formatDate(v as string) : '—' },
    ],
    ctaLabel: 'Open invoice',
    ctaPath: (p) => p.invoice_id ? `/invoices/${p.invoice_id}` : null,
    tone: 'info',
  },

  payment_reminder: {
    heading: 'Payment due soon',
    intro: (p) => `Heads up — invoice ${p.invoice_number} is approaching its due date.`,
    fields: [
      { label: 'Invoice', key: 'invoice_number' },
      { label: 'Client', key: 'client_name' },
      { label: 'Amount', key: 'amount', format: (v, p) => formatMoney(v, p.currency as string) },
      { label: 'Due', key: 'due_at', format: (v) => v ? formatDate(v as string) : '—' },
    ],
    ctaLabel: 'Follow up',
    ctaPath: (p) => p.invoice_id ? `/invoices/${p.invoice_id}` : null,
    tone: 'warning',
  },
};

// Catch-all for invoice_sent / invoice_paid / etc.
function getConfig(type: string): EventConfig {
  if (EVENT_CONFIG[type]) return EVENT_CONFIG[type];
  if (type.startsWith('invoice_')) {
    const status = type.replace('invoice_', '');
    return {
      heading: `Invoice marked ${status.replace('_', ' ')}`,
      intro: (p) => `Invoice ${p.invoice_number} for ${p.client_name ?? 'a client'} is now ${status}.`,
      fields: [
        { label: 'Invoice', key: 'invoice_number' },
        { label: 'Client', key: 'client_name' },
        { label: 'Amount', key: 'amount', format: (v, p) => formatMoney(v, p.currency as string) },
        { label: 'Status', key: 'status' },
      ],
      ctaLabel: 'Open invoice',
      ctaPath: (p) => (p.invoice_id ? `/invoices/${p.invoice_id}` : null),
      tone: status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : 'info',
    };
  }
  // Fallback for unknown event types: still send something readable
  return {
    heading: 'Notification',
    intro: () => 'You have a new notification in Agency Ops.',
    fields: [],
    ctaLabel: 'Open Agency Ops',
    ctaPath: () => '/dashboard',
    tone: 'info',
  };
}

const TONE_COLORS: Record<EventConfig['tone'], { bg: string; text: string }> = {
  info: { bg: '#eff6ff', text: '#1d4ed8' },
  warning: { bg: '#fff7ed', text: '#c2410c' },
  success: { bg: '#ecfdf5', text: '#047857' },
  danger: { bg: '#fef2f2', text: '#b91c1c' },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function formatMoney(v: unknown, currency: string = 'INR'): string {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

function formatEnum(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderEmail({ type, payload, recipientName }: EmailPayload): {
  html: string;
  text: string;
} {
  const cfg = getConfig(type);
  const tone = TONE_COLORS[cfg.tone];
  const ctaPath = cfg.ctaPath(payload);
  const ctaUrl = ctaPath ? `${APP_URL}${ctaPath}` : null;

  const rows = cfg.fields
    .map((f) => {
      const raw = payload[f.key];
      if (raw == null || raw === '') return null;
      const display = f.format ? f.format(raw, payload) : String(raw);
      return { label: f.label, value: display };
    })
    .filter((r): r is { label: string; value: string } => r !== null);

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(APP_NAME)}</div>
          <div style="margin-top:4px;font-size:18px;color:#0f172a;font-weight:600;">${escapeHtml(cfg.heading)}</div>
        </td></tr>

        <tr><td style="padding:20px 24px;">
          ${recipientName ? `<p style="margin:0 0 12px 0;font-size:14px;color:#334155;">Hi ${escapeHtml(recipientName.split(' ')[0] ?? recipientName)},</p>` : ''}
          <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.5;">${escapeHtml(cfg.intro(payload))}</p>

          ${rows.length > 0 ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:0 0 16px 0;">
            ${rows
              .map(
                (r, i) => `<tr>
                  <td style="padding:10px 14px;${i > 0 ? 'border-top:1px solid #e2e8f0;' : ''}font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;width:35%;">${escapeHtml(r.label)}</td>
                  <td style="padding:10px 14px;${i > 0 ? 'border-top:1px solid #e2e8f0;' : ''}font-size:14px;color:#0f172a;">${escapeHtml(r.value)}</td>
                </tr>`,
              )
              .join('')}
          </table>` : ''}

          ${ctaUrl ? `
          <p style="margin:20px 0 0 0;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:${tone.text};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${escapeHtml(cfg.ctaLabel)} →</a>
          </p>` : ''}
        </td></tr>

        <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
          You're receiving this because you're in the routing for this event.<br>
          <a href="${APP_URL}" style="color:#64748b;text-decoration:none;">${escapeHtml(APP_NAME)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    cfg.heading,
    '',
    cfg.intro(payload),
    '',
    ...rows.map((r) => `${r.label}: ${r.value}`),
    ...(ctaUrl ? ['', `Open: ${ctaUrl}`] : []),
    '',
    '— Agency Ops',
  ].join('\n');

  return { html, text };
}
