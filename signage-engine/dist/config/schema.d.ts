import { z } from 'zod';
export declare const SlideTypeSchema: z.ZodEnum<{
    "active-projects": "active-projects";
    "project-list": "project-list";
    "project-metrics": "project-metrics";
    "po-ticker": "po-ticker";
    "revenue-dashboard": "revenue-dashboard";
    "team-schedule": "team-schedule";
    "upcoming-projects": "upcoming-projects";
    "in-progress": "in-progress";
    "monthly-scorecard": "monthly-scorecard";
    "bottleneck-alert": "bottleneck-alert";
    "recent-wins": "recent-wins";
}>;
export type SlideType = z.infer<typeof SlideTypeSchema>;
export declare const SlideConfigSchema: z.ZodObject<{
    type: z.ZodEnum<{
        "active-projects": "active-projects";
        "project-list": "project-list";
        "project-metrics": "project-metrics";
        "po-ticker": "po-ticker";
        "revenue-dashboard": "revenue-dashboard";
        "team-schedule": "team-schedule";
        "upcoming-projects": "upcoming-projects";
        "in-progress": "in-progress";
        "monthly-scorecard": "monthly-scorecard";
        "bottleneck-alert": "bottleneck-alert";
        "recent-wins": "recent-wins";
    }>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    duration: z.ZodDefault<z.ZodNumber>;
    title: z.ZodOptional<z.ZodString>;
    maxItems: z.ZodOptional<z.ZodNumber>;
    scrollSpeed: z.ZodOptional<z.ZodNumber>;
    daysToShow: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type SlideConfig = z.infer<typeof SlideConfigSchema>;
export declare const NDIConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    frameRate: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type NDIConfig = z.infer<typeof NDIConfigSchema>;
export declare const DisplayConfigSchema: z.ZodObject<{
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    backgroundColor: z.ZodDefault<z.ZodString>;
    accentColor: z.ZodDefault<z.ZodString>;
    fontFamily: z.ZodDefault<z.ZodString>;
    logoPath: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;
export declare const PollingConfigSchema: z.ZodObject<{
    projects: z.ZodDefault<z.ZodNumber>;
    revenue: z.ZodDefault<z.ZodNumber>;
    schedule: z.ZodDefault<z.ZodNumber>;
    purchaseOrders: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type PollingConfig = z.infer<typeof PollingConfigSchema>;
export declare const TransitionConfigSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodEnum<{
        fade: "fade";
        slide: "slide";
        none: "none";
    }>>;
    duration: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type TransitionConfig = z.infer<typeof TransitionConfigSchema>;
export declare const APIConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type APIConfig = z.infer<typeof APIConfigSchema>;
export declare const StaleDataConfigSchema: z.ZodObject<{
    warningThresholdMs: z.ZodDefault<z.ZodNumber>;
    indicatorPosition: z.ZodDefault<z.ZodEnum<{
        "top-left": "top-left";
        "top-right": "top-right";
        "bottom-left": "bottom-left";
        "bottom-right": "bottom-right";
    }>>;
}, z.core.$strip>;
export type StaleDataConfig = z.infer<typeof StaleDataConfigSchema>;
export declare const SignageConfigSchema: z.ZodObject<{
    ndi: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        frameRate: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    display: z.ZodDefault<z.ZodObject<{
        width: z.ZodDefault<z.ZodNumber>;
        height: z.ZodDefault<z.ZodNumber>;
        backgroundColor: z.ZodDefault<z.ZodString>;
        accentColor: z.ZodDefault<z.ZodString>;
        fontFamily: z.ZodDefault<z.ZodString>;
        logoPath: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    polling: z.ZodDefault<z.ZodObject<{
        projects: z.ZodDefault<z.ZodNumber>;
        revenue: z.ZodDefault<z.ZodNumber>;
        schedule: z.ZodDefault<z.ZodNumber>;
        purchaseOrders: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    slides: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            "active-projects": "active-projects";
            "project-list": "project-list";
            "project-metrics": "project-metrics";
            "po-ticker": "po-ticker";
            "revenue-dashboard": "revenue-dashboard";
            "team-schedule": "team-schedule";
            "upcoming-projects": "upcoming-projects";
            "in-progress": "in-progress";
            "monthly-scorecard": "monthly-scorecard";
            "bottleneck-alert": "bottleneck-alert";
            "recent-wins": "recent-wins";
        }>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        duration: z.ZodDefault<z.ZodNumber>;
        title: z.ZodOptional<z.ZodString>;
        maxItems: z.ZodOptional<z.ZodNumber>;
        scrollSpeed: z.ZodOptional<z.ZodNumber>;
        daysToShow: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    transitions: z.ZodDefault<z.ZodObject<{
        type: z.ZodDefault<z.ZodEnum<{
            fade: "fade";
            slide: "slide";
            none: "none";
        }>>;
        duration: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    api: z.ZodDefault<z.ZodObject<{
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    staleData: z.ZodDefault<z.ZodObject<{
        warningThresholdMs: z.ZodDefault<z.ZodNumber>;
        indicatorPosition: z.ZodDefault<z.ZodEnum<{
            "top-left": "top-left";
            "top-right": "top-right";
            "bottom-left": "bottom-left";
            "bottom-right": "bottom-right";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SignageConfig = z.infer<typeof SignageConfigSchema>;
export declare function validateConfig(config: unknown): SignageConfig;
