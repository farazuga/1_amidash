/**
 * Database entity types for Supabase responses.
 * These interfaces define the expected shape of data returned from the database.
 * Use these instead of Record<string, unknown> for better type safety.
 */
export interface DbProject {
    id: string;
    client_name: string;
    po_number?: string | null;
    sales_amount?: number | null;
    created_date?: string | null;
    goal_completion_date?: string | null;
    created_at?: string;
    current_status_id?: string | null;
    project_type_id?: string | null;
    salesperson_id?: string | null;
    statuses?: {
        id: string;
        name: string;
    } | null;
    project_types?: {
        name: string;
    } | null;
    salesperson?: {
        full_name: string;
    } | null;
}
export interface DbStatus {
    id: string;
    name: string;
    display_order?: number;
}
export interface DbStatusHistory {
    id: string;
    project_id: string;
    status_id: string;
    changed_at: string;
    statuses?: {
        id: string;
        name: string;
    } | null;
    projects?: {
        total_value: number;
        goal_completion_date?: string | null;
    } | null;
}
export interface DbRevenueGoal {
    id: string;
    month: number;
    year: number;
    amount: number;
}
export interface DbSignageSlide {
    id: string;
    slide_type: string;
    title: string | null;
    enabled: boolean;
    display_order: number;
    duration_ms: number;
    config: Record<string, unknown>;
}
export type DbArray<T> = T[] | null | undefined;
