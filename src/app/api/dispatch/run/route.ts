import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getDefaultFrom, getTransporter } from '@/lib/email/transport';
import { renderEmail } from '@/lib/email/templates';

/**
 * Drains the `notification_dispatch` queue and sends emails via SMTP.
 *
 * Auth: either the Vercel cron header `x-vercel-cron: 1`, or
 * `Authorization: Bearer $DISPATCH_RUN_TOKEN`.
 *
 * For each pending row:
 *   • Look up the recipient's email from `users`
 *   • Render HTML + plain-text from event-specific template
 *   • Send via nodemailer (configured via SMTP_* env vars)
 *   • Mark row sent / failed and bump attempts
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Missing/invalid token' } },
      { status: 401 },
    );
  }

  let transporter;
  try {
    transporter = getTransporter();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'smtp_not_configured',
          message: err instanceof Error ? err.message : 'SMTP error',
        },
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseServiceClient();

  // Pull pending dispatch rows + the recipient's user row (email + name)
  const { data: queue, error: queueErr } = await supabase
    .from('notification_dispatch')
    .select(
      'id, user_id, channel, type, subject, body, payload, attempts, users:users!notification_dispatch_user_id_fkey(email, full_name, is_active)',
    )
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(50);

  if (queueErr) {
    return NextResponse.json(
      { ok: false, error: { code: 'query_failed', message: queueErr.message } },
      { status: 500 },
    );
  }

  if (!queue || queue.length === 0) {
    return NextResponse.json({ ok: true, data: { processed: 0, sent: 0, failed: 0 } });
  }

  const from = getDefaultFrom();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of queue as Array<{
    id: string;
    user_id: string;
    type: string;
    subject: string;
    body: string;
    payload: Record<string, unknown>;
    attempts: number;
    users: { email: string; full_name: string; is_active: boolean } | null;
  }>) {
    const recipient = item.users;

    // Skip silently if user is missing/inactive — mark as sent so we don't retry forever
    if (!recipient || !recipient.is_active || !recipient.email) {
      await supabase
        .from('notification_dispatch')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: 'recipient inactive or missing',
        })
        .eq('id', item.id);
      skipped++;
      continue;
    }

    try {
      const { html, text } = renderEmail({
        type: item.type,
        subject: item.subject,
        body: item.body,
        payload: item.payload ?? {},
        recipientName: recipient.full_name,
      });

      await transporter.sendMail({
        from,
        to: `${recipient.full_name} <${recipient.email}>`,
        subject: item.subject,
        text,
        html,
      });

      await supabase
        .from('notification_dispatch')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: (item.attempts ?? 0) + 1,
        })
        .eq('id', item.id);
      sent++;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'unknown error';
      const newAttempts = (item.attempts ?? 0) + 1;
      await supabase
        .from('notification_dispatch')
        .update({
          status: newAttempts >= 5 ? 'failed' : 'pending',
          attempts: newAttempts,
          last_error: errorMessage,
        })
        .eq('id', item.id);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    data: { processed: queue.length, sent, failed, skipped },
  });
}

function authorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  const auth = req.headers.get('authorization');
  const token = process.env.DISPATCH_RUN_TOKEN;
  if (!token) return false;
  return auth === `Bearer ${token}`;
}
