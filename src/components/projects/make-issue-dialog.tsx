'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTeams } from '@/hooks/queries/use-l10-teams';
import { useCreateIssue } from '@/hooks/queries/use-l10-issues';
import { toast } from 'sonner';

interface MakeIssueDialogProps {
  project: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    sales_order_url: string | null;
    sales_amount: number | null;
  };
}

export function MakeIssueButton({ project }: MakeIssueDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
        Make Issue
      </Button>

      <MakeIssueDialog
        open={open}
        onOpenChange={setOpen}
        project={project}
      />
    </>
  );
}

function MakeIssueDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: MakeIssueDialogProps['project'];
}) {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const createIssue = useCreateIssue();

  const defaultTitle = [project.client_name, project.sales_order_number]
    .filter(Boolean)
    .join(' - ');

  const defaultDescription = [
    `Project: ${project.client_name}`,
    project.sales_order_number ? `Sales Order: ${project.sales_order_number}` : null,
    project.sales_amount ? `Amount: $${project.sales_amount.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !title.trim()) return;

    try {
      await createIssue.mutateAsync({
        teamId,
        title: title.trim(),
        description: description.trim() || undefined,
        sourceType: 'project',
        sourceId: project.id,
        sourceMeta: {
          salesOrder: project.sales_order_number || '',
          salesOrderUrl: project.sales_order_url || '',
          clientName: project.client_name,
        },
      });
      const teamName = teams?.find((t) => t.id === teamId)?.name || 'team';
      toast.success(`Issue created in ${teamName}`);
      onOpenChange(false);
      setTeamId('');
      setTitle(defaultTitle);
      setDescription(defaultDescription);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create L10 Issue from Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder={teamsLoading ? 'Loading...' : 'Select team...'} />
                </SelectTrigger>
                <SelectContent>
                  {(teams || []).map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!teamId || !title.trim() || createIssue.isPending}>
              {createIssue.isPending ? 'Creating...' : 'Create Issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
