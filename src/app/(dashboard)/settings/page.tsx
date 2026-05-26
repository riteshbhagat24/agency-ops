import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABEL, canManageUsers } from '@/lib/auth/rbac';

export default async function SettingsPage() {
  const user = await requireUser();
  const showAdmin = canManageUsers(user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your profile and workspace preferences.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Name">{user.full_name}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">
            <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
          </Row>
          <Row label="Active">{user.is_active ? 'Yes' : 'No'}</Row>
        </CardContent>
      </Card>

      {showAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={'/settings/users' as never}
              className="flex items-center justify-between rounded-md border bg-card p-3 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Users & roles</div>
                  <div className="text-xs text-muted-foreground">
                    Add teammates, set roles, assign clients
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Workspace-level settings (brands, scope templates, user management) are managed by the
            Super Admin role. Reach out to your admin for access.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
