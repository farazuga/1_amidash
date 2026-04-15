'use client';

import { useState, useMemo } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BalanceCard } from '@/components/per-diem/balance-card';
import { PerDiemFilters } from '@/components/per-diem/per-diem-filters';
import { EntriesTable } from '@/components/per-diem/entries-table';
import { DepositHistory } from '@/components/per-diem/deposit-history';
import { NewEntryDialog } from '@/components/per-diem/new-entry-dialog';
import { BulkDepositDialog } from '@/components/per-diem/bulk-deposit-dialog';
import { RateSettings } from '@/components/per-diem/rate-settings';
import { CsvExportButton } from '@/components/per-diem/csv-export-button';
import { useEntries } from '@/hooks/queries/use-per-diems';
import type { PerDiemEntry } from '@/types/per-diem';

interface PerDiemPageProps {
  isAdmin: boolean;
  currentUserId: string;
}

export function PerDiemPage({ isAdmin, currentUserId }: PerDiemPageProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    isAdmin ? undefined : currentUserId
  );

  // Dialog states
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PerDiemEntry | null>(null);
  const [bulkDepositOpen, setBulkDepositOpen] = useState(false);

  // Build filters for entries query
  const filters = useMemo(() => ({
    userId: isAdmin ? selectedUserId : currentUserId,
    year: selectedYear,
    status: selectedStatus,
  }), [isAdmin, selectedUserId, currentUserId, selectedYear, selectedStatus]);

  // Fetch entries for CSV export (same filters)
  const { data: entries = [] } = useEntries(filters);

  // The userId to display balance for
  const balanceUserId = isAdmin ? selectedUserId : currentUserId;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Per Diem Tracker</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isAdmin
              ? 'Manage per diem deposits and entries for all employees'
              : 'Track your per diem balance and entries'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <CsvExportButton entries={entries} />}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setBulkDepositOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Deposit
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditEntry(null); setNewEntryOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <PerDiemFilters
        isAdmin={isAdmin}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
      />

      {/* Balance Card */}
      <BalanceCard userId={balanceUserId} />

      {/* Tabs */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          <EntriesTable
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            filters={filters}
            onEditEntry={(entry) => { setEditEntry(entry); setNewEntryOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <DepositHistory
            isAdmin={isAdmin}
            userId={isAdmin ? selectedUserId : currentUserId}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings" className="mt-4">
            <RateSettings />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <NewEntryDialog
        open={newEntryOpen}
        onOpenChange={setNewEntryOpen}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        editEntry={editEntry}
      />

      {isAdmin && (
        <BulkDepositDialog
          open={bulkDepositOpen}
          onOpenChange={setBulkDepositOpen}
        />
      )}
    </div>
  );
}
