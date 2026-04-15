'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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

import { useStaffUsers, useCreateDeposits } from '@/hooks/queries/use-per-diems';

interface BulkDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RowState {
  amount: string;
  note: string;
}

export function BulkDepositDialog({ open, onOpenChange }: BulkDepositDialogProps) {
  const { data: staffUsers = [] } = useStaffUsers();
  const createDeposits = useCreateDeposits();

  const [sharedNote, setSharedNote] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});

  // Initialize / reset rows when staff users load or dialog opens
  useEffect(() => {
    if (open && staffUsers.length > 0) {
      const initial: Record<string, RowState> = {};
      for (const user of staffUsers) {
        initial[user.id] = { amount: '', note: '' };
      }
      setRows(initial);
      setSharedNote('');
    }
  }, [open, staffUsers]);

  const updateRow = useCallback(
    (userId: string, field: keyof RowState, value: string) => {
      setRows((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [field]: value },
      }));
    },
    []
  );

  const handleSubmit = async () => {
    const deposits: { user_id: string; amount: number; note?: string }[] = [];

    for (const user of staffUsers) {
      const row = rows[user.id];
      if (!row) continue;

      const amount = parseFloat(row.amount);
      if (!amount || amount <= 0) continue;

      const note = row.note.trim() || sharedNote.trim() || undefined;
      deposits.push({ user_id: user.id, amount, note });
    }

    if (deposits.length === 0) {
      toast.error('Enter at least one deposit amount');
      return;
    }

    try {
      await createDeposits.mutateAsync({ deposits });
      toast.success(`Created ${deposits.length} deposit${deposits.length === 1 ? '' : 's'}`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to create deposits');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Deposit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Shared Note */}
          <div className="space-y-2">
            <Label htmlFor="shared-note">Shared Note</Label>
            <Input
              id="shared-note"
              placeholder="e.g., Q2 2026 per diem"
              value={sharedNote}
              onChange={(e) => setSharedNote(e.target.value)}
            />
          </div>

          {/* Employee Table */}
          <div className="border rounded-md">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-sm font-medium p-3">Employee</th>
                  <th className="text-left text-sm font-medium p-3 w-32">Amount</th>
                  <th className="text-left text-sm font-medium p-3">Note (override)</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((user) => {
                  const row = rows[user.id];
                  if (!row) return null;

                  return (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="p-3 text-sm">
                        {user.full_name || user.email}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(e) => updateRow(user.id, 'amount', e.target.value)}
                          className="h-8"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          placeholder={sharedNote || 'Optional note'}
                          value={row.note}
                          onChange={(e) => updateRow(user.id, 'note', e.target.value)}
                          className="h-8"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createDeposits.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createDeposits.isPending}>
            {createDeposits.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Deposits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
