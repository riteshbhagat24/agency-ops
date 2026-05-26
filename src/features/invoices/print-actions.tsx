'use client';

import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function PrintActions() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Download className="h-3.5 w-3.5" /> Save as PDF
        </Button>
      </div>
    </div>
  );
}
