export type UserRole = 'viewer' | 'editor' | 'admin' | 'customer';

export type ContractType =
  | 'None'
  | 'South Carolina Purchasing'
  | 'TIPs Contract'
  | 'State of Georgia Purchasing Agreement';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  is_salesperson: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Status {
  id: string;
  name: string;
  display_order: number;
  require_note: boolean | null;
  is_exception: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface ProjectType {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean | null;
  created_at: string | null;
}

export interface ProjectTypeStatus {
  project_type_id: string;
  status_id: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string | null;
}

export interface Project {
  id: string;
  created_date: string;
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: string | null;
  goal_completion_date: string | null;
  // Calendar scheduling fields
  start_date: string | null;
  end_date: string | null;
  current_status_id: string | null;
  project_type_id: string | null;
  salesperson_id: string | null;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  secondary_poc_email: string | null;
  activecampaign_account_id: string | null;
  activecampaign_contact_id: string | null;
  secondary_activecampaign_contact_id: string | null;
  scope_link: string | null;
  client_token: string | null;
  client_portal_url?: string | null;
  client_portal_views?: number;
  expected_update_date: string | null;
  expected_update_auto: boolean | null;
  email_notifications_enabled: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined relations
  current_status?: Status | null;
  project_type?: ProjectType | null;
  tags?: Tag[] | { tag: Tag }[];
  created_by_profile?: Profile | null;
  salesperson?: Profile | null;
}

export interface ProjectTag {
  project_id: string;
  tag_id: string;
}

export interface StatusHistory {
  id: string;
  project_id: string;
  status_id: string;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
  // Joined relations
  status?: Status;
  changed_by_profile?: Profile;
}

export interface AuditLog {
  id: string;
  project_id: string | null;
  user_id: string | null;
  action: 'create' | 'update' | 'delete';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  // Joined relations
  project?: Project;
  user?: Profile;
}

export interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  filters: FilterState;
  is_default: boolean;
  created_at: string;
}

export interface FilterState {
  search?: string;
  statuses?: string[];
  contract_types?: ContractType[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Dashboard analytics types
export interface DashboardStats {
  total_projects: number;
  total_revenue: number;
  overdue_count: number;
  projects_by_status: { status: string; count: number; color: string }[];
  revenue_by_month: { month: string; revenue: number }[];
}

// Revenue goals types
export interface RevenueGoal {
  id: string;
  year: number;
  month: number;
  revenue_goal: number;
  projects_goal: number;
  invoiced_revenue_goal: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}
