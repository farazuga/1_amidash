'use client';

import { useState } from 'react';
import { Search, Users, ChevronRight, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DraggableUser } from './draggable-user';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getUserInitials } from '@/lib/calendar/utils';

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface AssignmentSidebarProps {
  users: AdminUser[];
  isLoading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  assignedUserIds?: Set<string>;
}

export function AssignmentSidebar({
  users,
  isLoading,
  collapsed = false,
  onToggleCollapse,
  assignedUserIds = new Set(),
}: AssignmentSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (collapsed) {
    return (
      <div className="w-12 border-l bg-muted/20 flex flex-col items-center py-4 transition-all duration-200">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="mb-4"
          title="Expand sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Users className="h-5 w-5 text-muted-foreground mt-2" />
        <span className="text-xs text-muted-foreground mt-2 [writing-mode:vertical-lr] rotate-180">
          Team
        </span>
      </div>
    );
  }

  return (
    <div className="w-64 border-l bg-muted/20 flex flex-col transition-all duration-200">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Team Members</h3>
        </div>
        {onToggleCollapse && (
          <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchTerm ? 'No matching team members' : 'No team members'}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Drag to assign
              </p>
              {filteredUsers.map((user) => {
                const isAssigned = assignedUserIds.has(user.id);
                return (
                  <div key={user.id} className="relative">
                    <DraggableUser user={user} isAssigned={isAssigned} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {users.length} team member{users.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
