import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export type SlideType =
  | 'project-list'
  | 'project-metrics'
  | 'po-ticker'
  | 'revenue-dashboard'
  | 'team-schedule'
  | 'active-projects'
  | 'alerts-dashboard'
  | 'performance-metrics'
  | 'status-pipeline'
  | 'cycle-time'
  | 'upcoming-projects'
  | 'in-progress'
  | 'monthly-scorecard'
  | 'bottleneck-alert'
  | 'recent-wins';

export interface SignageSlide {
  id: string;
  slide_type: SlideType;
  title: string | null;
  enabled: boolean;
  display_order: number;
  duration_ms: number;
  config: Record<string, unknown>;
}

export async function fetchSlideConfig(): Promise<SignageSlide[]> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning default slides');
    return getDefaultSlides();
  }

  try {
    const { data, error } = await supabase
      .from('signage_slides')
      .select('id, slide_type, title, enabled, display_order, duration_ms, config')
      .eq('enabled', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      logger.info('No slides configured in database, using defaults');
      return getDefaultSlides();
    }

    return data.map((slide) => ({
      id: slide.id,
      slide_type: slide.slide_type as SlideType,
      title: slide.title,
      enabled: slide.enabled,
      display_order: slide.display_order,
      duration_ms: slide.duration_ms,
      config: slide.config || {},
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch slide config, returning defaults');
    return getDefaultSlides();
  }
}

function getDefaultSlides(): SignageSlide[] {
  return [
    {
      id: 'default-1',
      slide_type: 'revenue-dashboard',
      title: 'Revenue Dashboard',
      enabled: true,
      display_order: 1,
      duration_ms: 12000,
      config: {},
    },
    {
      id: 'default-2',
      slide_type: 'active-projects',
      title: 'Active Projects',
      enabled: true,
      display_order: 2,
      duration_ms: 12000,
      config: { maxItems: 15 },
    },
    {
      id: 'default-3',
      slide_type: 'performance-metrics',
      title: 'Performance Metrics',
      enabled: true,
      display_order: 3,
      duration_ms: 10000,
      config: {},
    },
    {
      id: 'default-4',
      slide_type: 'team-schedule',
      title: 'Team Schedule',
      enabled: true,
      display_order: 4,
      duration_ms: 12000,
      config: { daysToShow: 7 },
    },
    {
      id: 'default-5',
      slide_type: 'alerts-dashboard',
      title: 'Alerts',
      enabled: true,
      display_order: 5,
      duration_ms: 8000,
      config: {},
    },
    {
      id: 'default-6',
      slide_type: 'status-pipeline',
      title: 'Status Pipeline',
      enabled: true,
      display_order: 6,
      duration_ms: 10000,
      config: {},
    },
    {
      id: 'default-7',
      slide_type: 'po-ticker',
      title: 'Recent POs',
      enabled: true,
      display_order: 7,
      duration_ms: 15000,
      config: { scrollSpeed: 2 },
    },
    {
      id: 'default-8',
      slide_type: 'cycle-time',
      title: 'Cycle Time',
      enabled: true,
      display_order: 8,
      duration_ms: 10000,
      config: {},
    },
  ];
}
