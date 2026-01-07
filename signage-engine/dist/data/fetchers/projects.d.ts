export interface ActiveProject {
    id: string;
    name: string;
    client_name: string;
    status: string;
    status_color: string;
    project_type: string | null;
    salesperson: string | null;
    start_date: string | null;
    due_date: string | null;
    total_value: number;
}
export declare function fetchActiveProjects(): Promise<ActiveProject[]>;
