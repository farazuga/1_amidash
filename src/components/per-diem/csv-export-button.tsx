'use client';

import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/per-diem/utils';
import type { PerDiemEntry } from '@/types/per-diem';

interface CsvExportButtonProps {
  entries: PerDiemEntry[];
}

export function CsvExportButton({ entries }: CsvExportButtonProps) {
  const handleExportCSV = useCallback(() => {
    const headers = [
      'Employee Name',
      'Project',
      'Sales Order #',
      'Start Date',
      'End Date',
      'Nights',
      'Location',
      'Daily Rate',
      'Total',
      'Status',
      'Date Submitted',
    ];

    const rows = entries.map((entry) => {
      const employeeName = entry.user?.full_name || entry.user?.email || 'Unknown';
      const project = entry.project
        ? entry.project.sales_order_number
          ? `[${entry.project.sales_order_number}] ${entry.project.client_name}`
          : entry.project.client_name
        : 'Other: ' + (entry.project_other_note || '');
      const salesOrder = entry.project?.sales_order_number || '';
      const location = entry.location_type === 'in_state' ? 'In State' : 'Out of State';
      const status = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
      const dateSubmitted = format(parseISO(entry.created_at), 'yyyy-MM-dd');

      return [
        employeeName,
        project,
        salesOrder,
        entry.start_date,
        entry.end_date,
        String(entry.nights),
        location,
        formatCurrency(entry.rate),
        formatCurrency(entry.total),
        status,
        dateSubmitted,
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `per-diem-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [entries]);

  return (
    <Button variant="outline" size="sm" onClick={handleExportCSV}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
