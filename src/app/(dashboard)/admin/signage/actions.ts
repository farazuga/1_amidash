'use server';

const SIGNAGE_API_URL = process.env.SIGNAGE_API_URL || 'http://127.0.0.1:3001';

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

export function getPreviewUrl(): string {
  return `${SIGNAGE_API_URL}/preview`;
}
