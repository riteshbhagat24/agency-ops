'use client';

import { Command } from 'cmdk';
import {
  Building2,
  CheckSquare,
  GitPullRequest,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  Plus,
  Ticket,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type PaletteCtx = { open: () => void; close: () => void };
const Ctx = createContext<PaletteCtx | null>(null);

export function useCommandPalette() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCommandPalette outside provider');
  return v;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function navigate(to: string) {
    setIsOpen(false);
    router.push(to as never);
  }

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <Command
            className={cn(
              'relative z-50 w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-lift',
              'animate-slide-up',
            )}
            label="Command palette"
          >
            <div className="border-b px-3 py-2.5">
              <Command.Input
                placeholder="Type a command or search…"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
              <Command.Empty className="p-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>

              <Command.Group heading="Navigate" className="px-1 text-xs text-muted-foreground">
                <Item onSelect={() => navigate('/dashboard')} icon={LayoutDashboard}>Dashboard</Item>
                <Item onSelect={() => navigate('/tickets')} icon={Ticket}>Tickets</Item>
                <Item onSelect={() => navigate('/clients')} icon={Building2}>Clients</Item>
                <Item onSelect={() => navigate('/tasks')} icon={CheckSquare}>Tasks</Item>
                <Item onSelect={() => navigate('/approvals')} icon={GitPullRequest}>Approvals</Item>
                <Item onSelect={() => navigate('/billing')} icon={IndianRupee}>Billing</Item>
                <Item onSelect={() => navigate('/analytics')} icon={LineChart}>Analytics</Item>
              </Command.Group>

              <Command.Group heading="Create" className="px-1 pt-2 text-xs text-muted-foreground">
                <Item onSelect={() => navigate('/tickets/new')} icon={Plus}>New ticket</Item>
                <Item onSelect={() => navigate('/clients/new')} icon={Plus}>New client</Item>
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      )}
    </Ctx.Provider>
  );
}

function Item({
  children,
  icon: Icon,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Command.Item>
  );
}
