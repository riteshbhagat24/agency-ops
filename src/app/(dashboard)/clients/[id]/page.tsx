import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfitabilityChip, ClientStatusChip } from '@/components/data/profitability-chip';
import { KpiCard } from '@/components/data/kpi-card';
import { getClientById, getClientStats } from '@/features/clients/queries';
import { listTickets } from '@/features/tickets/queries';
import { listAccountManagerCandidates } from '@/features/users/queries';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ClassificationChip } from '@/components/data/classification-chip';
import { TicketStatusChip } from '@/components/data/status-chip';
import { AccountManagerPicker } from '@/features/clients/account-manager-picker';
import { AgreementLink } from '@/features/clients/agreement-link';
import { DeleteClientButton } from '@/features/clients/delete-client-button';
import { requireUser } from '@/lib/auth/session';
import { canManageClients } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, client, stats, tickets, amCandidates] = await Promise.all([
    requireUser(),
    getClientById(id),
    getClientStats(id),
    listTickets({ clientId: id, pageSize: 25 }),
    listAccountManagerCandidates(),
  ]);
  if (!client) notFound();
  const canEditAm = canManageClients(user.role);

  return (
    <div className="space-y-5">
      <Link
        href={'/clients' as never}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.client_name}</h1>
            <Badge variant="outline" className="font-mono">
              {client.client_code}
            </Badge>
            <ClientStatusChip value={client.status} />
            <ProfitabilityChip value={client.profitability_status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Account Manager
            </span>
            {canEditAm ? (
              <AccountManagerPicker
                clientId={client.id}
                currentAmId={client.account_manager_id}
                currentAmName={client.account_manager?.full_name ?? null}
                candidates={amCandidates}
              />
            ) : (
              <span className="font-medium">
                {client.account_manager?.full_name ?? '—'}
              </span>
            )}
            <span className="text-muted-foreground">
              · Allowed revisions: {client.allowed_revisions} · Billing: {client.billing_cycle}
            </span>
          </div>
        </div>
        {canEditAm && (
          <DeleteClientButton
            clientId={client.id}
            clientName={client.client_name}
            clientCode={client.client_code}
          />
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Retainer (monthly)" value={formatCurrency(client.retainer_amount, true)} />
        <KpiCard label="Extra billables (this month)" value={formatCurrency(stats.extraBilledMonth, true)} tone="warning" />
        <KpiCard label="Goodwill (this month)" value={formatCurrency(stats.goodwillMonth, true)} tone="warning" />
        <KpiCard label="Open tickets" value={String(stats.openTickets)} hint={`${stats.totalTickets} total`} />
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Tickets ({tickets.total})</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Title</th>
                      <th className="px-4 py-2.5">Classification</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.rows.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3 text-xs">#{t.ticket_number}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/tickets/${t.id}` as never}
                            className="font-medium hover:underline"
                          >
                            {t.title}
                          </Link>
                          {t.job_code && (
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {t.job_code}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ClassificationChip value={t.classification} />
                        </td>
                        <td className="px-4 py-3">
                          <TicketStatusChip value={t.status} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatCurrency(t.estimated_amount, true)}
                        </td>
                        <td className="px-4 py-3 text-xs">{formatDate(t.deadline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Included scope</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(client.scope_included) && client.scope_included.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {client.scope_included.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No scope items defined.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signed agreement</CardTitle>
            </CardHeader>
            <CardContent>
              {client.agreement_path ? (
                <AgreementLink
                  clientId={client.id}
                  filename={client.agreement_filename ?? 'agreement.pdf'}
                  size={client.agreement_size}
                  uploadedAt={client.agreement_uploaded_at}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No agreement uploaded for this client yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial">
          <Card>
            <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-2">
              <Row label="Monthly retainer">{formatCurrency(client.retainer_amount)}</Row>
              <Row label="Currency">{client.currency}</Row>
              <Row label="Billing cycle">{client.billing_cycle}</Row>
              <Row label="Allowed revisions">{client.allowed_revisions}</Row>
              <Row label="Profitability">
                <ProfitabilityChip value={client.profitability_status} />
              </Row>
              <Row label="Started">{formatDate(client.start_date)}</Row>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
