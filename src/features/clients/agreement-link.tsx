'use client';

import { useTransition } from 'react';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getAgreementDownloadUrl } from './actions';

interface AgreementLinkProps {
  clientId: string;
  filename: string;
  size: number | null;
  uploadedAt: string | null;
}

export function AgreementLink({ clientId, filename, size, uploadedAt }: AgreementLinkProps) {
  const [isPending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const r = await getAgreementDownloadUrl(clientId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      window.open(r.url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{filename}</div>
        <div className="text-xs text-muted-foreground">
          {size != null ? `${(size / 1024).toFixed(0)} KB` : 'Signed agreement'}
          {uploadedAt && ` · uploaded ${new Date(uploadedAt).toLocaleDateString('en-IN')}`}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={open} disabled={isPending}>
        <Download className="h-3.5 w-3.5" /> {isPending ? 'Opening…' : 'Download'}
      </Button>
    </div>
  );
}
