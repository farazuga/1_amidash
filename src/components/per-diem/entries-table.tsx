'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { PerDiemEntry } from '@/types/per-diem';
import { useEntries, useApproveEntries, useDeleteEntry } from '@/hooks/queries/use-per-diems';
import { formatCurrency } from '@/lib/per-diem/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface EntriesTableProps {
  isAdmin: boolean;
  currentUserId: string;
  filters: { userId?: string; year?: number; status?: string };
  onEditEntry: (entry: PerDiemEntry) => void;
}

export function EntriesTable({ isAdmin, currentUserId, filters, onEditEntry }: EntriesTableProps) {
  const { data: entries = [], isLoading } = useEntries(filters);
  const approveEntries = useApproveEntries();
  const deleteEntry = useDeleteEntry();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pendingEntries = entries.filter((e) => e.status === 'pending');
  const allPendingSelected =
    pendingEntries.length > 0 && pendingEntries.every((e) => selectedIds.has(e.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEntries.map((e) => e.id)));
    }
  }

  async function handleApprove() {
    if (selectedIds.size === 0) return;
    try {
      await approveEntries.mutateAsync({ entry_ids: Array.from(selectedIds) });
      toast.success(`Approved ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve entries');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this per diem entry?')) return;
    try {
      await deleteEntry.mutateAsync(id);
      toast.success('Entry deleted');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete entry');
    }
  }

  function canEdit(entry: PerDiemEntry) {
    if (isAdmin) return true;
    return entry.user_id === currentUserId && entry.status === 'pending';
  }

  function canDelete(entry: PerDiemEntry) {
    if (isAdmin) return entry.status === 'pending';
    return entry.user_id === currentUserId && entry.status === 'pending';
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={selectedIds.size === 0 || approveEntries.isPending}
          >
            {approveEntries.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Approve Selected
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No per diem entries found
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPendingSelected && pendingEntries.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all pending"
                  />
                </TableHead>
              )}
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Project</TableHead>
              <TableHead>Project Dates</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead>In/Out State</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                {isAdmin && (
                  <TableCell>
                    {entry.status === 'pending' ? (
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                        aria-label={`Select entry ${entry.id}`}
                      />
                    ) : null}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell>
                    {entry.user?.full_name || entry.user?.email || 'Unknown'}
                  </TableCell>
                )}
                <TableCell>
                  {entry.project_id && entry.project ? (
                    <>
                      {entry.project.sales_order_number && (
                        <span className="font-medium">
                          [{entry.project.sales_order_number}]
                        </span>
                      )}{' '}
                      {entry.project.client_name}
                    </>
                  ) : (
                    <span className="italic text-muted-foreground">
                      Other: {entry.project_other_note}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {format(parseISO(entry.start_date), 'MMM d')} &ndash;{' '}
                  {format(parseISO(entry.end_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  {entry.nights_overridden ? (
                    <span className="bg-yellow-100 px-2 py-0.5 rounded">
                      {entry.nights}
                    </span>
                  ) : (
                    entry.nights
                  )}
                </TableCell>
                <TableCell>
                  {entry.location_type === 'in_state' ? (
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      In State
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-blue-500 text-blue-700">
                      Out of State
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(entry.rate)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(entry.total)}
                </TableCell>
                <TableCell>
                  {entry.status === 'pending' ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-700">
                      Pending
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      Approved
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canEdit(entry) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditEntry(entry)}
                        aria-label="Edit entry"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete(entry) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteEntry.isPending}
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
