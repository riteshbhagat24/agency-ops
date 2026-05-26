'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  Building2,
  CheckSquare,
  GitPullRequest,
  IndianRupee,
  LineChart,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database.types';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: number;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin','management','accounts','client_servicing','operations','video_team','design_team'] },
  { href: '/tickets', label: 'Tickets', icon: Ticket, roles: ['super_admin','management','accounts','client_servicing','operations','video_team','design_team'] },
  { href: '/clients', label: 'Clients', icon: Building2, roles: ['super_admin','management','accounts','client_servicing','operations','video_team','design_team'] },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['super_admin','management','client_servicing','operations','video_team','design_team'] },
  { href: '/approvals', label: 'Approvals', icon: GitPullRequest, roles: ['super_admin','management','client_servicing'] },
  { href: '/billing', label: 'Billing', icon: IndianRupee, roles: ['super_admin','management','accounts','client_servicing'] },
  { href: '/invoices', label: 'Invoices', icon: Receipt, roles: ['super_admin','management','accounts'] },
  { href: '/analytics', label: 'Analytics', icon: LineChart, roles: ['super_admin','management','accounts'] },
  { href: '/settings/users', label: 'Users', icon: Users, roles: ['super_admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','management','accounts','client_servicing','operations','video_team','design_team'] },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="hidden h-[calc(100dvh)] w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Agency Ops</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Commercial OS
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
        {items.map((item) => {
          // Mark active by longest matching href so /settings/users wins over /settings.
          const matches = items.filter(
            (n) => pathname === n.href || pathname.startsWith(n.href + '/'),
          );
          const best = matches.reduce<NavItem | null>(
            (best, cur) => (!best || cur.href.length > best.href.length ? cur : best),
            null,
          );
          const active = best?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        v0.1 · Phase 1
      </div>
    </aside>
  );
}
