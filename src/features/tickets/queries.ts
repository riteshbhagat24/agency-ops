import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ApprovalStage,
  Classification,
  TicketFull,
  TicketStatus,
} from '@/types/database.types';

export type TicketListFilters = {
  search?: string;
  status?: TicketStatus | 'all';
  classification?: Classification | 'all';
  approvalStage?: ApprovalStage | 'all';
  clientId?: string;
  brand?: 'FRM' | 'OV' | string;
  assigneeId?: string | 'me' | 'unassigned';
  due?: 'overdue' | 'today' | 'this_week' | 'no_due';
  currentUserId?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listTickets(filters: TicketListFilters = {}) {
  const supabase = await createSupabaseServerClient();
  const pageSize = filters.pageSize ?? 25;
  const page = filters.page ?? 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('v_tickets_full')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,client_code.ilike.%${filters.search}%,job_code.ilike.%${filters.search}%`,
    );
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.classification && filters.classification !== 'all') {
    query = query.eq('classification', filters.classification);
  }
  if (filters.approvalStage && filters.approvalStage !== 'all') {
    query = query.eq('approval_stage', filters.approvalStage);
  }
  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.brand && filters.brand !== 'all') {
    query = query.eq('brand_code', filters.brand);
  }
  if (filters.assigneeId === 'unassigned') {
    query = query.is('assigned_to_id', null);
  } else if (filters.assigneeId === 'me' && filters.currentUserId) {
    query = query.eq('assigned_to_id', filters.currentUserId);
  } else if (filters.assigneeId && filters.assigneeId !== 'all') {
    query = query.eq('assigned_to_id', filters.assigneeId);
  }
  if (filters.due) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();
    const endOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 7,
    ).toISOString();
    if (filters.due === 'overdue') {
      query = query
        .lt('deadline', startOfToday)
        .not('status', 'in', '(completed,delivered,rejected,cancelled)');
    } else if (filters.due === 'today') {
      query = query.gte('deadline', startOfToday).lt('deadline', endOfToday);
    } else if (filters.due === 'this_week') {
      query = query.gte('deadline', startOfToday).lt('deadline', endOfWeek);
    } else if (filters.due === 'no_due') {
      query = query.is('deadline', null);
    }
  }
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as TicketFull[], total: count ?? 0, page, pageSize };
}

export async function getTicketById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('v_tickets_full')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as TicketFull;
}

export async function getTicketRelations(id: string) {
  const supabase = await createSupabaseServerClient();
  const [tasks, approvals, comments] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, users:assignee_id(full_name, avatar_url)')
      .eq('ticket_id', id)
      .is('deleted_at', null)
      .order('created_at'),
    supabase
      .from('approvals')
      .select('*, actor:users!approvals_actor_id_fkey(full_name)')
      .eq('ticket_id', id)
      .order('created_at'),
    supabase
      .from('comments')
      .select('*, author:users!comments_author_id_fkey(full_name, avatar_url)')
      .eq('entity_type', 'ticket')
      .eq('entity_id', id)
      .is('deleted_at', null)
      .order('created_at'),
  ]);

  return {
    tasks: tasks.data ?? [],
    approvals: approvals.data ?? [],
    comments: comments.data ?? [],
  };
}

export async function listClientsForPicker() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('clients')
    .select('id, client_name, client_code, brand_code')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('client_name');
  return data ?? [];
}
