'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStaffUsers } from '@/hooks/queries/use-per-diems';

interface PerDiemFiltersProps {
  isAdmin: boolean;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedStatus: string | undefined;
  onStatusChange: (status: string | undefined) => void;
  selectedUserId: string | undefined;
  onUserChange: (userId: string | undefined) => void;
}

const FIRST_YEAR = 2024;

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= currentYear + 1; y++) {
    years.push(y);
  }
  return years;
}

export function PerDiemFilters({
  isAdmin,
  selectedYear,
  onYearChange,
  selectedStatus,
  onStatusChange,
  selectedUserId,
  onUserChange,
}: PerDiemFiltersProps) {
  const { data: staffUsers } = useStaffUsers();

  return (
    <div className="flex flex-wrap gap-3">
      {/* Year filter */}
      <Select
        value={String(selectedYear)}
        onValueChange={(v) => onYearChange(Number(v))}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {getYearOptions().map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={selectedStatus ?? 'all'}
        onValueChange={(v) => onStatusChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
        </SelectContent>
      </Select>

      {/* Employee filter (admin only) */}
      {isAdmin && (
        <Select
          value={selectedUserId ?? 'all'}
          onValueChange={(v) => onUserChange(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {staffUsers?.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
