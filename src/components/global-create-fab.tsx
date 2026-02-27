'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
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
import { useUser } from '@/contexts/user-context';
import { useTeams, useTeam } from '@/hooks/queries/use-l10-teams';
import { useCreateIssue } from '@/hooks/queries/use-l10-issues';
import { useCreateTodo } from '@/hooks/queries/use-l10-todos';
import { useL10TeamStore } from '@/lib/stores/l10-team-store';
import { getProjectBasicInfo } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

type CreateType = 'issue' | 'todo';

interface ProjectContext {
  id: string;
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  sales_amount: number | null;
}

function useProjectContext(): ProjectContext | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)$/);
  const salesOrder = match?.[1] ?? null;

  const { data } = useQuery({
    queryKey: ['project-basic', salesOrder],
    queryFn: async () => {
      if (!salesOrder) return null;
      const result = await getProjectBasicInfo(salesOrder);
      if (!result.success) return null;
      return result.data ?? null;
    },
    staleTime: 60 * 1000,
    enabled: !!salesOrder,
  });

  return data ?? null;
}

export function GlobalCreateFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useUser();
  const { data: teams } = useTeams();
  const { selectedTeamId, setSelectedTeamId } = useL10TeamStore();
  const projectContext = useProjectContext();
  const createIssue = useCreateIssue();
  const createTodo = useCreateTodo();

  const hasMultipleTeams = (teams?.length ?? 0) > 1;

  // Resolve effective team: stored selection → first team
  const effectiveTeamId = useMemo(() => {
    if (selectedTeamId && teams?.some((t) => t.id === selectedTeamId)) {
      return selectedTeamId;
    }
    return teams?.[0]?.id ?? null;
  }, [selectedTeamId, teams]);

  const [type, setType] = useState<CreateType>('todo');
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Fetch team members for todo owner picker
  const { data: teamData } = useTeam(teamId || null);
  const members = teamData?.team_members || [];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setType('todo');
      setTeamId(effectiveTeamId ?? '');
      setOwnerId(user?.id ?? '');
      setDueDate('');

      if (projectContext) {
        const defaultTitle = [projectContext.client_name, projectContext.sales_order_number]
          .filter(Boolean)
          .join(' - ');
        setTitle(defaultTitle);
        setDescription(
          [
            `Project: ${projectContext.client_name}`,
            projectContext.sales_order_number ? `Sales Order: ${projectContext.sales_order_number}` : null,
            projectContext.sales_amount ? `Amount: $${projectContext.sales_amount.toLocaleString()}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        );
      } else {
        setTitle('');
        setDescription('');
      }
    }
  }, [open, effectiveTeamId, user?.id, projectContext]);

  const handleTeamChange = (id: string) => {
    setTeamId(id);
    setSelectedTeamId(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !title.trim()) return;

    try {
      if (type === 'issue') {
        await createIssue.mutateAsync({
          teamId,
          title: title.trim(),
          description: description.trim() || undefined,
          ...(projectContext
            ? {
                sourceType: 'project',
                sourceId: projectContext.id,
                sourceMeta: {
                  salesOrder: projectContext.sales_order_number || '',
                  salesOrderUrl: projectContext.sales_order_url || '',
                  clientName: projectContext.client_name,
                },
              }
            : {}),
        });
        toast.success('Issue created');
      } else {
        await createTodo.mutateAsync({
          teamId,
          title: title.trim(),
          ownerId: ownerId || undefined,
          dueDate: dueDate || undefined,
        });
        toast.success('To-do created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const isPending = createIssue.isPending || createTodo.isPending;
  const noTeams = !teams || teams.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {projectContext ? `New ${type === 'issue' ? 'Issue' : 'To-Do'} — ${projectContext.client_name}` : `New ${type === 'issue' ? 'Issue' : 'To-Do'}`}
          </DialogTitle>
        </DialogHeader>

        {noTeams ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Create an L10 team first to use this feature.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Type picker */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === 'todo' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setType('todo')}
                >
                  To-Do
                </Button>
                <Button
                  type="button"
                  variant={type === 'issue' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setType('issue')}
                >
                  Issue
                </Button>
              </div>

              {/* Team picker - only when multiple teams */}
              {hasMultipleTeams && (
                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select value={teamId} onValueChange={handleTeamChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team..." />
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
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'issue' ? "What's the issue?" : 'What needs to be done?'}
                  autoFocus
                />
              </div>

              {/* Description - issues only */}
              {type === 'issue' && (
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details..."
                    rows={3}
                  />
                </div>
              )}

              {/* Todo-specific fields */}
              {type === 'todo' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select value={ownerId} onValueChange={setOwnerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.profiles.full_name || m.profiles.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!teamId || !title.trim() || isPending}>
                {isPending ? 'Creating...' : `Create ${type === 'issue' ? 'Issue' : 'To-Do'}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
