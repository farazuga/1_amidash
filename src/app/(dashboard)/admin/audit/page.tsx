'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import type { Profile } from '@/types';

interface AuditLogWithRelations {
  id: string;
  project_id: string | null;
  user_id: string | null;
  action: 'create' | 'update' | 'delete';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user: Profile | null;
  project: { client_name: string } | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all');
  const [search, setSearch] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:profiles(*),
        project:projects(client_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('action', filter);
    }

    const { data } = await query;
    setLogs(data || []);
    setIsLoading(false);
  };

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.project?.client_name?.toLowerCase().includes(searchLower) ||
      log.user?.email?.toLowerCase().includes(searchLower) ||
      log.field_name?.toLowerCase().includes(searchLower) ||
      log.new_value?.toLowerCase().includes(searchLower)
    );
  });

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all changes made to projects
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>
                Showing the last 100 changes
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as typeof filter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Creates</SelectItem>
                  <SelectItem value="update">Updates</SelectItem>
                  <SelectItem value="delete">Deletes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    {log.user?.full_name || log.user?.email || 'System'}
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action]}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.project?.client_name || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.field_name || '-'}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    {log.action === 'create' ? (
                      <span className="text-green-600">{log.new_value}</span>
                    ) : log.action === 'delete' ? (
                      <span className="text-red-600">{log.old_value}</span>
                    ) : (
                      <div className="text-sm">
                        {log.old_value && (
                          <span className="text-red-600 line-through mr-2">
                            {log.old_value}
                          </span>
                        )}
                        {log.new_value && (
                          <span className="text-green-600">{log.new_value}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
