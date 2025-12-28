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
export declare function fetchSlideConfig(): Promise<SignageSlide[]>;
