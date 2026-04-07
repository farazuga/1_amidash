'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { unlinkSubProject } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';

interface ChildProjectBannerProps {
  parentProject: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
  };
  childProjectId: string;
  isAdmin: boolean;
}

export function ChildProjectBanner({ parentProject, childProjectId, isAdmin }: ChildProjectBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const parentUrl = parentProject.sales_order_number
    ? `/projects/${parentProject.sales_order_number}`
    : `/projects/${parentProject.id}`;

  const handleUnlink = () => {
    startTransition(async () => {
      const result = await unlinkSubProject(childProjectId);
      if (result.success) {
        toast.success('Project unlinked from parent');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to unlink project');
      }
    });
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <ArrowLeft className="h-4 w-4" />
        <span>
          Sub-project of{' '}
          <Link href={parentUrl} className="font-medium underline hover:no-underline">
            {parentProject.client_name}
            {parentProject.sales_order_number && ` (${parentProject.sales_order_number})`}
          </Link>
        </span>
      </div>

      {isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-900 dark:text-blue-300" disabled={isPending}>
              <Unlink className="h-4 w-4 mr-1" />
              Unlink
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink Sub-Project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the link to the parent project. The project will become a standalone project
                with its own file folder and client portal link.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnlink} disabled={isPending}>
                Unlink
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
