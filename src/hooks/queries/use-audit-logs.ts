import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export type AuditActionFilter = 'all' | 'create' | 'update' | 'delete';

export interface AuditLogWithRelations {
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

const ONE_MINUTE = 60 * 1000;

export function useAuditLogs(filter: AuditActionFilter = 'all') {
  const supabase = createClient();

  return useQuery({
    queryKey: ['auditLogs', filter],
    queryFn: async () => {
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

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLogWithRelations[];
    },
    staleTime: ONE_MINUTE, // Audit logs can be slightly stale
  });
}
