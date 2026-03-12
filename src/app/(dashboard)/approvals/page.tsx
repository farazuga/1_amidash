'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser } from '@/contexts/user-context';
import { checkApprovalAccess } from './actions';
import {
  useApprovalTasks,
  useApproveFile,
  useRejectFile,
} from '@/hooks/queries/use-approval-tasks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileImage,
  FileText,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { CustomerApprovalTask, ApprovalStatus } from '@/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
  }
}

function isImageMime(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
}

function TaskTable({
  tasks,
  isLoading,
  onSelect,
}: {
  tasks: CustomerApprovalTask[];
  isLoading: boolean;
  onSelect: (task: CustomerApprovalTask) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
        <p>No approval tasks found</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>File Label</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const project = task.project as any;
          return (
            <TableRow
              key={task.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect(task)}
            >
              <TableCell className="font-medium">
                {project?.client_name || 'Unknown Project'}
                {project?.sales_order_number && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({project.sales_order_number})
                  </span>
                )}
              </TableCell>
              <TableCell>{task.file_upload?.file_label || '-'}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {task.file_upload?.original_filename || '-'}
              </TableCell>
              <TableCell>{formatDate(task.file_upload?.uploaded_at || null)}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: {
  task: CustomerApprovalTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const approveMutation = useApproveFile();
  const rejectMutation = useRejectFile();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setRejectionNote('');
      setShowRejectForm(false);
    }
  }, [open]);

  if (!task) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = task.project as any;
  const fileUpload = task.file_upload;
  const isPending = task.status === 'pending';
  const isImage = isImageMime(fileUpload?.mime_type || null);

  const handleApprove = async () => {
    const result = await approveMutation.mutateAsync(task.id);
    if (result.success) {
      toast.success('File approved successfully');
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to approve file');
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) {
      toast.error('Please provide a rejection note');
      return;
    }
    const result = await rejectMutation.mutateAsync({
      taskId: task.id,
      note: rejectionNote,
    });
    if (result.success) {
      toast.success('File rejected');
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to reject file');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>File Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File preview */}
          <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center min-h-[120px]">
            {isImage && fileUpload?.sharepoint_web_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUpload.sharepoint_web_url}
                alt={fileUpload.original_filename || 'Uploaded file'}
                className="max-h-[200px] max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                {isImage ? (
                  <FileImage className="h-12 w-12 mb-2" />
                ) : (
                  <FileText className="h-12 w-12 mb-2" />
                )}
                <p className="text-sm">{fileUpload?.original_filename || 'No file'}</p>
                {fileUpload?.mime_type && (
                  <p className="text-xs mt-1">{fileUpload.mime_type}</p>
                )}
              </div>
            )}
          </div>

          {/* File details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">File Label</span>
              <span className="font-medium">{fileUpload?.file_label || '-'}</span>
            </div>
            {fileUpload?.file_description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium">{fileUpload.file_description}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploaded</span>
              <span>{formatDate(fileUpload?.uploaded_at || null)}</span>
            </div>
            {fileUpload?.file_size_bytes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span>{(fileUpload.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={task.status} />
            </div>
            {task.note && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Note</span>
                <span className="text-right max-w-[250px]">{task.note}</span>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="flex gap-2">
            {fileUpload?.sharepoint_web_url && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={fileUpload.sharepoint_web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Download File
                </a>
              </Button>
            )}
            {project?.id && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${project.id}`}>
                  View Project
                </Link>
              </Button>
            )}
          </div>

          {/* Approve / Reject actions */}
          {isPending && (
            <div className="border-t pt-4 space-y-3">
              {showRejectForm ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Explain why this file is being rejected..."
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReject}
                      disabled={rejectMutation.isPending || !rejectionNote.trim()}
                    >
                      {rejectMutation.isPending && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Confirm Rejection
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectionNote('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ApprovalsPage() {
  const { user, isAdmin } = useUser();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedTask, setSelectedTask] = useState<CustomerApprovalTask | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const { data: tasks = [], isLoading } = useApprovalTasks(filter);

  // Check access on mount
  useEffect(() => {
    checkApprovalAccess().then(setHasAccess);
  }, [user?.id]);

  // Still loading access check
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 mb-3" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm mt-1">You don&apos;t have permission to view approval tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve customer-uploaded files
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <TaskTable tasks={tasks} isLoading={isLoading} onSelect={setSelectedTask} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <TaskTable tasks={tasks} isLoading={isLoading} onSelect={setSelectedTask} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <TaskTable tasks={tasks} isLoading={isLoading} onSelect={setSelectedTask} />
        </TabsContent>
      </Tabs>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
      />
    </div>
  );
}
