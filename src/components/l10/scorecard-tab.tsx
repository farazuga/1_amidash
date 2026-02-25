'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, ArrowUp, ArrowDown, Equal } from 'lucide-react';
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
  useUpdateMeasurable,
  useUpsertScorecardEntry,
  useAutoPopulateScorecardWeek,
} from '@/hooks/queries/use-l10-scorecard';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { ScorecardMeasurableWithOwner, ScorecardEntry, GoalDirection, AutoSource } from '@/types/l10';
import { cn } from '@/lib/utils';

// Generate array of last 13 completed week Mondays (most recent first)
function getLast13Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  const day = now.getDay();
  // Get this Monday
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  thisMonday.setHours(0, 0, 0, 0);
  // Start from LAST completed week (one week before this Monday)
  const lastCompletedMonday = new Date(thisMonday);
  lastCompletedMonday.setDate(thisMonday.getDate() - 7);

  for (let i = 0; i < 13; i++) {
    const d = new Date(lastCompletedMonday);
    d.setDate(lastCompletedMonday.getDate() - i * 7);
    weeks.push(d.toISOString().split('T')[0]);
  }
  // Already in newest-first order
  return weeks;
}

// Format week as "M/D - M/D" (Mon-Fri range)
function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00');
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const mStr = `${mon.getMonth() + 1}/${mon.getDate()}`;
  const fStr = `${fri.getMonth() + 1}/${fri.getDate()}`;
  return `${mStr} - ${fStr}`;
}

