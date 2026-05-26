import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/data/kpi-card';
import { requireRole } from '@/lib/auth/session';
import {
  listAllClients,
  listDepartments,
  listUsers,
} from '@/features/users/queries';
import { UsersTable } from '@/features/users/users-table';
import { InviteUserDialog } from '@/features/users/invite-user-dialog';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await requireRole('super_admin');
  const [users, departments, clients] = await Promise.all([
    listUsers(),
    listDepartments(),
    listAllClients(),
  ]);

  const counts = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    ams: users.filter((u) =>
      ['client_servicing', 'management', 'super_admin'].includes(u.role),
    ).length,
    managers: users.filter((u) => u.role === 'management' || u.role === 'super_admin').length,
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage teammates, roles, and client assignments.
          </p>
        </div>
        <InviteUserDialog departments={departments} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" value={String(counts.total)} />
        <KpiCard label="Active" value={String(counts.active)} tone="success" />
        <KpiCard
          label="Eligible as AM"
          value={String(counts.ams)}
          hint="CS / Management / Admin"
          tone="info"
        />
        <KpiCard label="Managers (approval)" value={String(counts.managers)} tone="warning" />
      </div>

      <Card>
        <CardContent className="p-0">
          <UsersTable
            users={users}
            departments={departments}
            clients={clients}
            currentUserId={me.id}
          />
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">How AMs work:</strong> any user with role{' '}
        <em>Client Servicing</em>, <em>Management</em>, or <em>Super Admin</em> can be assigned as
        an Account Manager on a client. The AM is set on the client itself (from the client's
        detail page). The "Clients" column above shows how many clients each user is{' '}
        <em>assigned to</em> (sees in their filtered view) — the small <em>N AM</em> badge shows
        how many they're the actual Account Manager of.
      </div>
    </div>
  );
}
