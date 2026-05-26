import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listClientsForPicker } from '@/features/tickets/queries';
import { NewTicketForm } from '@/features/tickets/new-ticket-form';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const clients = await listClientsForPicker();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">New ticket</h1>
        <p className="text-sm text-muted-foreground">
          Capture the request. Classification is mandatory — it routes the request through the
          right commercial workflow.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
