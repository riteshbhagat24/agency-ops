'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast border border-border bg-card text-card-foreground shadow-lift',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
