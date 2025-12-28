export interface StatusCount {
    status_name: string;
    status_color: string;
    count: number;
}
export interface TypeCount {
    type_name: string;
    count: number;
}
export interface ProjectMetrics {
    total: number;
    byStatus: StatusCount[];
    byType: TypeCount[];
    completedThisWeek: number;
    completedThisMonth: number;
    upcomingDeadlines: number;
    overdueCount: number;
}
export declare function fetchProjectMetrics(): Promise<ProjectMetrics>;
