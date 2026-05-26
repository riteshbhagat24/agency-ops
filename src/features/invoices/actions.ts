'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { updateInvoiceSchema, addInvoiceLineItemSchema } from '@/lib/validations/invoices';

const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'written_off'] as const;

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  invoice_ref: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function updateInvoiceStatus(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin', 'management', 'accounts');
  const parsed = updateStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id, status, notes } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'sent') patch.issued_at = new Date().toISOString();
  if (status === 'paid') patch.paid_at = new Date().toISOString();
  if (notes) patch.notes = notes;

  const { error } = await supabase.from('invoices').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Cascade billable status when the invoice closes out
  const billableStatus =
    status === 'paid'
      ? 'billed'
      : status === 'cancelled' || status === 'written_off'
        ? 'written_off'
        : null;
  if (billableStatus) {
    await supabase.from('billables').update({ status: billableStatus }).eq('invoice_id', id);
  }

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

export async function markInvoicePaid(id: string, reference?: string) {
  return updateInvoiceStatus({ id, status: 'paid', invoice_ref: reference });
}

/**
 * Editable fields: notes, due date, manual subtotal override, tax rate override.
 * If subtotal/tax_rate are overridden, recompute tax_amount + total.
 */
export async function updateInvoice(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin', 'management', 'accounts');
  const parsed = updateInvoiceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();

  // Fetch current values so we can recompute totals consistently
  const { data: current } = await supabase
    .from('invoices')
    .select('subtotal, tax_rate')
    .eq('id', parsed.data.id)
    .single();
  if (!current) return { ok: false, error: 'Invoice not found' };

  const subtotal =
    parsed.data.subtotal_override != null ? parsed.data.subtotal_override : current.subtotal;
  const taxRate =
    parsed.data.tax_rate_override != null ? parsed.data.tax_rate_override : current.tax_rate;
  const taxAmount = Math.round(subtotal * taxRate) / 100;

  const patch: Record<string, unknown> = {
    notes: parsed.data.notes ?? null,
    due_at: parsed.data.due_at ?? null,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total: subtotal + taxAmount,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('invoices').update(patch).eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${parsed.data.id}`);
  return { ok: true };
}

/**
 * Add a custom line item (one not tied to a ticket — e.g. setup fee,
 * platform charge). Inserts a synthetic billable row attached to the invoice.
 */
export async function addInvoiceLineItem(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin', 'management', 'accounts');
  const parsed = addInvoiceLineItemSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, client_id, billing_period, tax_rate, subtotal, tax_amount, currency')
    .eq('id', parsed.data.invoice_id)
    .single();
  if (!invoice) return { ok: false, error: 'Invoice not found' };

  // Create a synthetic "delivered + extra_billable" ticket to back the line
  // item — this keeps the data model consistent (every billable references
  // a ticket).
  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .insert({
      client_id: invoice.client_id,
      title: parsed.data.title,
      request_type: 'other',
      classification: 'extra_billable',
      status: 'delivered',
      approval_stage: 'approved',
      billing_status: 'pending_billing',
      estimated_amount: parsed.data.amount,
      requested_by_id: (await supabase.auth.getUser()).data.user?.id,
      metadata: { source: 'manual_invoice_line_item' },
    } as Record<string, unknown>)
    .select('id')
    .single();
  if (tErr || !ticket) return { ok: false, error: tErr?.message ?? 'Could not back line item' };

  // Insert the billable; the auto-invoice trigger would normally create a new
  // invoice but we want this billable attached to THIS invoice. Bypass by
  // setting invoice_id directly via service-role would need elevated perms;
  // since the trigger pools into an existing draft invoice for the same
  // (client, period), it'll attach to ours if status is still 'draft'.
  const taxAmt = Math.round(parsed.data.amount * invoice.tax_rate) / 100;
  const { error: bErr } = await supabase.from('billables').insert({
    ticket_id: ticket.id,
    client_id: invoice.client_id,
    classification: 'extra_billable',
    amount: parsed.data.amount,
    tax_rate: invoice.tax_rate,
    tax_amount: taxAmt,
    currency: invoice.currency,
    billing_period: invoice.billing_period,
    status: 'pending_billing',
    invoice_id: invoice.id,
  } as Record<string, unknown>);
  if (bErr) return { ok: false, error: bErr.message };

  // Recompute invoice totals
  const newSubtotal = Number(invoice.subtotal) + parsed.data.amount;
  const newTax = Number(invoice.tax_amount) + taxAmt;
  await supabase
    .from('invoices')
    .update({
      subtotal: newSubtotal,
      tax_amount: newTax,
      total: newSubtotal + newTax,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id);

  revalidatePath(`/invoices/${invoice.id}`);
  return { ok: true };
}
