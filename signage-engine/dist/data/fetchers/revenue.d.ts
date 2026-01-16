export interface RevenueData {
    currentMonthRevenue: number;
    currentMonthGoal: number;
    yearToDateRevenue: number;
    yearToDateGoal: number;
    monthlyData: {
        month: string;
        revenue: number;
        goal: number;
    }[];
}
export declare function fetchRevenueData(): Promise<RevenueData>;
