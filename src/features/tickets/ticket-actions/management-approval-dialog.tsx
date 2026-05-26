'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { managementApprove } from '@/features/tickets/actions';

export function ManagementApprovalDialog({
  ticketId,
  amount,
}: {
  ticketId: string;
  amount: number | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();

  function decide(decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await managementApprove(ticketId, { decision, comment });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          Review (management)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Management review</DialogTitle>
          <DialogDescription>
            Estimated value:{' '}
            <span className="font-medium text-foreground">{formatCurrency(amount)}</span>.
            Approving an Extra Billable will move it to the client-approval stage. Approving
            Goodwill / Out-of-Scope finalizes it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Comment (optional)
          </Label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any context for finance or CS"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => decide('rejected')}
            disabled={isPending}
            className="text-rose-600"
          >
            Reject
          </Button>
          <Button onClick={() => decide('approved')} disabled={isPending}>
            {isPending ? 'Saving…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
