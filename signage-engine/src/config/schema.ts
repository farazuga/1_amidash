import { z } from 'zod';

export const SlideTypeSchema = z.enum(['active-projects', 'project-list', 'project-metrics', 'po-ticker', 'revenue-dashboard', 'team-schedule']);
export type SlideType = z.infer<typeof SlideTypeSchema>;

export const SlideConfigSchema = z.object({
  type: SlideTypeSchema,
  enabled: z.boolean().default(true),
  duration: z.number().min(1000).default(15000),
  title: z.string().optional(),
  maxItems: z.number().optional(),
  scrollSpeed: z.number().optional(),
  daysToShow: z.number().optional(),
});
export type SlideConfig = z.infer<typeof SlideConfigSchema>;

export const NDIConfigSchema = z.object({
  name: z.string().default('Amidash Signage'),
  frameRate: z.number().min(15).max(60).default(30),
});
export type NDIConfig = z.infer<typeof NDIConfigSchema>;

export const DisplayConfigSchema = z.object({
  width: z.number().default(3840),
  height: z.number().default(2160),
  backgroundColor: z.string().default('#053B2C'),     // Amitrace Main Dark Green background
  accentColor: z.string().default('#C2E0AD'),         // Amitrace Main Light Green accent
  fontFamily: z.string().default('Karla, Inter, Arial, sans-serif'),  // Amitrace brand font
  logoPath: z.string().optional(),
});
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;

export const PollingConfigSchema = z.object({
  projects: z.number().default(30000),
  revenue: z.number().default(60000),
  schedule: z.number().default(30000),
  purchaseOrders: z.number().default(15000),
});
export type PollingConfig = z.infer<typeof PollingConfigSchema>;

export const TransitionConfigSchema = z.object({
  type: z.enum(['fade', 'slide', 'none']).default('fade'),
  duration: z.number().default(500),
});
export type TransitionConfig = z.infer<typeof TransitionConfigSchema>;

export const APIConfigSchema = z.object({
  port: z.number().default(3001),
  host: z.string().default('127.0.0.1'),
});
export type APIConfig = z.infer<typeof APIConfigSchema>;

export const StaleDataConfigSchema = z.object({
  warningThresholdMs: z.number().default(60000),
  indicatorPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('bottom-right'),
});
export type StaleDataConfig = z.infer<typeof StaleDataConfigSchema>;

export const SignageConfigSchema = z.object({
  ndi: NDIConfigSchema.default({}),
  display: DisplayConfigSchema.default({}),
  polling: PollingConfigSchema.default({}),
  slides: z.array(SlideConfigSchema).min(1),
  transitions: TransitionConfigSchema.default({}),
  api: APIConfigSchema.default({}),
  staleData: StaleDataConfigSchema.default({}),
});
export type SignageConfig = z.infer<typeof SignageConfigSchema>;

export function validateConfig(config: unknown): SignageConfig {
  return SignageConfigSchema.parse(config);
}
