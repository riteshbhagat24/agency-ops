'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole, requireUser } from '@/lib/auth/session';
import {
  assignClientSchema,
  inviteUserSchema,
  setClientAccountManagerSchema,
  setUserActiveSchema,
  updateUserDepartmentSchema,
  updateUserRoleSchema,
} from '@/lib/validations/users';

type Result<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Invite a teammate by pre-creating their auth.users + public.users rows.
 * When they later sign in with Google using the same email, Supabase links
 * the OAuth identity to this existing row, preserving their role.
 *
 * Uses the service-role client because creating auth.users rows requires
 * bypassing standard RLS.
 */
export async function inviteUser(rawInput: unknown): Promise<Result<{ id: string }>> {
  await requireRole('super_admin');

  const parsed = inviteUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;
  const admin = createSupabaseServiceClient();

  // Reject if a user with this email already exists
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `A user with email ${input.email} already exists` };
  }

  // Step 1 — create auth.users via Supabase Admin API (handles required fields)
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, invited: true },
  });
  if (authError || !created.user) {
    return { ok: false, error: authError?.message ?? 'Could not create auth user' };
  }

  // Step 2 — the on_auth_user_created trigger already created the public.users
  // row with default role. Update it with the role and department we want.
  const { error: updateError } = await admin
    .from('users')
    .update({
      full_name: input.full_name,
      role: input.role,
      department_id: input.department_id ?? null,
      is_active: true,
    })
    .eq('id', created.user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath('/settings/users');
  return { ok: true, data: { id: created.user.id } };
}

export async function updateUserRole(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin');

  const parsed = updateUserRoleSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  // Guard rail: prevent demoting yourself out of super_admin
  const me = await requireUser();
  if (parsed.data.user_id === me.id && parsed.data.role !== 'super_admin') {
    return {
      ok: false,
      error: 'You cannot demote yourself. Promote another super_admin first.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('users')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.user_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  return { ok: true, data: null };
}

export async function updateUserDepartment(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin');
  const parsed = updateUserDepartmentSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('users')
    .update({ department_id: parsed.data.department_id })
    .eq('id', parsed.data.user_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  return { ok: true, data: null };
}

export async function setUserActive(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin');
  const parsed = setUserActiveSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const me = await requireUser();
  if (parsed.data.user_id === me.id && parsed.data.is_active === false) {
    return { ok: false, error: 'You cannot deactivate yourself.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('users')
    .update({ is_active: parsed.data.is_active })
    .eq('id', parsed.data.user_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  return { ok: true, data: null };
}

export async function assignClient(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin', 'management');
  const parsed = assignClientSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('client_assignees')
    .upsert(
      {
        user_id: parsed.data.user_id,
        client_id: parsed.data.client_id,
        is_primary: parsed.data.is_primary ?? false,
      },
      { onConflict: 'client_id,user_id' },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, data: null };
}

export async function unassignClient(userId: string, clientId: string): Promise<Result> {
  await requireRole('super_admin', 'management');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('client_assignees')
    .delete()
    .eq('user_id', userId)
    .eq('client_id', clientId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: null };
}

/**
 * Set or clear the Account Manager on a specific client. Convenience action
 * called from the Client detail page.
 */
export async function setClientAccountManager(rawInput: unknown): Promise<Result> {
  await requireRole('super_admin', 'management');
  const parsed = setClientAccountManagerSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('clients')
    .update({ account_manager_id: parsed.data.account_manager_id })
    .eq('id', parsed.data.client_id);
  if (error) return { ok: false, error: error.message };

  // Also ensure the new AM is in client_assignees as primary
  if (parsed.data.account_manager_id) {
    await supabase
      .from('client_assignees')
      .upsert(
        {
          client_id: parsed.data.client_id,
          user_id: parsed.data.account_manager_id,
          is_primary: true,
        },
        { onConflict: 'client_id,user_id' },
      );
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, data: null };
}
