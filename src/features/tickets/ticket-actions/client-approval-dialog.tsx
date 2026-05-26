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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recordClientApproval } from '@/features/tickets/actions';

export function ClientApprovalDialog({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [actorLabel, setActorLabel] = useState('');
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();

  function decide(decision: 'approved' | 'rejected') {
    if (!actorLabel.trim()) {
      toast.error('Add who approved (email / phone / name)');
      return;
    }
    startTransition(async () => {
      const result = await recordClientApproval(ticketId, {
        decision,
        actor_label: actorLabel.startsWith('client:') ? actorLabel : `client:${actorLabel}`,
        comment,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Client decision recorded');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          Record client decision
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record client decision</DialogTitle>
          <DialogDescription>
            Captures the approval that happened on WhatsApp or email. Add proof in the comment
            and attach a screenshot to the ticket if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Approver (client contact)
            </Label>
            <Input
              placeholder="rahul@tata.com"
              value={actorLabel}
              onChange={(e) => setActorLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes (paste WhatsApp / email reference)
            </Label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="WhatsApp at 14:32 — 'go ahead, send invoice end of month'"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => decide('rejected')}
            disabled={isPending}
            className="text-rose-600"
          >
            Mark rejected
          </Button>
          <Button onClick={() => decide('approved')} disabled={isPending}>
            {isPending ? 'Saving…' : 'Mark approved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
