import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@/types/database.types';

export type UserWithRelations = User & {
  department: { name: string } | null;
  assignments: Array<{
    client_id: string;
    is_primary: boolean;
    client: { client_code: string; client_name: string; brand_code: string } | null;
  }>;
  managed_clients_count: number;
};

export async function listUsers(): Promise<UserWithRelations[]> {
  const supabase = await createSupabaseServerClient();

  const { data: users } = await supabase
    .from('users')
    .select('*, department:departments(name)')
    .is('deleted_at', null)
    .order('full_name');

  if (!users) return [];

  const userIds = users.map((u) => u.id);
  const [{ data: assignments }, { data: amCounts }] = await Promise.all([
    supabase
      .from('client_assignees')
      .select('user_id, client_id, is_primary, client:clients(client_code, client_name, brand_code)')
      .in('user_id', userIds),
    supabase
      .from('clients')
      .select('account_manager_id')
      .in('account_manager_id', userIds)
      .is('deleted_at', null),
  ]);

  const byUser = new Map<string, UserWithRelations['assignments']>();
  for (const a of assignments ?? []) {
    const list = byUser.get(a.user_id) ?? [];
    list.push({
      client_id: a.client_id,
      is_primary: a.is_primary,
      client: (a.client as { client_code: string; client_name: string; brand_code: string } | null) ?? null,
    });
    byUser.set(a.user_id, list);
  }

  const amCount = new Map<string, number>();
  for (const c of amCounts ?? []) {
    if (!c.account_manager_id) continue;
    amCount.set(c.account_manager_id, (amCount.get(c.account_manager_id) ?? 0) + 1);
  }

  return users.map((u) => ({
    ...(u as User),
    department: (u as User & { department: { name: string } | null }).department ?? null,
    assignments: byUser.get(u.id) ?? [],
    managed_clients_count: amCount.get(u.id) ?? 0,
  }));
}

export async function listDepartments() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('departments').select('id, name').order('name');
  return data ?? [];
}

export async function listAllClients() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('clients')
    .select('id, client_code, client_name, brand_code')
    .is('deleted_at', null)
    .order('client_name');
  return data ?? [];
}

export async function listAccountManagerCandidates() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .in('role', ['client_servicing', 'management', 'super_admin'])
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name');
  return data ?? [];
}
