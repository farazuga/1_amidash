/**
 * Database entity types for Supabase responses.
 * These interfaces define the expected shape of data returned from the database.
 * Use these instead of Record<string, unknown> for better type safety.
 */

// Project entity from the 'projects' table
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
  // Joined relations
  statuses?: { id: string; name: string } | null;
  project_types?: { name: string } | null;
  salesperson?: { full_name: string } | null;
}

// Status entity from the 'statuses' table
export interface DbStatus {
  id: string;
  name: string;
  display_order?: number;
}

// Status history entry from the 'status_history' table
export interface DbStatusHistory {
  id: string;
  project_id: string;
  status_id: string;
  changed_at: string;
  // Joined relations
  statuses?: { id: string; name: string } | null;
  projects?: { total_value: number; goal_completion_date?: string | null } | null;
}

// Revenue goal from the 'revenue_goals' table
export interface DbRevenueGoal {
  id: string;
  month: number;
  year: number;
  amount: number;
}

// Slide configuration from the 'signage_slides' table
export interface DbSignageSlide {
  id: string;
  slide_type: string;
  title: string | null;
  enabled: boolean;
  display_order: number;
  duration_ms: number;
  config: Record<string, unknown>;
}

// Helper type for Supabase query results (allows null/undefined arrays)
export type DbArray<T> = T[] | null | undefined;
