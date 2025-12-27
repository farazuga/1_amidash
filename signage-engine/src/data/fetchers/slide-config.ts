import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export type SlideType = 'project-list' | 'project-metrics' | 'po-ticker' | 'revenue-dashboard' | 'team-schedule';

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
      .select('*')
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
    logger.error({ error }, 'Failed to fetch slide config');
    return getDefaultSlides();
  }
}

function getDefaultSlides(): SignageSlide[] {
  return [
    {
      id: 'default-1',
      slide_type: 'project-list',
      title: 'Active Projects',
      enabled: true,
      display_order: 1,
      duration_ms: 15000,
      config: { maxItems: 15 },
    },
    {
      id: 'default-2',
      slide_type: 'project-metrics',
      title: 'Project Metrics',
      enabled: true,
      display_order: 2,
      duration_ms: 12000,
      config: {},
    },
    {
      id: 'default-3',
      slide_type: 'po-ticker',
      title: 'Recent POs',
      enabled: true,
      display_order: 3,
      duration_ms: 20000,
      config: { scrollSpeed: 2 },
    },
    {
      id: 'default-4',
      slide_type: 'revenue-dashboard',
      title: 'Revenue Dashboard',
      enabled: true,
      display_order: 4,
      duration_ms: 15000,
      config: {},
    },
  ];
}
