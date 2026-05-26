import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Daily cron — queues AM payment reminders for invoices due in the next N days.
 * Triggered by Vercel Cron daily.
 */
export async function GET(request: NextRequest) {
  if (
    request.headers.get('x-vercel-cron') !== '1' &&
    request.headers.get('authorization') !== `Bearer ${process.env.DISPATCH_RUN_TOKEN}`
  ) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Missing/invalid token' } },
      { status: 401 },
    );
  }

  const daysAhead = Number(new URL(request.url).searchParams.get('days') ?? '3');

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('queue_payment_reminders', {
    p_days_ahead: daysAhead,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'rpc_failed', message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { reminders_queued: data ?? 0 } });
}
