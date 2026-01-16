'use server';

import { createClient } from '@/lib/supabase/server';

const SIGNAGE_API_URL = process.env.SIGNAGE_API_URL || 'http://127.0.0.1:3001';

// Slide types for database
export type SlideType =
  | 'project-list'
  | 'project-metrics'
  | 'po-ticker'
  | 'revenue-dashboard'
  | 'team-schedule'
  | 'active-projects'
  // New dashboard slides
  | 'health-dashboard'
  | 'alerts-dashboard'
  | 'performance-metrics'
  | 'velocity-chart'
  | 'status-pipeline'
  | 'cycle-time'
  // Additional slide types
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
  created_at: string;
  updated_at: string;
}

export interface SignageStatus {
  isRunning: boolean;
  uptime: number;
  currentSlide: number;
  totalSlides: number;
  fps: number;
  frameCount: number;
  dataStale: boolean;
}

export interface SignageConfig {
  ndi: { name: string; frameRate: number };
  display: { width: number; height: number; backgroundColor: string; accentColor: string; fontFamily: string; logoPath?: string };
  polling: { projects: number; revenue: number; schedule: number; purchaseOrders: number };
  slides: Array<{ type: string; enabled: boolean; duration: number; title?: string; maxItems?: number; scrollSpeed?: number; daysToShow?: number }>;
  transitions: { type: string; duration: number };
  api: { port: number; host: string };
  staleData: { warningThresholdMs: number; indicatorPosition: string };
}

export interface LogEntry {
  level: string;
  time: number;
  msg: string;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SIGNAGE_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API request failed');
  }

  return res.json();
}

export async function getSignageStatus(): Promise<SignageStatus | null> {
  try {
    return await fetchAPI<SignageStatus>('/status');
  } catch (error) {
    console.error('Failed to get signage status:', error);
    return null;
  }
}

export async function getSignageConfig(): Promise<SignageConfig | null> {
  try {
    return await fetchAPI<SignageConfig>('/config');
  } catch (error) {
    console.error('Failed to get signage config:', error);
    return null;
  }
}

export async function updateSignageConfig(config: Partial<SignageConfig>): Promise<SignageConfig | null> {
  try {
    return await fetchAPI<SignageConfig>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  } catch (error) {
    console.error('Failed to update signage config:', error);
    return null;
  }
}

export async function startSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/start', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function stopSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/stop', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function restartSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/restart', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getSignageLogs(count: number = 50): Promise<LogEntry[]> {
  try {
    return await fetchAPI<LogEntry[]>(`/logs?count=${count}`);
  } catch (error) {
    console.error('Failed to get signage logs:', error);
    return [];
  }
}

// ===== Slide CRUD Operations =====

export async function getSlides(): Promise<SignageSlide[]> {
  const supabase = await createClient();
  // Note: signage_slides table needs to be created via migration 013_signage_slides.sql
  // After applying, run: npm run db:types to regenerate types
  const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: SignageSlide[] | null; error: unknown }> } } })
    .from('signage_slides')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch slides:', error);
    return [];
  }

  return (data || []) as SignageSlide[];
}

// Helper type for untyped Supabase queries (until db:types is regenerated)
type UntypedSupabase = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: { display_order: number }[] | null; error: unknown }>;
      };
    };
    insert: (data: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<{ data: SignageSlide | null; error: unknown }>;
      };
    };
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: unknown }> & {
        select: () => {
          single: () => Promise<{ data: SignageSlide | null; error: unknown }>;
        };
      };
    };
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: unknown }>;
    };
  };
};

export async function createSlide(slide: {
  slide_type: SlideType;
  title?: string;
  enabled?: boolean;
  duration_ms?: number;
  config?: Record<string, unknown>;
}): Promise<SignageSlide | null> {
  const supabase = (await createClient()) as unknown as UntypedSupabase;

  // Get the highest display_order
  const { data: existing } = await supabase
    .from('signage_slides')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.display_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('signage_slides')
    .insert({
      slide_type: slide.slide_type,
      title: slide.title || null,
      enabled: slide.enabled ?? true,
      display_order: nextOrder,
      duration_ms: slide.duration_ms ?? 15000,
      config: slide.config ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create slide:', error);
    return null;
  }

  return data as SignageSlide;
}

export async function updateSlide(
  id: string,
  updates: Partial<Omit<SignageSlide, 'id' | 'created_at' | 'updated_at'>>
): Promise<SignageSlide | null> {
  const supabase = (await createClient()) as unknown as UntypedSupabase;

  const { data, error } = await supabase
    .from('signage_slides')
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update slide:', error);
    return null;
  }

  return data as SignageSlide;
}

export async function deleteSlide(id: string): Promise<boolean> {
  const supabase = (await createClient()) as unknown as UntypedSupabase;

  const { error } = await supabase
    .from('signage_slides')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete slide:', error);
    return false;
  }

  return true;
}

export async function reorderSlides(slideIds: string[]): Promise<boolean> {
  const supabase = (await createClient()) as unknown as UntypedSupabase;

  // Update each slide's display_order
  const updates = slideIds.map((id, index) => ({
    id,
    display_order: index + 1,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('signage_slides')
      .update({ display_order: update.display_order })
      .eq('id', update.id);

    if (error) {
      console.error('Failed to reorder slide:', error);
      return false;
    }
  }

  return true;
}

// Update all slide durations at once
export async function updateAllSlideDurations(durationMs: number): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      update: (data: Record<string, unknown>) => {
        neq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
  })
    .from('signage_slides')
    .update({ duration_ms: durationMs })
    .neq('id', ''); // Update all rows

  if (error) {
    console.error('Failed to update slide durations:', error);
    return false;
  }

  return true;
}
