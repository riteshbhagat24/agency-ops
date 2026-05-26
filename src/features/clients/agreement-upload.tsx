'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AgreementValue {
  path: string;
  filename: string;
  size: number;
}

interface AgreementUploadProps {
  value: AgreementValue | null;
  onChange: (next: AgreementValue | null) => void;
  /** Folder inside the bucket. Use the client id once known. */
  pathPrefix?: string;
  className?: string;
}

const MAX_SIZE_MB = 20;
const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export function AgreementUpload({
  value,
  onChange,
  pathPrefix = 'pending',
  className,
}: AgreementUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File is larger than ${MAX_SIZE_MB} MB.`);
      return;
    }
    if (ACCEPTED.length && !ACCEPTED.includes(file.type)) {
      toast.error('Unsupported file type. PDF / DOC / DOCX / PNG / JPG only.');
      return;
    }

    setIsUploading(true);
    setProgress(10);
    const supabase = createSupabaseBrowserClient();

    // Path: <prefix>/<random>.<ext>  — random id keeps it unguessable
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const id = crypto.randomUUID();
    const path = `${pathPrefix}/${id}.${ext}`;

    const { error } = await supabase.storage
      .from('client-agreements')
      .upload(path, file, { contentType: file.type, upsert: false });

    setProgress(100);
    setIsUploading(false);

    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    onChange({ path, filename: file.name, size: file.size });
    toast.success('Agreement uploaded');
  }

  function clear() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Signed agreement / SOW
      </Label>

      {value ? (
        <div className="flex items-center gap-3 rounded-md border bg-card p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.filename}</div>
            <div className="text-xs text-muted-foreground">
              {(value.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      ) : (
        <label
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-md border border-dashed bg-card/40 p-4 text-sm transition-colors hover:bg-accent/40',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              {isUploading ? 'Uploading…' : 'Click to upload'}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF / DOC / DOCX / image · up to {MAX_SIZE_MB} MB
            </div>
          </div>
        </label>
      )}

      {isUploading && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
