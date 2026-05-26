import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  ticket_id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  actor_label: z.string().min(3),
  comment: z.string().optional(),
  attachment_url: z.string().url().optional(),
});

/**
 * Used by n8n WhatsApp / email approval flows to push a client decision back.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.APPROVAL_CALLBACK_TOKEN}`) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Missing or invalid token' } },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'Invalid payload' } },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseServiceClient();

  await supabase.from('approvals').insert({
    ticket_id: input.ticket_id,
    stage: 'pending_client',
    decision: input.decision,
    actor_label: input.actor_label,
    comment:
      input.comment + (input.attachment_url ? `\nProof: ${input.attachment_url}` : ''),
  });

  await supabase
    .from('tickets')
    .update({
      approval_stage: input.decision === 'approved' ? 'approved' : 'rejected',
      status: input.decision === 'approved' ? 'approved' : 'rejected',
    })
    .eq('id', input.ticket_id);

  return NextResponse.json({ ok: true, data: { ticket_id: input.ticket_id } });
}
