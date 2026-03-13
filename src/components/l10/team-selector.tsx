'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeams } from '@/hooks/queries/use-l10-teams';
import { useL10TeamStore } from '@/lib/stores/l10-team-store';
import { useEffect } from 'react';

export function TeamSelector() {
  const { data: teams, isLoading } = useTeams();
  const { selectedTeamId, setSelectedTeamId } = useL10TeamStore();

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeamId && teams && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
    // Clear selection if selected team no longer exists
    if (selectedTeamId && teams && !teams.find((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(teams.length > 0 ? teams[0].id : null);
    }
  }, [teams, selectedTeamId, setSelectedTeamId]);

  if (isLoading) {
    return (
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
    );
  }

  if (!teams || teams.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedTeamId || undefined}
      onValueChange={setSelectedTeamId}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select team..." />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
