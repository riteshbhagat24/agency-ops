import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TicketsTable } from '@/features/tickets/tickets-table';
import { TicketsFilters } from '@/features/tickets/tickets-filters';
import { listTickets, type TicketListFilters } from '@/features/tickets/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import type { ApprovalStage, Classification, TicketStatus } from '@/types/database.types';

export const dynamic = 'force-dynamic';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const isStaff = ['super_admin', 'management', 'accounts'].includes(user.role);

  const supabase = await createSupabaseServerClient();
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

  const page = Number(sp.page ?? '1') || 1;
  const filters: TicketListFilters = {
    search: sp.q,
    status: (sp.status as TicketStatus) ?? 'all',
    classification: (sp.classification as Classification) ?? 'all',
    approvalStage: (sp.approval as ApprovalStage) ?? 'all',
    clientId: sp.client,
    brand: sp.brand,
    assigneeId: sp.assignee,
    due: sp.due as TicketListFilters['due'],
    currentUserId: user.id,
    page,
    pageSize: 25,
  };

  const { rows, total } = await listTickets(filters);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Every request, classified, traceable, and approval-gated.
          </p>
        </div>
        <Button asChild>
          <Link href={'/tickets/new' as never} className="gap-1.5">
            <Plus className="h-4 w-4" /> New ticket
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <TicketsFilters
            initial={{
              search: sp.q,
              status: sp.status,
              classification: sp.classification,
              approvalStage: sp.approval,
              client: sp.client,
              brand: sp.brand,
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
          <TicketsTable rows={rows} total={total} page={filters.page ?? 1} pageSize={filters.pageSize ?? 25} />
        </CardContent>
      </Card>
    </div>
  );
}
