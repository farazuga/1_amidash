'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { ProjectSearch } from '@/components/per-diem/project-search';
import {
  useCreateEntry,
  useUpdateEntry,
  usePerDiemRates,
  useStaffUsers,
} from '@/hooks/queries/use-per-diems';
import {
  getLocationType,
  calculateNights,
  calculateTotal,
  formatCurrency,
} from '@/lib/per-diem/utils';
import type { PerDiemEntry, PerDiemLocationType } from '@/types/per-diem';

interface NewEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId: string;
  editEntry?: PerDiemEntry | null;
}

export function NewEntryDialog({
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
  editEntry,
}: NewEntryDialogProps) {
  const isEditing = !!editEntry;

  // Queries
  const { data: rates } = usePerDiemRates();
  const { data: staffUsers = [] } = useStaffUsers();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  // Form state
  const [userId, setUserId] = useState(currentUserId);
  const [project, setProject] = useState<{
    id: string | null;
    label: string;
  }>({ id: null, label: '' });
  const [projectOtherNote, setProjectOtherNote] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [nights, setNights] = useState(0);
  const [nightsOverridden, setNightsOverridden] = useState(false);
  const [locationType, setLocationType] = useState<PerDiemLocationType>('in_state');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Computed values
  const rate = useMemo(() => {
    if (!rates) return 0;
    return locationType === 'in_state' ? rates.in_state_rate : rates.out_of_state_rate;
  }, [rates, locationType]);

  const total = useMemo(() => calculateTotal(nights, rate), [nights, rate]);

  // Auto-calculate nights when dates change
  const autoNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return calculateNights(
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    );
  }, [startDate, endDate]);

  // When dates change, update nights if not manually overridden
  useEffect(() => {
    if (!nightsOverridden) {
      setNights(autoNights);
    } else if (autoNights === nights) {
      // If the user's value now matches auto-calculated, remove override
      setNightsOverridden(false);
    }
  }, [autoNights]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when dialog opens/closes or editEntry changes
  useEffect(() => {
    if (open) {
      if (editEntry) {
        setUserId(editEntry.user_id);
        setProject({
          id: editEntry.project_id,
          label: editEntry.project
            ? editEntry.project.sales_order_number
              ? `[${editEntry.project.sales_order_number}] ${editEntry.project.client_name}`
              : editEntry.project.client_name
            : editEntry.project_id
              ? 'Project'
              : 'Other',
        });
        setProjectOtherNote(editEntry.project_other_note || '');
        setStartDate(parseISO(editEntry.start_date));
        setEndDate(parseISO(editEntry.end_date));
        setNights(editEntry.nights);
        setNightsOverridden(editEntry.nights_overridden);
        setLocationType(editEntry.location_type);
      } else {
        setUserId(currentUserId);
        setProject({ id: null, label: '' });
        setProjectOtherNote('');
        setStartDate(undefined);
        setEndDate(undefined);
        setNights(0);
        setNightsOverridden(false);
        setLocationType('in_state');
      }
    }
  }, [open, editEntry, currentUserId]);

  const handleProjectChange = (
    selected: {
      id: string | null;
      client_name: string;
      sales_order_number: string | null;
      delivery_state: string | null;
    } | null
  ) => {
    if (!selected) {
      setProject({ id: null, label: '' });
      setProjectOtherNote('');
      return;
    }

    const label = selected.id
      ? selected.sales_order_number
        ? `[${selected.sales_order_number}] ${selected.client_name}`
        : selected.client_name
      : 'Other';

    setProject({ id: selected.id, label });

    // Auto-set location type from project's delivery state
    if (selected.id) {
      setLocationType(getLocationType(selected.delivery_state));
      setProjectOtherNote('');
    }
  };

  const handleNightsChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setNights(num);
    setNightsOverridden(num !== autoNights);
  };

  const isPending = createEntry.isPending || updateEntry.isPending;

  const handleSubmit = async () => {
    // Validation
    if (!project.label) {
      toast.error('Please select a project');
      return;
    }
    if (!project.id && !projectOtherNote.trim()) {
      toast.error('Please provide a trip description');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (nights <= 0) {
      toast.error('Nights must be at least 1');
      return;
    }

    const computedTotal = calculateTotal(nights, rate);

    try {
      if (isEditing && editEntry) {
        await updateEntry.mutateAsync({
          id: editEntry.id,
          project_id: project.id || undefined,
          project_other_note: project.id ? undefined : projectOtherNote.trim(),
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          nights,
          nights_overridden: nightsOverridden,
          location_type: locationType,
          rate,
          total: computedTotal,
        });
        toast.success('Per diem entry updated');
      } else {
        await createEntry.mutateAsync({
          user_id: userId,
          project_id: project.id || undefined,
          project_other_note: project.id ? undefined : projectOtherNote.trim(),
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          nights,
          nights_overridden: nightsOverridden,
          location_type: locationType,
          rate,
          total: computedTotal,
        });
        toast.success('Per diem entry created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        isEditing
          ? 'Failed to update per diem entry'
          : 'Failed to create per diem entry'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Per Diem Entry' : 'New Per Diem Entry'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Submit on behalf of (admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="user-select">Submit on behalf of</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="user-select" className="w-full">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project */}
          <div className="space-y-2">
            <Label>Project</Label>
            <ProjectSearch value={project} onChange={handleProjectChange} />
          </div>

          {/* Trip Description (shown when "Other" selected) */}
          {project.label === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="trip-description">Trip Description</Label>
              <Textarea
                id="trip-description"
                placeholder="Describe the trip..."
                value={projectOtherNote}
                onChange={(e) => setProjectOtherNote(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Project Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    defaultMonth={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setStartDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    defaultMonth={endDate || startDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setEndDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Nights */}
          <div className="space-y-2">
            <Label htmlFor="nights">Nights</Label>
            <Input
              id="nights"
              type="number"
              min={0}
              value={nights}
              onChange={(e) => handleNightsChange(e.target.value)}
              className={cn(
                nightsOverridden && 'bg-yellow-100 border-yellow-400'
              )}
            />
            {nightsOverridden && (
              <p className="text-xs text-yellow-700">
                Manually overridden (calculated: {autoNights})
              </p>
            )}
          </div>

          {/* In/Out State */}
          <div className="space-y-2">
            <Label htmlFor="location-type">In/Out State</Label>
            <Select
              value={locationType}
              onValueChange={(value) => setLocationType(value as PerDiemLocationType)}
            >
              <SelectTrigger id="location-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_state">In State</SelectItem>
                <SelectItem value="out_of_state">Out of State</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rate (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="rate">Rate</Label>
            <Input
              id="rate"
              value={formatCurrency(rate)}
              readOnly
              className="bg-muted"
            />
          </div>

          {/* Total (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="total">Total</Label>
            <Input
              id="total"
              value={formatCurrency(total)}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
