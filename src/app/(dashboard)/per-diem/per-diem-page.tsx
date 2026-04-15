'use client';

import { useState } from 'react';

interface PerDiemPageProps {
  isAdmin: boolean;
  currentUserId: string;
}

export function PerDiemPage({ isAdmin, currentUserId }: PerDiemPageProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    isAdmin ? undefined : currentUserId
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Per Diem Tracker</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isAdmin ? 'Manage per diem deposits and entries for all employees' : 'Track your per diem balance and entries'}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground">Components coming soon...</p>
    </div>
  );
}
