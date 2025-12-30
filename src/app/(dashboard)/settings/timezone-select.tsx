'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'UTC', label: 'UTC' },
];

interface TimezoneSelectProps {
  currentTimezone: string;
}

export function TimezoneSelect({ currentTimezone }: TimezoneSelectProps) {
  const [timezone, setTimezone] = useState(currentTimezone);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (value: string) => {
    setTimezone(value);
    setHasChanges(value !== currentTimezone);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        throw new Error('Failed to save timezone');
      }

      toast.success('Timezone updated');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save timezone');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Select value={timezone} onValueChange={handleChange}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasChanges && (
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      )}
    </div>
  );
}
