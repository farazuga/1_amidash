export type UserRole = 'viewer' | 'editor' | 'admin';

export type ContractType =
  | 'South Carolina Purchasing'
  | 'TIPs Contract'
  | 'State of Georgia Purchasing Agreement';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  name: string;
  display_order: number;
  progress_percent: number;
  require_note: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Project {
  id: string;
  created_date: string;
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: ContractType | null;
  goal_completion_date: string | null;
  current_status_id: string | null;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  scope_link: string | null;
  client_token: string;
  expected_update_date: string | null;
  expected_update_auto: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  current_status?: Status;
  tags?: Tag[];
  created_by_profile?: Profile;
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
