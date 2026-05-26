'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { addTicketComment } from '@/features/tickets/actions';

export function CommentBox({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addTicketComment(ticketId, body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody('');
      toast.success('Comment added');
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Cmd/Ctrl + Enter to send</span>
        <Button size="sm" onClick={submit} disabled={isPending || !body.trim()}>
          {isPending ? 'Posting…' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}
