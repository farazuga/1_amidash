export interface ScheduleEntry {
    userId: string;
    userName: string;
    assignments: {
        projectId: string;
        projectName: string;
        projectColor: string;
        date: string;
        hours: number;
    }[];
}
export declare function fetchScheduleData(daysToShow?: number): Promise<ScheduleEntry[]>;
