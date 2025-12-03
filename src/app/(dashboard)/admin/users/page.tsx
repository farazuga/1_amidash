'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Profile, UserRole } from '@/types';

const roleColors: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  editor: 'bg-blue-500 text-white',
  viewer: 'bg-gray-500 text-white',
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    startTransition(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        toast.error('Failed to update user role');
        return;
      }

      toast.success('User role updated');
      loadUsers();
    });
  };

  const handleSalespersonChange = async (userId: string, isSalesperson: boolean) => {
    startTransition(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_salesperson: isSalesperson })
        .eq('id', userId);

      if (error) {
        toast.error('Failed to update salesperson status');
        return;
      }

      toast.success(isSalesperson ? 'Marked as salesperson' : 'Removed salesperson status');
      loadUsers();
    });
  };

  const getInitials = (user: Profile) => {
    if (user.full_name) {
      return user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user roles and permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Users are added when they sign up. Change their role to control access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.full_name || 'No name'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as UserRole)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue>
                          <Badge className={roleColors[user.role]}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <Badge className={roleColors.viewer}>Viewer</Badge>
                        </SelectItem>
                        <SelectItem value="editor">
                          <Badge className={roleColors.editor}>Editor</Badge>
                        </SelectItem>
                        <SelectItem value="admin">
                          <Badge className={roleColors.admin}>Admin</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`salesperson-${user.id}`}
                        checked={user.is_salesperson || false}
                        onCheckedChange={(checked) =>
                          handleSalespersonChange(user.id, checked)
                        }
                        disabled={isPending}
                      />
                      <Label
                        htmlFor={`salesperson-${user.id}`}
                        className="text-sm text-muted-foreground"
                      >
                        {user.is_salesperson ? 'Yes' : 'No'}
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Badge className={roleColors.viewer}>Viewer</Badge>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>View dashboard</li>
                <li>View projects</li>
                <li>Use filters and search</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Badge className={roleColors.editor}>Editor</Badge>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>All Viewer permissions</li>
                <li>Create projects</li>
                <li>Edit projects</li>
                <li>Change project status</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Badge className={roleColors.admin}>Admin</Badge>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>All Editor permissions</li>
                <li>Manage users</li>
                <li>Manage statuses</li>
                <li>Manage tags</li>
                <li>View audit logs</li>
                <li>Delete projects</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
