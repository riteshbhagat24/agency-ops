'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

export function BillingPeriodPicker({ initial }: { initial: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <Input
      type="month"
      defaultValue={initial}
      className="w-[160px]"
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString());
        params.set('period', e.target.value);
        router.replace(`/billing?${params.toString()}`);
      }}
    />
  );
}
