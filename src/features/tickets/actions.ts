'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { canApprove, canClassify } from '@/lib/auth/rbac';
import {
  classifyTicketSchema,
  createTicketSchema,
  managementApprovalSchema,
  recordClientApprovalSchema,
} from '@/lib/validations/tickets';

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTicket(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; ticket_number: number }>> {
  const user = await requireUser();
  const parsed = createTicketSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Insert with classification NULL — the BEFORE UPDATE OF classification
  // trigger only fires on UPDATE, so we set classification in step 2
  // to trigger the routing (status, approval_stage, approvals row, etc.).
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      client_id: input.client_id,
      title: input.title,
      description: input.description ?? null,
      request_type: input.request_type,
      classification: null,
      priority: input.priority,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
      estimated_hours: input.estimated_hours ?? null,
      estimated_amount: input.estimated_amount ?? null,
      assigned_team: input.assigned_team ?? null,
      requested_by_id: user.id,
      parent_ticket_id: input.parent_ticket_id ?? null,
      status: 'pending_classification',
    } as Record<string, unknown>)
    .select('id, ticket_number')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not create ticket' };
  }

  // Now route via UPDATE → trigger fires → status, approval_stage, approvals row
  const { error: routeErr } = await supabase
    .from('tickets')
    .update({ classification: input.classification })
    .eq('id', data.id);

  if (routeErr) {
    return {
      ok: false,
      error: `Ticket created but classification routing failed: ${routeErr.message}`,
    };
  }

  revalidatePath('/tickets');
  revalidatePath('/dashboard');
  revalidatePath('/approvals');
  return { ok: true, data };
}

export async function classifyTicket(id: string, rawInput: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!canClassify(user.role)) {
    return { ok: false, error: 'Not authorized to classify tickets' };
  }
  const parsed = classifyTicketSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid classification' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('tickets')
    .update({ classification: parsed.data.classification })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (parsed.data.comment) {
    await supabase.from('comments').insert({
      entity_type: 'ticket',
      entity_id: id,
      author_id: user.id,
      body: `Classification → ${parsed.data.classification}: ${parsed.data.comment}`,
    });
  }
  revalidatePath(`/tickets/${id}`);
  revalidatePath('/tickets');
  return { ok: true, data: null };
}

export async function managementApprove(id: string, rawInput: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!canApprove(user.role)) {
    return { ok: false, error: 'Only management can approve' };
  }
  const parsed = managementApprovalSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();

  // Load classification to decide where to route next
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, classification')
    .eq('id', id)
    .single();
  if (!ticket) return { ok: false, error: 'Ticket not found' };

  const { error: approvalErr } = await supabase.from('approvals').insert({
    ticket_id: id,
    stage: 'pending_management',
    decision: parsed.data.decision,
    actor_id: user.id,
    comment: parsed.data.comment ?? null,
  });
  if (approvalErr) return { ok: false, error: `Could not log approval: ${approvalErr.message}` };

  let updateErr;
  if (parsed.data.decision === 'rejected') {
    ({ error: updateErr } = await supabase
      .from('tickets')
      .update({ approval_stage: 'rejected', status: 'rejected' })
      .eq('id', id));
  } else {
    const nextStage = ticket.classification === 'extra_billable' ? 'pending_client' : 'approved';
    ({ error: updateErr } = await supabase
      .from('tickets')
      .update({
        approval_stage: nextStage,
        status: nextStage === 'approved' ? 'approved' : 'waiting_approval',
      })
      .eq('id', id));
  }
  if (updateErr) return { ok: false, error: `Ticket update failed: ${updateErr.message}` };

  revalidatePath(`/tickets/${id}`);
  revalidatePath('/approvals');
  revalidatePath('/dashboard');
  revalidatePath('/invoices');
  return { ok: true, data: null };
}

export async function recordClientApproval(id: string, rawInput: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = recordClientApprovalSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();
  const { error: approvalErr } = await supabase.from('approvals').insert({
    ticket_id: id,
    stage: 'pending_client',
    decision: parsed.data.decision,
    actor_id: null,
    actor_label: parsed.data.actor_label,
    comment: parsed.data.comment ?? null,
  });
  if (approvalErr) return { ok: false, error: `Could not log approval: ${approvalErr.message}` };

  let updateErr;
  if (parsed.data.decision === 'rejected') {
    ({ error: updateErr } = await supabase
      .from('tickets')
      .update({ approval_stage: 'rejected', status: 'rejected' })
      .eq('id', id));
  } else {
    ({ error: updateErr } = await supabase
      .from('tickets')
      .update({ approval_stage: 'approved', status: 'approved' })
      .eq('id', id));
  }
  if (updateErr) return { ok: false, error: `Ticket update failed: ${updateErr.message}` };

  await supabase.from('comments').insert({
    entity_type: 'ticket',
    entity_id: id,
    author_id: user.id,
    body: `Client decision recorded: ${parsed.data.decision} via ${parsed.data.actor_label}`,
  });

  revalidatePath(`/tickets/${id}`);
  revalidatePath('/approvals');
  revalidatePath('/invoices');
  return { ok: true, data: null };
}

/** Mark a ticket as Delivered — final state, locks billables, sends invoice to "sent". */
export async function markTicketDelivered(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'delivered' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await supabase.from('comments').insert({
    entity_type: 'ticket',
    entity_id: id,
    author_id: user.id,
    body: 'Marked as delivered.',
  });

  revalidatePath(`/tickets/${id}`);
  revalidatePath('/tickets');
  revalidatePath('/invoices');
  return { ok: true, data: null };
}

export async function addTicketComment(ticketId: string, body: string): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: 'Empty comment' };
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('comments').insert({
    entity_type: 'ticket',
    entity_id: ticketId,
    author_id: user.id,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true, data: null };
}

export async function updateTicketStatus(
  id: string,
  status:
    | 'in_progress'
    | 'completed'
    | 'delivered'
    | 'on_hold'
    | 'cancelled',
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tickets/${id}`);
  revalidatePath('/tickets');
  revalidatePath('/billing');
  return { ok: true, data: null };
}

export async function createTicketAndRedirect(rawInput: unknown) {
  const result = await createTicket(rawInput);
  if (!result.ok) return result;
  redirect(`/tickets/${result.data.id}`);
}
