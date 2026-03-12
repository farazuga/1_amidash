'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamSelector } from './team-selector';
import { CreateTeamDialog } from './teams/create-team-dialog';
import { TeamSettingsDialog } from './teams/team-settings-dialog';
import { useTeams } from '@/hooks/queries/use-l10-teams';
import { useL10TeamStore } from '@/lib/stores/l10-team-store';
import { useConvertDueMilestones } from '@/hooks/queries/use-l10-milestones';
import { MeetingTab } from './meeting-tab';
import { ScorecardTab } from './scorecard-tab';
import { RocksTab } from './rocks-tab';
import { IssuesTab } from './issues-tab';
import { TodosTab } from './todos-tab';

function MilestoneAutoConverter({ teamId }: { teamId: string }) {
  const convertMilestones = useConvertDueMilestones();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    convertMilestones.mutate(teamId);
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function L10PageShell() {
  const { data: teams, isLoading } = useTeams();
  const { selectedTeamId } = useL10TeamStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  // No teams - show CTA
  if (!teams || teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h2 className="text-xl font-semibold">Welcome to L10 Meetings</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create a team to get started with your Level 10 meetings. Teams enable structured weekly meetings with scorecards, rocks, issues, and to-dos.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Team
        </Button>
        <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamSelector />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCreateOpen(true)}
            title="Create new team"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {selectedTeamId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Team settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Auto-convert milestones to todos */}
      {selectedTeamId && <MilestoneAutoConverter teamId={selectedTeamId} />}

      {/* Tabs */}
      {selectedTeamId && (
        <Tabs defaultValue="meeting" className="w-full">
          <TabsList>
            <TabsTrigger value="meeting">Meeting</TabsTrigger>
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="rocks">Rocks</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="todos">To-Dos</TabsTrigger>
          </TabsList>

          <TabsContent value="meeting">
            <MeetingTab teamId={selectedTeamId} />
          </TabsContent>
          <TabsContent value="scorecard">
            <ScorecardTab teamId={selectedTeamId} />
          </TabsContent>
          <TabsContent value="rocks">
            <RocksTab teamId={selectedTeamId} />
          </TabsContent>
          <TabsContent value="issues">
            <IssuesTab teamId={selectedTeamId} />
          </TabsContent>
          <TabsContent value="todos">
            <TodosTab teamId={selectedTeamId} />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selectedTeamId && (
        <TeamSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          teamId={selectedTeamId}
        />
      )}
    </div>
  );
}
