import { requireRole } from '@/lib/auth/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewClientForm } from '@/features/clients/new-client-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  await requireRole('super_admin', 'management');
  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('is_active', true)
    .in('role', ['client_servicing', 'management', 'super_admin'])
    .order('full_name');

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
        <p className="text-sm text-muted-foreground">
          Add the commercial baseline — retainer, scope, allowed revisions, and AM.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClientForm users={users ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
