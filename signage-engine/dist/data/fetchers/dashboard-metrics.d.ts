export interface HealthMetrics {
    salesHealth: number;
    opsHealth: number;
    diagnosis: 'healthy' | 'sales' | 'operations' | 'both';
    message: string;
    bottlenecks: {
        procurement: number;
        engineering: number;
    };
}
export interface StuckProject {
    id: string;
    clientName: string;
    salesAmount: number;
    statusName: string;
    daysInStatus: number;
}
export interface OverdueProject {
    id: string;
    clientName: string;
    salesAmount: number;
    daysOverdue: number;
    goalDate: string;
}
export interface AlertsData {
    stuckProjects: StuckProject[];
    overdueProjects: OverdueProject[];
    totalStuck: number;
    totalOverdue: number;
    stuckRevenue: number;
    overdueRevenue: number;
    hasAlerts: boolean;
}
export interface PerformanceMetrics {
    onTimePercent: number;
    dti: number;
    backlogDepth: number;
    customerConcentration: number;
    concentrationRisk: 'low' | 'medium' | 'high';
    topClients: {
        name: string;
        revenue: number;
        percent: number;
    }[];
}
export interface VelocityMonth {
    month: string;
    posReceived: number;
    invoiced: number;
}
export interface VelocityData {
    monthly: VelocityMonth[];
    totalPOs: number;
    totalInvoiced: number;
    netChange: number;
    trend: 'growing' | 'shrinking' | 'stable';
}
export interface CycleTimeStatus {
    name: string;
    avgDays: number;
    isBottleneck: boolean;
    color: string;
}
export interface CycleTimeData {
    statuses: CycleTimeStatus[];
    totalAvgCycleTime: number;
}
export interface StatusPipelineItem {
    name: string;
    count: number;
    revenue: number;
    color: string;
    isBottleneck: boolean;
}
export interface StatusPipelineData {
    statuses: StatusPipelineItem[];
    totalProjects: number;
    totalRevenue: number;
}
export interface DashboardMetrics {
    health: HealthMetrics;
    alerts: AlertsData;
    performance: PerformanceMetrics;
    velocity: VelocityData;
    cycleTime: CycleTimeData;
    pipeline: StatusPipelineData;
}
export declare function fetchDashboardMetrics(): Promise<DashboardMetrics>;
