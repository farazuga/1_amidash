'use client';

import { useState, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
import {
  useScorecard,
  useCreateMeasurable,
  useUpsertScorecardEntry,
  useAutoPopulateScorecardWeek,
} from '@/hooks/queries/use-l10-scorecard';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { ScorecardMeasurableWithOwner, ScorecardEntry, GoalDirection } from '@/types/l10';
import { cn } from '@/lib/utils';

// Generate array of last 13 Monday dates
function getLast13Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  for (let i = 12; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i * 7);
    weeks.push(d.toISOString().split('T')[0]);
  }
  return weeks;
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOnTrack(value: number | null, goal: number | null, direction: GoalDirection): boolean | null {
  if (value === null || goal === null) return null;
  if (direction === 'above') return value >= goal;
  if (direction === 'below') return value <= goal;
  return value === goal;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '';
  if (unit === 'currency') return `$${value.toLocaleString()}`;
  if (unit === 'percentage') return `${value}%`;
  return value.toLocaleString();
}

interface ScorecardTabProps {
  teamId: string;
}

export function ScorecardTab({ teamId }: ScorecardTabProps) {
  const { data: scorecardData, isLoading } = useScorecard(teamId);
  const { data: team } = useTeam(teamId);
  const [addOpen, setAddOpen] = useState(false);
  const autoPopulate = useAutoPopulateScorecardWeek();
  const weeks = getLast13Weeks();

  const handleAutoPopulate = async () => {
    const currentWeek = weeks[weeks.length - 1];
    try {
      await autoPopulate.mutateAsync({ teamId, weekOf: currentWeek });
      toast.success('Auto-populated current week');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  const measurables = scorecardData?.measurables || [];
  const entries = scorecardData?.entries || [];
  const scorecardId = scorecardData?.scorecard?.id;

  // Build entry lookup: measurableId -> weekOf -> entry
  const entryMap = new Map<string, Map<string, ScorecardEntry>>();
  for (const entry of entries) {
    if (!entryMap.has(entry.measurable_id)) {
      entryMap.set(entry.measurable_id, new Map());
    }
    entryMap.get(entry.measurable_id)!.set(entry.week_of, entry);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Scorecard</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoPopulate} disabled={autoPopulate.isPending}>
            <RefreshCw className={cn('mr-2 h-4 w-4', autoPopulate.isPending && 'animate-spin')} />
            Auto-populate
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!scorecardId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Measurable
          </Button>
        </div>
      </div>

      {measurables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>No measurables yet. Add your first KPI to track weekly.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium min-w-[180px]">Measurable</th>
                <th className="px-3 py-2 text-left font-medium w-20">Owner</th>
                <th className="px-3 py-2 text-right font-medium w-16">Goal</th>
                {weeks.map((week) => (
                  <th key={week} className="px-2 py-2 text-center font-medium w-20 text-xs">
                    {formatWeek(week)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurables.map((m) => (
                <MeasurableRow
                  key={m.id}
                  measurable={m}
                  weeks={weeks}
                  entryMap={entryMap.get(m.id) || new Map()}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scorecardId && (
        <AddMeasurableDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          scorecardId={scorecardId}
          members={team?.team_members || []}
        />
      )}
    </div>
  );
}

function MeasurableRow({
  measurable,
  weeks,
  entryMap,
}: {
  measurable: ScorecardMeasurableWithOwner;
  weeks: string[];
  entryMap: Map<string, ScorecardEntry>;
}) {
  const upsertEntry = useUpsertScorecardEntry();

  const handleCellChange = useCallback(
    async (weekOf: string, value: string) => {
      const numValue = value.trim() === '' ? null : parseFloat(value);
      if (value.trim() !== '' && isNaN(numValue!)) return;
      try {
        await upsertEntry.mutateAsync({
          measurableId: measurable.id,
          weekOf,
          value: numValue,
        });
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [measurable.id, upsertEntry]
  );

  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="sticky left-0 bg-background px-3 py-2 font-medium">
        {measurable.title}
        {measurable.auto_source && (
          <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground text-xs">
        {measurable.profiles?.full_name?.split(' ')[0] || '—'}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {measurable.goal_value !== null ? formatValue(measurable.goal_value, measurable.unit) : '—'}
      </td>
      {weeks.map((week) => {
        const entry = entryMap.get(week);
        const val = entry?.value ?? null;
        const onTrack = isOnTrack(val, measurable.goal_value, measurable.goal_direction);

        return (
          <td key={week} className="px-1 py-1">
            <ScorecardEntryCell
              value={val}
              unit={measurable.unit}
              onTrack={onTrack}
              onSave={(v) => handleCellChange(week, v)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function ScorecardEntryCell({
  value,
  unit,
  onTrack,
  onSave,
}: {
  value: number | null;
  unit: string;
  onTrack: boolean | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleEdit = () => {
    setEditValue(value !== null ? String(value) : '');
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const newVal = editValue.trim();
    const currentVal = value !== null ? String(value) : '';
    if (newVal !== currentVal) {
      onSave(newVal);
    }
  };

  if (editing) {
    return (
      <Input
        className="h-7 w-16 text-center text-xs px-1"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleBlur();
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={handleEdit}
      className={cn(
        'w-full h-7 rounded text-xs text-center cursor-pointer transition-colors',
        onTrack === true && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        onTrack === false && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        onTrack === null && 'hover:bg-muted'
      )}
    >
      {value !== null ? formatValue(value, unit) : '—'}
    </button>
  );
}

function AddMeasurableDialog({
  open,
  onOpenChange,
  scorecardId,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scorecardId: string;
  members: { user_id: string; profiles: { id: string; full_name: string | null; email: string } }[];
}) {
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [unit, setUnit] = useState('number');
  const [goalValue, setGoalValue] = useState('');
  const [goalDirection, setGoalDirection] = useState('above');
  const [autoSource, setAutoSource] = useState('none');
  const createMeasurable = useCreateMeasurable();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createMeasurable.mutateAsync({
        scorecardId,
        title: title.trim(),
        ownerId: ownerId || undefined,
        unit,
        goalValue: goalValue ? parseFloat(goalValue) : undefined,
        goalDirection,
        autoSource: autoSource === 'none' ? null : autoSource,
      });
      toast.success('Measurable added');
      onOpenChange(false);
      setTitle('');
      setOwnerId('');
      setUnit('number');
      setGoalValue('');
      setGoalDirection('above');
      setAutoSource('none');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Measurable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Revenue" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goal Value</Label>
                <Input type="number" value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder="e.g. 10000" />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={goalDirection} onValueChange={setGoalDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">At or Above</SelectItem>
                    <SelectItem value="below">At or Below</SelectItem>
                    <SelectItem value="exact">Exact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Auto-populate Source (optional)</Label>
              <Select value={autoSource} onValueChange={setAutoSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual entry</SelectItem>
                  <SelectItem value="po_revenue">PO Revenue (created_date)</SelectItem>
                  <SelectItem value="invoiced_revenue">Invoiced Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || createMeasurable.isPending}>
              {createMeasurable.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
