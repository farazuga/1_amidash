'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import type { Status } from '@/types';

export default function StatusesAdminPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    const { data } = await supabase
      .from('statuses')
      .select('*')
      .order('display_order');
    setStatuses(data || []);
    setIsLoading(false);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      progress_percent: parseInt(formData.get('progress_percent') as string),
      require_note: formData.get('require_note') === 'on',
      is_active: true,
    };

    startTransition(async () => {
      if (editingStatus) {
        const { error } = await supabase
          .from('statuses')
          .update(data)
          .eq('id', editingStatus.id);

        if (error) {
          toast.error('Failed to update status');
          return;
        }
        toast.success('Status updated');
      } else {
        const maxOrder = Math.max(...statuses.map(s => s.display_order), 0);
        const { error } = await supabase
          .from('statuses')
          .insert({ ...data, display_order: maxOrder + 1 });

        if (error) {
          toast.error('Failed to create status');
          return;
        }
        toast.success('Status created');
      }

      setIsDialogOpen(false);
      setEditingStatus(null);
      loadStatuses();
    });
  };

  const toggleActive = async (status: Status) => {
    const { error } = await supabase
      .from('statuses')
      .update({ is_active: !status.is_active })
      .eq('id', status.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    loadStatuses();
  };

  const toggleRequireNote = async (status: Status) => {
    const { error } = await supabase
      .from('statuses')
      .update({ require_note: !status.require_note })
      .eq('id', status.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    loadStatuses();
    toast.success('Updated require note setting');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status Management</h1>
          <p className="text-muted-foreground">
            Configure project statuses and their settings
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStatus(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>
                  {editingStatus ? 'Edit Status' : 'Add New Status'}
                </DialogTitle>
                <DialogDescription>
                  Configure the status settings below
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Status Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingStatus?.name || ''}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="progress_percent">Progress Percentage</Label>
                  <Input
                    id="progress_percent"
                    name="progress_percent"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingStatus?.progress_percent || 0}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_note"
                    name="require_note"
                    defaultChecked={editingStatus?.require_note || false}
                  />
                  <Label htmlFor="require_note">Require note when selecting this status</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Statuses</CardTitle>
          <CardDescription>
            Drag to reorder. Toggle "Require Note" for statuses that need explanation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Status Name</TableHead>
                <TableHead>Progress %</TableHead>
                <TableHead>Require Note</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((status) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{status.name}</span>
                      {status.require_note && (
                        <Badge variant="outline" className="text-xs">
                          Note Required
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{status.progress_percent}%</TableCell>
                  <TableCell>
                    <Switch
                      checked={status.require_note}
                      onCheckedChange={() => toggleRequireNote(status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={status.is_active}
                      onCheckedChange={() => toggleActive(status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingStatus(status);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
