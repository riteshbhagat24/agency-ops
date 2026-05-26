'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs uppercase tracking-wider text-rose-600">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">We hit a snag</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">trace: {error.digest}</p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
