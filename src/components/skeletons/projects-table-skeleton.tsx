import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
      </TableCell>
    </TableRow>
  );
}

export function ProjectsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border" role="status" aria-label="Loading projects">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Contract Type</TableHead>
            <TableHead>Goal Date</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>Sales Order</TableHead>
            <TableHead>POC</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading projects...</span>
    </div>
  );
}
