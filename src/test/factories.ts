import type { Profile, Status, Project, Tag, StatusHistory, ProjectType } from '@/types';

// Profile factory
export function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    email: 'user@example.com',
    full_name: 'Test User',
    role: 'viewer',
    is_salesperson: false,
    is_assignable: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Status factory
export function createStatus(overrides: Partial<Status> = {}): Status {
  return {
    id: 'status-1',
    name: 'PO Received',
    display_order: 1,
    require_note: false,
    is_exception: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Project Type factory
export function createProjectType(overrides: Partial<ProjectType> = {}): ProjectType {
  return {
    id: 'project-type-1',
    name: 'Standard',
    display_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Tag factory
export function createTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    name: 'Urgent',
    color: '#ff0000',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Project factory
export function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    created_date: '2024-01-01',
    client_name: 'Acme Corp',
    sales_order_number: 'SO-001',
    sales_order_url: 'https://example.com/so/001',
    po_number: 'PO-001',
    sales_amount: 10000,
    contract_type: 'None',
    goal_completion_date: '2024-06-01',
    current_status_id: 'status-1',
    project_type_id: 'project-type-1',
    salesperson_id: 'profile-1',
    poc_name: 'John Doe',
    poc_email: 'john@acme.com',
    poc_phone: '555-1234',
    secondary_poc_email: null,
    activecampaign_account_id: null,
    activecampaign_contact_id: null,
    secondary_activecampaign_contact_id: null,
    scope_link: 'https://example.com/scope',
    client_token: 'abc123',
    expected_update_date: null,
    expected_update_auto: false,
    email_notifications_enabled: true,
    created_by: 'profile-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

// Status History factory
export function createStatusHistory(overrides: Partial<StatusHistory> = {}): StatusHistory {
  return {
    id: 'history-1',
    project_id: 'project-1',
    status_id: 'status-1',
    note: 'Status updated',
    changed_by: 'profile-1',
    changed_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Dashboard chart data factories
export function createStatusChartData(count = 3) {
  const statuses = ['PO Received', 'In Progress', 'Completed'];
  return statuses.slice(0, count).map((name, i) => ({
    name,
    count: (i + 1) * 5,
    color: `hsl(${i * 40}, 70%, 50%)`,
  }));
}

export function createRevenueChartData(months = 6) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames.slice(0, months).map((month, i) => ({
    month: `${month} '24`,
    revenue: (i + 1) * 10000,
  }));
}
