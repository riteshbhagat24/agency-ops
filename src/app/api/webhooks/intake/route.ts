import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  client_code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  request_type: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  deadline: z.string().datetime().optional(),
  estimated_hours: z.number().optional(),
  requested_by_email: z.string().email(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.INTAKE_WEBHOOK_TOKEN}`) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Missing or invalid token' } },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'Invalid payload', details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseServiceClient();

  // Resolve client by code
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('client_code', input.client_code)
    .is('deleted_at', null)
    .single();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: { code: 'not_found', message: `Unknown client_code: ${input.client_code}` } },
      { status: 404 },
    );
  }

  // Resolve requester by email; create a placeholder if not present (CS will reassign)
  const { data: requester } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.requested_by_email)
    .single();

  // If no internal user matches, fall back to a generic intake bot user (super_admin)
  let requestedById = requester?.id;
  if (!requestedById) {
    const { data: fallback } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1)
      .single();
    requestedById = fallback?.id;
    if (!requestedById) {
      return NextResponse.json(
        { ok: false, error: { code: 'internal', message: 'No super_admin user to attribute intake to' } },
        { status: 500 },
      );
    }
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      client_id: client.id,
      title: input.title,
      description: input.description ?? null,
      request_type: input.request_type,
      priority: input.priority ?? 'medium',
      deadline: input.deadline ?? null,
      estimated_hours: input.estimated_hours ?? null,
      requested_by_id: requestedById,
      status: 'pending_classification',
      metadata: input.metadata ?? {},
    })
    .select('id, ticket_number')
    .single();

  if (error || !ticket) {
    return NextResponse.json(
      { ok: false, error: { code: 'internal', message: error?.message ?? 'Insert failed' } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/tickets/${ticket.id}`,
    },
  });
}
