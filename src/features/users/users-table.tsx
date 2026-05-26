'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, Power, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABEL } from '@/lib/auth/rbac';
import { cn, initials } from '@/lib/utils';
import type { UserRole } from '@/types/database.types';
import type { UserWithRelations } from '@/features/users/queries';
import { setUserActive, updateUserDepartment, updateUserRole } from '@/features/users/actions';
import { USER_ROLES } from '@/lib/validations/users';
import { ClientAssignmentsDialog } from './client-assignments-dialog';

type Department = { id: string; name: string };
type ClientLite = { id: string; client_code: string; client_name: string; brand_code: string };

export function UsersTable({
  users,
  departments,
  clients,
  currentUserId,
}: {
  users: UserWithRelations[];
  departments: Department[];
  clients: ClientLite[];
  currentUserId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5">User</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Department</th>
            <th className="px-4 py-2.5">Clients</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              departments={departments}
              clients={clients}
              isSelf={u.id === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  user,
  departments,
  clients,
  isSelf,
}: {
  user: UserWithRelations;
  departments: Department[];
  clients: ClientLite[];
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState(false);
  const [editingDept, setEditingDept] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  function changeRole(role: UserRole) {
    startTransition(async () => {
      const r = await updateUserRole({ user_id: user.id, role });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Role set to ${ROLE_LABEL[role]}`);
      setEditingRole(false);
    });
  }

  function changeDept(dept_id: string | null) {
    startTransition(async () => {
      const r = await updateUserDepartment({ user_id: user.id, department_id: dept_id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Department updated');
      setEditingDept(false);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const r = await setUserActive({ user_id: user.id, is_active: !user.is_active });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(user.is_active ? 'User deactivated' : 'User reactivated');
    });
  }

  const isAm = ['client_servicing', 'management', 'super_admin'].includes(user.role);

  return (
    <tr className={cn('border-b last:border-0 hover:bg-accent/30', !user.is_active && 'opacity-60')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
            <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium">
              {user.full_name}
              {isSelf && (
                <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  You
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        {editingRole ? (
          <div className="flex items-center gap-1">
            <Select
              defaultValue={user.role}
              onValueChange={(v) => changeRole(v as UserRole)}
              disabled={isPending}
            >
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => setEditingRole(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingRole(true)}
            className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent"
            disabled={isPending}
          >
            <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </td>

      <td className="px-4 py-3">
        {editingDept ? (
          <div className="flex items-center gap-1">
            <Select
              defaultValue={user.department_id ?? 'none'}
              onValueChange={(v) => changeDept(v === 'none' ? null : v)}
              disabled={isPending}
            >
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => setEditingDept(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingDept(true)}
            className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent"
            disabled={isPending}
          >
            <span className={cn(!user.department && 'text-muted-foreground')}>
              {user.department?.name ?? 'No department'}
            </span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </td>

      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          disabled={!isAm}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
            isAm ? 'hover:bg-accent' : 'cursor-not-allowed opacity-50',
          )}
        >
          <UsersIcon className="h-3 w-3" />
          {user.assignments.length} assigned
          {user.managed_clients_count > 0 && (
            <Badge variant="muted" className="text-[10px]">
              {user.managed_clients_count} AM
            </Badge>
          )}
        </button>
        {assignOpen && (
          <ClientAssignmentsDialog
            user={user}
            clients={clients}
            open={assignOpen}
            onOpenChange={setAssignOpen}
          />
        )}
      </td>

      <td className="px-4 py-3">
        <Badge variant={user.is_active ? 'success' : 'muted'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>

      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending || isSelf}
          onClick={toggleActive}
          className={user.is_active ? 'text-rose-600' : 'text-emerald-600'}
        >
          {user.is_active ? (
            <>
              <Power className="h-3.5 w-3.5" /> Deactivate
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> Reactivate
            </>
          )}
        </Button>
      </td>
    </tr>
  );
}
