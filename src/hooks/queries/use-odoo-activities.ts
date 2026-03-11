import { useQuery } from '@tanstack/react-query';
import type { OdooActivityResult } from '@/types/odoo';

export const ODOO_ACTIVITIES_KEY = ['odoo', 'activities'];

const FIVE_MINUTES = 5 * 60 * 1000;

interface OdooActivitiesResponse {
  activities: OdooActivityResult[];
  configured: boolean;
  error?: string;
}

export function useOdooActivities(userEmail: string | null) {
  return useQuery({
    queryKey: ODOO_ACTIVITIES_KEY,
    queryFn: async (): Promise<OdooActivitiesResponse> => {
      const res = await fetch('/api/odoo/activities');
      if (!res.ok) {
        throw new Error('Failed to fetch Odoo activities');
      }
      return res.json();
    },
    staleTime: FIVE_MINUTES,
    enabled: !!userEmail,
  });
}
