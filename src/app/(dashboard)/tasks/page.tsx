import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { TaskStatusChip } from '@/components/data/status-chip';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { TasksFilters } from '@/features/tasks/tasks-filters';

export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; client?: string; assignee?: string; due?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const isStaff = ['super_admin', 'management', 'accounts'].includes(user.role);

  // Get filter dropdown options
  const [{ data: clients }, { data: users }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, client_name, brand_code')
      .is('deleted_at', null)
      .order('client_name'),
    isStaff
      ? supabase
          .from('users')
          .select('id, full_name')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('full_name')
      : Promise.resolve({ data: [] }),
  ]);

  // Build the query
  let q = supabase
    .from('tasks')
    .select(
      'id, title, status, due_date, estimated_hours, actual_hours, completion_pct, ticket:tickets(id, ticket_number, title, client_id, classification, clients(client_name, client_code, brand_code)), assignee:users!tasks_assignee_id_fkey(full_name)',
    )
    .is('deleted_at', null);

  // Default: only my tasks unless staff explicitly toggles
  const assigneeFilter =
    sp.assignee === 'me'
      ? user.id
      : sp.assignee && sp.assignee !== 'all'
        ? sp.assignee
        : !isStaff
          ? user.id
          : null;
  if (assigneeFilter) q = q.eq('assignee_id', assigneeFilter);

  if (sp.status && sp.status !== 'all') q = q.eq('status', sp.status as 'pending');
  if (sp.q) q = q.ilike('title', `%${sp.q}%`);

  // Due-date filter
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 3600 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 3600 * 1000);
  if (sp.due === 'overdue') {
    q = q.lt('due_date', startOfToday.toISOString()).not('status', 'in', '(completed,delivered)');
  } else if (sp.due === 'today') {
    q = q.gte('due_date', startOfToday.toISOString()).lt('due_date', endOfToday.toISOString());
  } else if (sp.due === 'this_week') {
    q = q.gte('due_date', startOfToday.toISOString()).lt('due_date', endOfWeek.toISOString());
  } else if (sp.due === 'no_due') {
    q = q.is('due_date', null);
  }

  // Client filter applies after fetch since it's joined
  q = q.order('due_date', { ascending: true, nullsFirst: false });

  const { data: tasksRaw } = await q;
  let tasks = tasksRaw ?? [];
  if (sp.client && sp.client !== 'all') {
    tasks = tasks.filter(
      (t: { ticket?: { client_id?: string } | null }) => t.ticket?.client_id === sp.client,
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff ? 'All open tasks across the agency.' : 'Your queue.'}
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <TasksFilters
            initial={{
              search: sp.q,
              status: sp.status,
              client: sp.client,
              assignee: sp.assignee,
              due: sp.due,
            }}
            clients={clients ?? []}
            users={users ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="max-w-sm">
                <h3 className="text-base font-medium">All clear</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No tasks match your filters.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Task</th>
                    <th className="px-4 py-2.5">Client / Ticket</th>
                    <th className="px-4 py-2.5">Owner</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Due</th>
                    <th className="px-4 py-2.5">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.estimated_hours ?? 0}h est · {t.actual_hours}h logged
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link
                          href={`/tickets/${t.ticket?.id}` as never}
                          className="font-medium hover:underline"
                        >
                          #{t.ticket?.ticket_number} {t.ticket?.title}
                        </Link>
                        <div className="text-muted-foreground">
                          {t.ticket?.clients?.brand_code}-{t.ticket?.clients?.client_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t.assignee?.full_name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TaskStatusChip value={t.status} />
                      </td>
                      <td className="px-4 py-3 text-xs">{formatDate(t.due_date)}</td>
                      <td className="px-4 py-3 text-xs">
                        <Badge variant={t.completion_pct === 100 ? 'success' : 'muted'}>
                          {t.completion_pct}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
