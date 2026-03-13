'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setApprovalUserId } from '@/app/(dashboard)/admin/settings/approval-actions';
import type { Profile } from '@/types';

interface ApprovalUserSectionProps {
  initialApprovalUserId: string | null;
  approvalCandidates: Profile[];
  isLoading: boolean;
}

export function ApprovalUserSection({
  initialApprovalUserId,
  approvalCandidates,
  isLoading,
}: ApprovalUserSectionProps) {
  const [approvalUserId, setApprovalUserIdState] = useState<string | null>(initialApprovalUserId);
  const [isSavingApproval, setIsSavingApproval] = useState(false);

  const handleApprovalUserChange = async (value: string) => {
    const newUserId = value === 'none' ? null : value;
    setIsSavingApproval(true);
    try {
      const result = await setApprovalUserId(newUserId);
      if (result.success) {
        setApprovalUserIdState(newUserId);
        toast.success(newUserId ? 'Approval user updated' : 'Approval user cleared');
      } else {
        toast.error(result.error || 'Failed to update approval user');
      }
    } catch {
      toast.error('Failed to update approval user');
    } finally {
      setIsSavingApproval(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Customer Approvals
        </CardTitle>
        <CardDescription>
          Select the user responsible for reviewing customer-uploaded files
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="approval-user">Approval User</Label>
            <Select
              value={approvalUserId || 'none'}
              onValueChange={handleApprovalUserChange}
              disabled={isSavingApproval}
            >
              <SelectTrigger id="approval-user" className="w-full max-w-sm">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {approvalCandidates.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSavingApproval && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
