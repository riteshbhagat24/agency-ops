'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateInvoiceStatus } from './actions';
import type { InvoiceStatus } from '@/types/database.types';

export function InvoiceStatusActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: InvoiceStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: InvoiceStatus) {
    startTransition(async () => {
      const r = await updateInvoiceStatus({ id, status });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Invoice marked as ${status.replace('_', ' ')}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus === 'draft' && (
        <Button onClick={() => setStatus('sent')} disabled={isPending}>
          Mark as sent
        </Button>
      )}
      {currentStatus === 'sent' && (
        <>
          <Button onClick={() => setStatus('paid')} disabled={isPending}>
            Mark as paid
          </Button>
          <Button variant="outline" onClick={() => setStatus('overdue')} disabled={isPending}>
            Mark overdue
          </Button>
        </>
      )}
      {currentStatus === 'overdue' && (
        <Button onClick={() => setStatus('paid')} disabled={isPending}>
          Mark as paid
        </Button>
      )}
      {(currentStatus === 'draft' || currentStatus === 'sent') && (
        <Button
          variant="outline"
          className="text-rose-600"
          onClick={() => setStatus('cancelled')}
          disabled={isPending}
        >
          Cancel invoice
        </Button>
      )}
      {currentStatus !== 'paid' && currentStatus !== 'written_off' && (
        <Button
          variant="ghost"
          className="text-amber-600"
          onClick={() => setStatus('written_off')}
          disabled={isPending}
        >
          Write off
        </Button>
      )}
      {currentStatus === 'paid' && (
        <span className="text-sm text-muted-foreground">
          Paid — no further actions needed.
        </span>
      )}
    </div>
  );
}
