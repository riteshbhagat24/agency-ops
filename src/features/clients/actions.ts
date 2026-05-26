'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { createClientSchema } from '@/lib/validations/clients';

type Result<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createClient(rawInput: unknown): Promise<Result<{ id: string; client_code: string }>> {
  await requireRole('super_admin', 'management');
  const parsed = createClientSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const supabase = await createSupabaseServerClient();

  // Auto-generate client_code unless an explicit override was supplied.
  let clientCode = parsed.data.client_code ?? null;
  if (!clientCode) {
    const { data: generated, error: genErr } = await supabase.rpc('generate_client_code', {
      p_brand_code: parsed.data.brand_code,
    });
    if (genErr || !generated) {
      return { ok: false, error: genErr?.message ?? 'Could not generate client code' };
    }
    clientCode = generated as string;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...parsed.data,
      client_code: clientCode,
      brand_name: parsed.data.brand_code === 'FRM' ? 'Futuready Media' : 'Orange Videos',
      agreement_uploaded_at: parsed.data.agreement_path ? new Date().toISOString() : null,
    } as Record<string, unknown>)
    .select('id, client_code')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not create client' };
  }
  revalidatePath('/clients');
  return { ok: true, data: { id: data.id, client_code: data.client_code as string } };
}

/** Returns a 1-hour signed URL to download the agreement file. */
export async function getAgreementDownloadUrl(
  clientId: string,
): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  await requireRole('super_admin', 'management', 'accounts', 'client_servicing');
  const supabase = await createSupabaseServerClient();
  const { data: client, error: fetchErr } = await supabase
    .from('clients')
    .select('agreement_path, agreement_filename')
    .eq('id', clientId)
    .single();
  if (fetchErr || !client?.agreement_path) {
    return { ok: false, error: 'No agreement uploaded for this client' };
  }
  const { data: signed, error: signErr } = await supabase.storage
    .from('client-agreements')
    .createSignedUrl(client.agreement_path, 3600);
  if (signErr || !signed) {
    return { ok: false, error: signErr?.message ?? 'Could not create download link' };
  }
  return {
    ok: true,
    url: signed.signedUrl,
    filename: client.agreement_filename ?? 'agreement',
  };
}

/** Replace or remove an agreement on an existing client. */
export async function updateAgreement(
  clientId: string,
  patch: {
    agreement_path?: string | null;
    agreement_filename?: string | null;
    agreement_size?: number | null;
  },
): Promise<Result> {
  await requireRole('super_admin', 'management');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('clients')
    .update({
      ...patch,
      agreement_uploaded_at: patch.agreement_path ? new Date().toISOString() : null,
    })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: null };
}

export async function createClientAndRedirect(rawInput: unknown) {
  const result = await createClient(rawInput);
  if (!result.ok) return result;
  redirect(`/clients/${result.data.id}`);
}

/**
 * Soft-delete: marks the client deleted_at = now() so the client_code slot
 * is freed up for reuse the same day. Hard-delete after 30 days via
 * purge_client RPC (super_admin only).
 */
export async function deleteClient(id: string): Promise<Result> {
  await requireRole('super_admin', 'management');
  // The audit_trail trigger on `clients` writes the audit_log row automatically.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/clients');
  return { ok: true, data: null };
}

export async function restoreClient(id: string): Promise<Result> {
  await requireRole('super_admin', 'management');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/clients');
  return { ok: true, data: null };
}
