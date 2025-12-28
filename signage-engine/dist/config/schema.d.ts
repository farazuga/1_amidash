import { z } from 'zod';
export declare const SlideTypeSchema: z.ZodEnum<["active-projects", "project-list", "project-metrics", "po-ticker", "revenue-dashboard", "team-schedule"]>;
export type SlideType = z.infer<typeof SlideTypeSchema>;
export declare const SlideConfigSchema: z.ZodObject<{
    type: z.ZodEnum<["active-projects", "project-list", "project-metrics", "po-ticker", "revenue-dashboard", "team-schedule"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    duration: z.ZodDefault<z.ZodNumber>;
    title: z.ZodOptional<z.ZodString>;
    maxItems: z.ZodOptional<z.ZodNumber>;
    scrollSpeed: z.ZodOptional<z.ZodNumber>;
    daysToShow: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
    enabled: boolean;
    duration: number;
    title?: string | undefined;
    maxItems?: number | undefined;
    scrollSpeed?: number | undefined;
    daysToShow?: number | undefined;
}, {
    type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
    enabled?: boolean | undefined;
    duration?: number | undefined;
    title?: string | undefined;
    maxItems?: number | undefined;
    scrollSpeed?: number | undefined;
    daysToShow?: number | undefined;
}>;
export type SlideConfig = z.infer<typeof SlideConfigSchema>;
export declare const NDIConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    frameRate: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    frameRate: number;
}, {
    name?: string | undefined;
    frameRate?: number | undefined;
}>;
export type NDIConfig = z.infer<typeof NDIConfigSchema>;
export declare const DisplayConfigSchema: z.ZodObject<{
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    backgroundColor: z.ZodDefault<z.ZodString>;
    accentColor: z.ZodDefault<z.ZodString>;
    fontFamily: z.ZodDefault<z.ZodString>;
    logoPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    backgroundColor: string;
    accentColor: string;
    fontFamily: string;
    logoPath?: string | undefined;
}, {
    width?: number | undefined;
    height?: number | undefined;
    backgroundColor?: string | undefined;
    accentColor?: string | undefined;
    fontFamily?: string | undefined;
    logoPath?: string | undefined;
}>;
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;
export declare const PollingConfigSchema: z.ZodObject<{
    projects: z.ZodDefault<z.ZodNumber>;
    revenue: z.ZodDefault<z.ZodNumber>;
    schedule: z.ZodDefault<z.ZodNumber>;
    purchaseOrders: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    projects: number;
    revenue: number;
    schedule: number;
    purchaseOrders: number;
}, {
    projects?: number | undefined;
    revenue?: number | undefined;
    schedule?: number | undefined;
    purchaseOrders?: number | undefined;
}>;
export type PollingConfig = z.infer<typeof PollingConfigSchema>;
export declare const TransitionConfigSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodEnum<["fade", "slide", "none"]>>;
    duration: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "fade" | "slide" | "none";
    duration: number;
}, {
    type?: "fade" | "slide" | "none" | undefined;
    duration?: number | undefined;
}>;
export type TransitionConfig = z.infer<typeof TransitionConfigSchema>;
export declare const APIConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    port: number;
    host: string;
}, {
    port?: number | undefined;
    host?: string | undefined;
}>;
export type APIConfig = z.infer<typeof APIConfigSchema>;
export declare const StaleDataConfigSchema: z.ZodObject<{
    warningThresholdMs: z.ZodDefault<z.ZodNumber>;
    indicatorPosition: z.ZodDefault<z.ZodEnum<["top-left", "top-right", "bottom-left", "bottom-right"]>>;
}, "strip", z.ZodTypeAny, {
    warningThresholdMs: number;
    indicatorPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}, {
    warningThresholdMs?: number | undefined;
    indicatorPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | undefined;
}>;
export type StaleDataConfig = z.infer<typeof StaleDataConfigSchema>;
export declare const SignageConfigSchema: z.ZodObject<{
    ndi: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        frameRate: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        frameRate: number;
    }, {
        name?: string | undefined;
        frameRate?: number | undefined;
    }>>;
    display: z.ZodDefault<z.ZodObject<{
        width: z.ZodDefault<z.ZodNumber>;
        height: z.ZodDefault<z.ZodNumber>;
        backgroundColor: z.ZodDefault<z.ZodString>;
        accentColor: z.ZodDefault<z.ZodString>;
        fontFamily: z.ZodDefault<z.ZodString>;
        logoPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        backgroundColor: string;
        accentColor: string;
        fontFamily: string;
        logoPath?: string | undefined;
    }, {
        width?: number | undefined;
        height?: number | undefined;
        backgroundColor?: string | undefined;
        accentColor?: string | undefined;
        fontFamily?: string | undefined;
        logoPath?: string | undefined;
    }>>;
    polling: z.ZodDefault<z.ZodObject<{
        projects: z.ZodDefault<z.ZodNumber>;
        revenue: z.ZodDefault<z.ZodNumber>;
        schedule: z.ZodDefault<z.ZodNumber>;
        purchaseOrders: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        projects: number;
        revenue: number;
        schedule: number;
        purchaseOrders: number;
    }, {
        projects?: number | undefined;
        revenue?: number | undefined;
        schedule?: number | undefined;
        purchaseOrders?: number | undefined;
    }>>;
    slides: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["active-projects", "project-list", "project-metrics", "po-ticker", "revenue-dashboard", "team-schedule"]>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        duration: z.ZodDefault<z.ZodNumber>;
        title: z.ZodOptional<z.ZodString>;
        maxItems: z.ZodOptional<z.ZodNumber>;
        scrollSpeed: z.ZodOptional<z.ZodNumber>;
        daysToShow: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
        enabled: boolean;
        duration: number;
        title?: string | undefined;
        maxItems?: number | undefined;
        scrollSpeed?: number | undefined;
        daysToShow?: number | undefined;
    }, {
        type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
        enabled?: boolean | undefined;
        duration?: number | undefined;
        title?: string | undefined;
        maxItems?: number | undefined;
        scrollSpeed?: number | undefined;
        daysToShow?: number | undefined;
    }>, "many">;
    transitions: z.ZodDefault<z.ZodObject<{
        type: z.ZodDefault<z.ZodEnum<["fade", "slide", "none"]>>;
        duration: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "fade" | "slide" | "none";
        duration: number;
    }, {
        type?: "fade" | "slide" | "none" | undefined;
        duration?: number | undefined;
    }>>;
    api: z.ZodDefault<z.ZodObject<{
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
    }, {
        port?: number | undefined;
        host?: string | undefined;
    }>>;
    staleData: z.ZodDefault<z.ZodObject<{
        warningThresholdMs: z.ZodDefault<z.ZodNumber>;
        indicatorPosition: z.ZodDefault<z.ZodEnum<["top-left", "top-right", "bottom-left", "bottom-right"]>>;
    }, "strip", z.ZodTypeAny, {
        warningThresholdMs: number;
        indicatorPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }, {
        warningThresholdMs?: number | undefined;
        indicatorPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
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
        logoPath?: string | undefined;
    };
    polling: {
        projects: number;
        revenue: number;
        schedule: number;
        purchaseOrders: number;
    };
    slides: {
        type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
        enabled: boolean;
        duration: number;
        title?: string | undefined;
        maxItems?: number | undefined;
        scrollSpeed?: number | undefined;
        daysToShow?: number | undefined;
    }[];
    transitions: {
        type: "fade" | "slide" | "none";
        duration: number;
    };
    api: {
        port: number;
        host: string;
    };
    staleData: {
        warningThresholdMs: number;
        indicatorPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    };
}, {
    slides: {
        type: "active-projects" | "project-list" | "project-metrics" | "po-ticker" | "revenue-dashboard" | "team-schedule";
        enabled?: boolean | undefined;
        duration?: number | undefined;
        title?: string | undefined;
        maxItems?: number | undefined;
        scrollSpeed?: number | undefined;
        daysToShow?: number | undefined;
    }[];
    ndi?: {
        name?: string | undefined;
        frameRate?: number | undefined;
    } | undefined;
    display?: {
        width?: number | undefined;
        height?: number | undefined;
        backgroundColor?: string | undefined;
        accentColor?: string | undefined;
        fontFamily?: string | undefined;
        logoPath?: string | undefined;
    } | undefined;
    polling?: {
        projects?: number | undefined;
        revenue?: number | undefined;
        schedule?: number | undefined;
        purchaseOrders?: number | undefined;
    } | undefined;
    transitions?: {
        type?: "fade" | "slide" | "none" | undefined;
        duration?: number | undefined;
    } | undefined;
    api?: {
        port?: number | undefined;
        host?: string | undefined;
    } | undefined;
    staleData?: {
        warningThresholdMs?: number | undefined;
        indicatorPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | undefined;
    } | undefined;
}>;
export type SignageConfig = z.infer<typeof SignageConfigSchema>;
export declare function validateConfig(config: unknown): SignageConfig;
