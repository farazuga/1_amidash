'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useDeposits, useUpdateDeposit } from '@/hooks/queries/use-per-diems';
import { formatCurrency } from '@/lib/per-diem/utils';

interface DepositHistoryProps {
  isAdmin: boolean;
  userId?: string;
}

export function DepositHistory({ isAdmin, userId }: DepositHistoryProps) {
  const { data: deposits, isLoading } = useDeposits(userId);
  const updateDeposit = useUpdateDeposit();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  function startEditing(deposit: { id: string; amount: number; note: string | null }) {
    setEditingId(deposit.id);
    setEditAmount(String(deposit.amount));
    setEditNote(deposit.note ?? '');
  }

  function cancelEditing() {
    setEditingId(null);
    setEditAmount('');
    setEditNote('');
  }

  function handleSave(id: string) {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    updateDeposit.mutate(
      { id, amount, note: editNote || undefined },
      {
        onSuccess: () => {
          toast.success('Deposit updated');
          cancelEditing();
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update deposit');
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deposits || deposits.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No deposits found
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Note</TableHead>
          {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {deposits.map((deposit) => {
          const isEditing = editingId === deposit.id;

          return (
            <TableRow key={deposit.id}>
              <TableCell>
                {format(parseISO(deposit.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-28 h-8"
                    min="0"
                    step="0.01"
                  />
                ) : (
                  formatCurrency(deposit.amount)
                )}
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <Input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="h-8"
                    placeholder="Optional note"
                  />
                ) : (
                  deposit.note || '\u2014'
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSave(deposit.id)}
                        disabled={updateDeposit.isPending}
                      >
                        {updateDeposit.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={cancelEditing}
                        disabled={updateDeposit.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEditing(deposit)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
