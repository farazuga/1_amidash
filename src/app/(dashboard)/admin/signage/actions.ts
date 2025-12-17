'use server';

// Signage engine API URL (configured via environment variable)
const SIGNAGE_ENGINE_URL = process.env.SIGNAGE_ENGINE_URL || 'http://127.0.0.1:3001';

export interface EngineStatus {
  running: boolean;
  currentSlide: number;
  totalSlides: number;
  frameRate: number;
  actualFps: number;
  uptime: number;
  lastDataUpdate: number;
  ndiName: string;
  resolution: {
    width: number;
    height: number;
  };
  errors: number;
}

export interface SignageConfig {
  ndi: {
    name: string;
    frameRate: number;
  };
  display: {
    width: number;
    height: number;
    backgroundColor: string;
    accentColor: string;
    fontFamily: string;
    logoPath?: string;
  };
  polling: {
    projects: number;
    revenue: number;
    schedule: number;
    purchaseOrders: number;
  };
  slides: SlideConfig[];
  transitions: {
    type: 'fade' | 'slide' | 'none';
    duration: number;
  };
  api: {
    port: number;
    host: string;
  };
  staleData: {
    warningThresholdMs: number;
    indicatorPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
}

export interface SlideConfig {
  type: 'active-projects' | 'po-ticker' | 'revenue-dashboard' | 'team-schedule';
  enabled: boolean;
  duration: number;
  title?: string;
  maxItems?: number;
  showStatus?: boolean;
  showDueDate?: boolean;
  showSalesAmount?: boolean;
  scrollSpeed?: number;
  showMonthlyGoals?: boolean;
  showQuarterlyProgress?: boolean;
  chartType?: 'bar' | 'line' | 'pie';
  daysToShow?: number;
  showWeekends?: boolean;
}

export interface LogEntry {
  level: string;
  time: number;
  msg: string;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Get signage engine status
 */
export async function getSignageStatus(): Promise<EngineStatus | null> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/status`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to get signage status:', response.statusText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error connecting to signage engine:', error);
    return null;
  }
}

/**
 * Start the signage engine
 */
export async function startSignageEngine(): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/start`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error starting signage engine:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to signage engine',
    };
  }
}

/**
 * Stop the signage engine
 */
export async function stopSignageEngine(): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/stop`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error stopping signage engine:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to signage engine',
    };
  }
}

/**
 * Restart the signage engine
 */
export async function restartSignageEngine(): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/restart`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error restarting signage engine:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to signage engine',
    };
  }
}

/**
 * Advance to next slide
 */
export async function nextSlide(): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/next`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Failed to connect to signage engine' };
  }
}

/**
 * Go to previous slide
 */
export async function previousSlide(): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/previous`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Failed to connect to signage engine' };
  }
}

/**
 * Go to specific slide
 */
export async function goToSlide(index: number): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/control/slide/${index}`, {
      method: 'POST',
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Failed to connect to signage engine' };
  }
}

/**
 * Get signage configuration
 */
export async function getSignageConfig(): Promise<SignageConfig | null> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/config`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error getting signage config:', error);
    return null;
  }
}

/**
 * Update signage configuration
 */
export async function updateSignageConfig(config: Partial<SignageConfig>): Promise<ActionResult> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
      cache: 'no-store',
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating signage config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to signage engine',
    };
  }
}

/**
 * Get preview image URL
 */
export async function getPreviewUrl(): Promise<string> {
  return `${SIGNAGE_ENGINE_URL}/preview`;
}

/**
 * Get recent logs
 */
export async function getSignageLogs(count: number = 50): Promise<LogEntry[]> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/logs?count=${count}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('Error getting signage logs:', error);
    return [];
  }
}

/**
 * Check if signage engine is reachable
 */
export async function isEngineReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${SIGNAGE_ENGINE_URL}/health`, {
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
