'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { setClientAccountManager } from '@/features/users/actions';

interface Candidate {
  id: string;
  full_name: string;
  role: string;
}

interface AccountManagerPickerProps {
  clientId: string;
  currentAmId: string | null;
  /** Display name of the current AM. Used when the AM id isn't in the
   *  candidates list (e.g. the AM was deactivated or has been wiped) —
   *  prevents the raw UUID from leaking into the trigger label. */
  currentAmName?: string | null;
  candidates: Candidate[];
}

export function AccountManagerPicker({
  clientId,
  currentAmId,
  currentAmName,
  candidates,
}: AccountManagerPickerProps) {
  const [value, setValue] = useState(currentAmId ?? 'none');
  const [isPending, startTransition] = useTransition();

  const currentInCandidates = candidates.find((c) => c.id === value);
  const displayLabel =
    value === 'none'
      ? '— No AM —'
      : currentInCandidates
        ? currentInCandidates.full_name
        : (currentAmName ?? 'Unknown user');

  function onChange(v: string) {
    setValue(v);
    startTransition(async () => {
      const r = await setClientAccountManager({
        client_id: clientId,
        account_manager_id: v === 'none' ? null : v,
      });
      if (!r.ok) {
        toast.error(r.error);
        setValue(currentAmId ?? 'none');
        return;
      }
      toast.success(v === 'none' ? 'AM cleared' : 'Account Manager updated');
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="h-8 w-[240px]">
        <span className="truncate text-sm">{displayLabel}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— No AM —</SelectItem>
        {/* If the current AM isn't in the active-candidates list, surface them
            at the top so the value resolves to a name. */}
        {currentAmId && !currentInCandidates && currentAmName && (
          <SelectItem value={currentAmId}>
            {currentAmName}{' '}
            <span className="text-muted-foreground">· current (inactive)</span>
          </SelectItem>
        )}
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.full_name}{' '}
            <span className="text-muted-foreground">· {c.role.replace('_', ' ')}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
