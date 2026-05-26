'use client';

import Link from 'next/link';
import { Bell, Command as CommandIcon, LogOut, Search, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABEL } from '@/lib/auth/rbac';
import { initials } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User } from '@/types/database.types';
import { useCommandPalette } from '@/components/shell/command-palette';

export function Topbar({ user, unreadCount }: { user: User; unreadCount: number }) {
  const supabase = createSupabaseBrowserClient();
  const palette = useCommandPalette();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={palette.open}
        className="group flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:block">Search tickets, clients, job codes…</span>
        <span className="sm:hidden">Search</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground sm:flex">
          <CommandIcon className="h-3 w-3" />K
        </kbd>
      </button>

      <Link
        href="/notifications"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
              <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-xs font-medium">{user.full_name}</span>
              <span className="text-[10px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={'/settings/profile' as never} className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut} className="text-rose-600">
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
