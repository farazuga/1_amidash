export interface Project {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    po_number: string | null;
    sales_amount: number | null;
    contract_type: string | null;
    goal_completion_date: string | null;
    start_date: string | null;
    end_date: string | null;
    current_status_id: string | null;
    salesperson_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    current_status?: Status | null;
    salesperson?: Profile | null;
}
export interface Status {
    id: string;
    name: string;
    display_order: number;
    is_active: boolean | null;
}
export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    is_salesperson: boolean | null;
    is_assignable?: boolean | null;
}
export interface StatusHistory {
    id: string;
    project_id: string;
    status_id: string;
    changed_at: string;
    status?: Status | null;
    project?: {
        id: string;
        client_name: string;
        sales_amount: number | null;
    } | null;
}
export interface RevenueGoal {
    id: string;
    year: number;
    month: number;
    revenue_goal: number;
    projects_goal: number;
    invoiced_revenue_goal: number;
}
export interface ProjectAssignment {
    id: string;
    project_id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    booking_status: 'pencil' | 'pending_confirm' | 'confirmed';
    notes: string | null;
    created_at: string | null;
    project?: Project | null;
    user?: Profile | null;
}
export interface AssignmentDay {
    id: string;
    assignment_id: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
}
export interface SignageProject extends Project {
    current_status: Status | null;
}
export interface PurchaseOrder {
    id: string;
    client_name: string;
    po_number: string;
    sales_amount: number | null;
    created_at: string | null;
}
export interface RevenueData {
    currentMonthRevenue: number;
    monthlyGoal: number;
    invoicedRevenue: number;
    invoicedGoal: number;
    pipelineTotal: number;
    monthProgress: number;
    monthlyData: MonthlyRevenueData[];
}
export interface MonthlyRevenueData {
    month: string;
    revenue: number;
    goal: number;
}
export interface ScheduleData {
    assignments: GanttAssignment[];
    users: Profile[];
}
export interface GanttAssignment {
    id: string;
    project_id: string;
    user_id: string;
    project_name: string;
    user_name: string;
    start_date: string;
    end_date: string;
    booking_status: 'pencil' | 'pending_confirm' | 'confirmed';
    days: AssignmentDay[];
}
