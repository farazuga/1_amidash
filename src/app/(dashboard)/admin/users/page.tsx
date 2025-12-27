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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2, KeyRound, Calendar } from 'lucide-react';
import type { Profile, UserRole } from '@/types';
import { createCalendarSubscriptionForUser } from '@/app/(dashboard)/calendar/actions';

const roleColors: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  editor: 'bg-blue-500 text-white',
  viewer: 'bg-gray-500 text-white',
  customer: 'bg-emerald-500 text-white',
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  // Add user dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('viewer');
  const [newUserIsSalesperson, setNewUserIsSalesperson] = useState(false);
  const [newUserIsAssignable, setNewUserIsAssignable] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');

  // Delete user dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password dialog state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // iCal link generation state
  const [generatingICalForUser, setGeneratingICalForUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const [usersRes, userRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.auth.getUser(),
      ]);

      if (!cancelled) {
        setUsers((usersRes.data || []) as Profile[]);
        setCurrentUserId(userRes.data.user?.id || null);
        setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [supabase]);

  // Function to reload users after mutations
  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers((data || []) as Profile[]);
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

  const handleAssignableChange = async (userId: string, isAssignable: boolean) => {
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ is_assignable: isAssignable })
        .eq('id', userId);

      if (error) {
        toast.error('Failed to update assignable status');
        return;
      }

      toast.success(isAssignable ? 'User can now be assigned to projects' : 'Removed assignable status');
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

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    // Validate password for customers
    if (newUserRole === 'customer' && (!newUserPassword || newUserPassword.length < 8)) {
      toast.error('Password is required for customers (minimum 8 characters)');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          full_name: newUserName.trim() || null,
          role: newUserRole,
          is_salesperson: newUserRole === 'customer' ? false : newUserIsSalesperson,
          password: newUserRole === 'customer' ? newUserPassword : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to add user');
        return;
      }

      toast.success(data.message || 'User added successfully');
      setAddDialogOpen(false);
      resetAddForm();
      loadUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    } finally {
      setIsAdding(false);
    }
  };

  const resetAddForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserRole('viewer');
    setNewUserIsSalesperson(false);
    setNewUserIsAssignable(false);
    setNewUserPassword('');
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;

    if (!resetPassword || resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/admin/users/${userToResetPassword.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reset password');
        return;
      }

      toast.success('Password reset successfully');
      setResetPasswordDialogOpen(false);
      setUserToResetPassword(null);
      setResetPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to delete user');
        return;
      }

      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGetUserICalLink = async (userId: string, userName: string) => {
    setGeneratingICalForUser(userId);
    try {
      const result = await createCalendarSubscriptionForUser(userId);
      if (!result.success) {
        toast.error(result.error || 'Failed to generate calendar link');
        return;
      }
      await navigator.clipboard.writeText(result.data!.url);
      toast.success(`Calendar link for ${userName} copied to clipboard!`);
    } catch (error) {
      console.error('Error generating iCal link:', error);
      toast.error('Failed to generate calendar link');
    } finally {
      setGeneratingICalForUser(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) resetAddForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                {newUserRole === 'customer'
                  ? 'Create a customer account. You must set their password.'
                  : 'Create a new user account. They will need to use "Forgot Password" to set their password.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(v) => {
                  setNewUserRole(v as UserRole);
                  if (v === 'customer') {
                    setNewUserIsSalesperson(false);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
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
                    <SelectItem value="customer">
                      <Badge className={roleColors.customer}>Customer</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newUserRole === 'customer' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set the initial password for this customer account.
                  </p>
                </div>
              )}
              {newUserRole !== 'customer' && (
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="salesperson"
                      checked={newUserIsSalesperson}
                      onCheckedChange={setNewUserIsSalesperson}
                    />
                    <Label htmlFor="salesperson">Salesperson</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="assignable"
                      checked={newUserIsAssignable}
                      onCheckedChange={setNewUserIsAssignable}
                    />
                    <Label htmlFor="assignable">Can be assigned to projects</Label>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={isAdding}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions.
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
                <TableHead>Assignable</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
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
                      value={user.role ?? 'viewer'}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as UserRole)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue>
                          <Badge className={roleColors[(user.role ?? 'viewer') as UserRole]}>
                            {(user.role ?? 'viewer').charAt(0).toUpperCase() + (user.role ?? 'viewer').slice(1)}
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
                        <SelectItem value="customer">
                          <Badge className={roleColors.customer}>Customer</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.role !== 'customer' ? (
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
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role !== 'customer' ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`assignable-${user.id}`}
                          checked={user.is_assignable || false}
                          onCheckedChange={(checked) =>
                            handleAssignableChange(user.id, checked)
                          }
                          disabled={isPending}
                        />
                        <Label
                          htmlFor={`assignable-${user.id}`}
                          className="text-sm text-muted-foreground"
                        >
                          {user.is_assignable ? 'Yes' : 'No'}
                        </Label>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {user.role !== 'customer' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGetUserICalLink(user.id, user.full_name || user.email)}
                          disabled={generatingICalForUser === user.id}
                          title="Copy personal calendar link"
                        >
                          {generatingICalForUser === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Calendar className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUserToResetPassword(user);
                          setResetPasswordDialogOpen(true);
                        }}
                        title="Set password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={user.id === currentUserId}
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        title={user.id === currentUserId ? "You cannot delete yourself" : "Delete user"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
          <div className="grid gap-4 md:grid-cols-4">
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
                <li>Add and delete users</li>
                <li>Manage statuses</li>
                <li>Manage tags</li>
                <li>View audit logs</li>
                <li>Delete projects</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Badge className={roleColors.customer}>Customer</Badge>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>View own projects</li>
                <li>View project status</li>
                <li>Manage email preferences</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.full_name || userToDelete?.email}?
              This action cannot be undone. The user will lose access to the system immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={(open) => {
        setResetPasswordDialogOpen(open);
        if (!open) {
          setUserToResetPassword(null);
          setResetPassword('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {userToResetPassword?.full_name || userToResetPassword?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetPassword">New Password</Label>
              <Input
                id="resetPassword"
                type="password"
                placeholder="Minimum 8 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialogOpen(false)}
              disabled={isResettingPassword}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
