'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClassificationChip } from '@/components/data/classification-chip';
import { TicketStatusChip } from '@/components/data/status-chip';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { TicketFull } from '@/types/database.types';

export function TicketsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: TicketFull[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goto(newPage: number) {
    const params = new URLSearchParams(sp.toString());
    params.set('page', String(newPage));
    router.replace(`/tickets?${params.toString()}`);
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center px-6 py-16 text-center">
        <div className="max-w-sm">
          <h3 className="text-base font-medium">No tickets match</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing filters or creating a new ticket from the button above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">#</th>
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-4 py-2.5 font-medium">Title</th>
            <th className="px-4 py-2.5 font-medium">Classification</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Amount</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
              className="border-b transition-colors last:border-0 hover:bg-accent/40"
            >
              <td className="px-4 py-3 align-top text-xs font-medium text-muted-foreground">
                #{t.ticket_number}
                {t.job_code && (
                  <div className="mt-0.5 font-mono text-[10px]">{t.job_code}</div>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <div className="font-medium">{t.client_code}</div>
                <div className="text-xs text-muted-foreground">{t.brand_code}</div>
              </td>
              <td className="px-4 py-3 align-top">
                <Link
                  href={`/tickets/${t.id}` as never}
                  className="font-medium hover:underline"
                >
                  {t.title}
                </Link>
                <div className="text-xs text-muted-foreground">{t.request_type}</div>
              </td>
              <td className="px-4 py-3 align-top">
                <ClassificationChip value={t.classification} />
              </td>
              <td className="px-4 py-3 align-top">
                <TicketStatusChip value={t.status} />
              </td>
              <td className="px-4 py-3 align-top text-xs">
                {t.assigned_to_name ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 align-top text-xs">
                {formatCurrency(t.estimated_amount, true)}
              </td>
              <td className="px-4 py-3 align-top text-xs">{formatDate(t.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <div>
          Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goto(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goto(page + 1)}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
