'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { AddSubProjectDialog } from './add-sub-project-dialog';
import { unlinkSubProject } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';
import { Unlink } from 'lucide-react';

interface SubProjectsPanelProps {
  parentId: string;
  parentSalesOrder: string | null;
  parentClientName: string;
  subProjects: Array<{
    id: string;
    client_name: string;
    sales_order_number: string | null;
    po_number: string | null;
    sales_amount: number | null;
    odoo_invoice_status: string | null;
    schedule_status: string | null;
    start_date: string | null;
    end_date: string | null;
    created_date: string;
    current_status: { id: string; name: string; color: string | null } | null;
  }>;
  isAdmin: boolean;
}

function getInvoiceStatusVariant(status: string | null) {
  switch (status) {
    case 'invoiced':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'to invoice':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function AddSubProjectDialogButton({ parentId, parentClientName }: { parentId: string; parentClientName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add Sub-Project
      </Button>
      <AddSubProjectDialog
        parentId={parentId}
        parentClientName={parentClientName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function SubProjectsPanel({
  parentId,
  parentSalesOrder,
  parentClientName,
  subProjects,
  isAdmin,
}: SubProjectsPanelProps) {
  const router = useRouter();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const totalAmount = subProjects.reduce(
    (sum, p) => sum + (p.sales_amount || 0),
    0
  );

  async function handleUnlink() {
    if (!unlinkingId) return;
    setIsUnlinking(true);
    try {
      const result = await unlinkSubProject(unlinkingId);
      if (result.success) {
        toast.success('Sub-project unlinked successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to unlink sub-project');
      }
    } catch {
      toast.error('Failed to unlink sub-project');
    } finally {
      setIsUnlinking(false);
      setUnlinkingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">
            Sub-Projects ({subProjects.length})
          </CardTitle>
          <AddSubProjectDialogButton
            parentId={parentId}
            parentClientName={parentClientName}
          />
        </CardHeader>
        <CardContent className="p-0">
          {subProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm px-6 pb-6">
              No sub-projects linked yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO#</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>PO#</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Invoice Status</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subProjects.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      {sub.sales_order_number ? (
                        <Link
                          href={`/projects/${sub.sales_order_number}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {sub.sales_order_number}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{sub.client_name}</TableCell>
                    <TableCell>{sub.po_number || '-'}</TableCell>
                    <TableCell className="text-right">
                      {sub.sales_amount
                        ? `$${sub.sales_amount.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {sub.odoo_invoice_status ? (
                        <Badge
                          variant="outline"
                          className={getInvoiceStatusVariant(
                            sub.odoo_invoice_status
                          )}
                        >
                          {sub.odoo_invoice_status}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.current_status ? (
                        <Badge
                          variant="status"
                          style={{
                            backgroundColor: `${sub.current_status.color || '#888'}20`,
                            color: sub.current_status.color || '#888',
                          }}
                        >
                          {sub.current_status.name}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUnlinkingId(sub.id)}
                          title="Unlink sub-project"
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell colSpan={isAdmin ? 3 : 2} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!unlinkingId}
        onOpenChange={(open) => {
          if (!open) setUnlinkingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Sub-Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this sub-project? The project will
              not be deleted, but it will no longer be associated with this
              parent project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} disabled={isUnlinking}>
              {isUnlinking ? 'Unlinking...' : 'Unlink'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
