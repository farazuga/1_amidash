import { z } from 'zod';

// Slide type enum
export const SlideTypeSchema = z.enum([
  'active-projects',
  'po-ticker',
  'revenue-dashboard',
  'team-schedule',
]);
export type SlideType = z.infer<typeof SlideTypeSchema>;

// Transition type enum
export const TransitionTypeSchema = z.enum(['fade', 'slide', 'none']);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

// Individual slide configuration
export const SlideConfigSchema = z.object({
  type: SlideTypeSchema,
  enabled: z.boolean().default(true),
  duration: z.number().min(1000).max(300000).default(15000),
  title: z.string().optional(),
  // Type-specific options
  maxItems: z.number().min(1).max(50).optional(),
  showStatus: z.boolean().optional(),
  showDueDate: z.boolean().optional(),
  showSalesAmount: z.boolean().optional(),
  scrollSpeed: z.number().min(1).max(10).optional(),
  showMonthlyGoals: z.boolean().optional(),
  showQuarterlyProgress: z.boolean().optional(),
  chartType: z.enum(['bar', 'line', 'pie']).optional(),
  daysToShow: z.number().min(7).max(30).optional(),
  showWeekends: z.boolean().optional(),
});
export type SlideConfig = z.infer<typeof SlideConfigSchema>;

// NDI output configuration
export const NDIConfigSchema = z.object({
  name: z.string().min(1).default('Amidash Signage'),
  frameRate: z.number().min(15).max(60).default(30),
});
export type NDIConfig = z.infer<typeof NDIConfigSchema>;

// Display configuration
export const DisplayConfigSchema = z.object({
  width: z.number().default(3840),
  height: z.number().default(2160),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1a1a2e'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#023A2D'),
  fontFamily: z.string().default('Inter, Arial, sans-serif'),
  logoPath: z.string().optional(),
});
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;

// Polling intervals configuration
export const PollingConfigSchema = z.object({
  projects: z.number().min(5000).default(30000),
  revenue: z.number().min(10000).default(60000),
  schedule: z.number().min(5000).default(30000),
  purchaseOrders: z.number().min(5000).default(15000),
});
export type PollingConfig = z.infer<typeof PollingConfigSchema>;

// Transition configuration
export const TransitionConfigSchema = z.object({
  type: TransitionTypeSchema.default('fade'),
  duration: z.number().min(0).max(2000).default(500),
});
export type TransitionConfig = z.infer<typeof TransitionConfigSchema>;

// API server configuration
export const APIConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3001),
  host: z.string().default('127.0.0.1'),
});
export type APIConfig = z.infer<typeof APIConfigSchema>;

// Stale data indicator configuration
export const StaleDataConfigSchema = z.object({
  warningThresholdMs: z.number().min(10000).default(60000),
  indicatorPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('bottom-right'),
});
export type StaleDataConfig = z.infer<typeof StaleDataConfigSchema>;

// Main configuration schema
export const SignageConfigSchema = z.object({
  ndi: NDIConfigSchema.default({ name: 'Amidash Signage', frameRate: 30 }),
  display: DisplayConfigSchema.default({
    width: 3840,
    height: 2160,
    backgroundColor: '#1a1a2e',
    accentColor: '#023A2D',
    fontFamily: 'Inter, Arial, sans-serif',
  }),
  polling: PollingConfigSchema.default({
    projects: 30000,
    revenue: 60000,
    schedule: 30000,
    purchaseOrders: 15000,
  }),
  slides: z.array(SlideConfigSchema).min(1),
  transitions: TransitionConfigSchema.default({ type: 'fade', duration: 500 }),
  api: APIConfigSchema.default({ port: 3001, host: '127.0.0.1' }),
  staleData: StaleDataConfigSchema.default({
    warningThresholdMs: 60000,
    indicatorPosition: 'bottom-right',
  }),
});
export type SignageConfig = z.infer<typeof SignageConfigSchema>;

// Validation helper
export function validateConfig(config: unknown): SignageConfig {
  return SignageConfigSchema.parse(config);
}