// Get Friday date string for a given Monday
function getFriday(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00');
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return fri.toISOString().split('T')[0];
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

// Build the projects page URL for clickable scorecard values
function getProjectsUrl(autoSource: AutoSource, weekMonday: string): string {
  const friday = getFriday(weekMonday);
  if (autoSource === 'po_revenue') {
    return `/projects?view=all&date_type=created&date_from=${weekMonday}&date_to=${friday}`;
  }
  if (autoSource === 'invoiced_revenue') {
    return `/projects?view=all&date_type=invoiced&date_from=${weekMonday}&date_to=${friday}`;
  }
  if (autoSource === 'open_projects') {
    return `/projects?view=active`;
  }
  return '';
}

const AUTO_SOURCE_LABELS: Record<string, string> = {
  po_revenue: 'Last 7 Day Sales',
  invoiced_revenue: 'Invoices Closed',
  open_projects: 'Open Projects',
};

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
    // Auto-populate the most recent completed week
    const latestWeek = weeks[0];
    try {
      await autoPopulate.mutateAsync({ teamId, weekOf: latestWeek });
      toast.success('Auto-populated latest week');
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
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium min-w-[180px]">Measurable</th>
                <th className="px-3 py-2 text-left font-medium w-20">Owner</th>
                <th className="px-3 py-2 text-center font-medium w-24">Goal</th>
                {weeks.map((week) => (
                  <th key={week} className="px-1 py-2 text-center font-medium min-w-[80px] text-xs whitespace-nowrap">
                    {formatWeekRange(week)}
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
  const router = useRouter();
  const upsertEntry = useUpsertScorecardEntry();
  const updateMeasurable = useUpdateMeasurable();

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

  const handleCellClick = useCallback(
    (weekMonday: string) => {
      if (measurable.auto_source) {
        const url = getProjectsUrl(measurable.auto_source, weekMonday);
        if (url) router.push(url);
      }
    },
    [measurable.auto_source, router]
  );

  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
        {measurable.title}
        {measurable.auto_source && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({AUTO_SOURCE_LABELS[measurable.auto_source] || 'auto'})
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground text-xs">
        {measurable.profiles?.full_name?.split(' ')[0] || '—'}
      </td>
      <td className="px-2 py-1">
        <EditableGoalCell
          measurableId={measurable.id}
          goalValue={measurable.goal_value}
          goalDirection={measurable.goal_direction}
          unit={measurable.unit}
          onUpdate={updateMeasurable.mutateAsync}
        />
      </td>
      {weeks.map((week) => {
        const entry = entryMap.get(week);
        const val = entry?.value ?? null;
        const onTrack = isOnTrack(val, measurable.goal_value, measurable.goal_direction);
        const isClickable = !!measurable.auto_source;

        return (
          <td key={week} className="px-1 py-1">
            <ScorecardEntryCell
              value={val}
              unit={measurable.unit}
              onTrack={onTrack}
              isClickable={isClickable}
              onSave={(v) => handleCellChange(week, v)}
              onClick={() => handleCellClick(week)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function EditableGoalCell({
  measurableId,
  goalValue,
  goalDirection,
  unit,
  onUpdate,
}: {
  measurableId: string;
  goalValue: number | null;
  goalDirection: GoalDirection;
  unit: string;
  onUpdate: (data: { id: string; goalValue?: number | null; goalDirection?: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = () => {
    setEditValue(goalValue !== null ? String(goalValue) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    setEditing(false);
    const newVal = editValue.trim();
    const numVal = newVal === '' ? null : parseFloat(newVal);
    if (newVal !== '' && isNaN(numVal!)) return;
    const currentVal = goalValue;
    if (numVal !== currentVal) {
      try {
        await onUpdate({ id: measurableId, goalValue: numVal });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleToggleDirection = async () => {
    const nextDirection = goalDirection === 'above' ? 'below' : goalDirection === 'below' ? 'exact' : 'above';
    try {
      await onUpdate({ id: measurableId, goalDirection: nextDirection });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const DirectionIcon = goalDirection === 'above' ? ArrowUp : goalDirection === 'below' ? ArrowDown : Equal;
  const directionLabel = goalDirection === 'above' ? 'Above' : goalDirection === 'below' ? 'Below' : 'Exact';

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-7 w-16 text-center text-xs px-1"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={handleToggleDirection}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title={`Goal: ${directionLabel} — click to change`}
      >
        <DirectionIcon className="h-3 w-3" />
      </button>
      <button
        onClick={handleStartEdit}
        className="text-xs hover:bg-muted rounded px-1 py-0.5 transition-colors"
      >
        {goalValue !== null ? formatValue(goalValue, unit) : '—'}
      </button>
    </div>
  );
}

function ScorecardEntryCell({
  value,
  unit,
  onTrack,
  isClickable,
  onSave,
  onClick,
}: {
  value: number | null;
  unit: string;
  onTrack: boolean | null;
  isClickable: boolean;
  onSave: (value: string) => void;
  onClick: () => void;
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

  const handleClick = () => {
    if (isClickable && value !== null) {
      onClick();
    } else {
      handleEdit();
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
      onClick={handleClick}
      onDoubleClick={isClickable ? handleEdit : undefined}
      className={cn(
        'w-full h-7 rounded text-xs text-center transition-colors',
        onTrack === true && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-medium',
        onTrack === false && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-medium',
        onTrack === null && 'hover:bg-muted',
        isClickable && value !== null ? 'cursor-pointer underline decoration-dotted underline-offset-2' : 'cursor-pointer'
      )}
      title={isClickable && value !== null ? 'Click to view projects, double-click to edit' : undefined}
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

  // Auto-fill title and unit when selecting an auto-source
  const handleAutoSourceChange = (value: string) => {
    setAutoSource(value);
    if (value !== 'none' && !title.trim()) {
      setTitle(AUTO_SOURCE_LABELS[value] || '');
      if (value === 'po_revenue' || value === 'invoiced_revenue') {
        setUnit('currency');
      } else if (value === 'open_projects') {
        setUnit('number');
      }
    }
  };

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
              <Label>Auto-populate Source (optional)</Label>
              <Select value={autoSource} onValueChange={handleAutoSourceChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual entry</SelectItem>
                  <SelectItem value="po_revenue">Last 7 Day Sales (by created date)</SelectItem>
                  <SelectItem value="invoiced_revenue">Invoices Closed (by invoice date)</SelectItem>
                  <SelectItem value="open_projects">Open Projects (active count)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
