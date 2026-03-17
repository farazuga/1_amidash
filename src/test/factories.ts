import type { Profile, Status, Project, Tag, StatusHistory, ProjectType } from '@/types';
import type { ConfirmationRequest } from '@/types/calendar';
import type {
  Team,
  TeamMember,
  Rock,
  RockMilestone,
  Issue,
  Todo,
  Headline,
  Scorecard,
  ScorecardMeasurable,
  ScorecardEntry,
  Meeting,
  MeetingAttendee,
  MeetingRating,
} from '@/types/l10';

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
    color: '#3b82f6',
    display_order: 1,
    require_note: false,
    is_exception: false,
    is_internal_only: false,
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
    number_of_vidpods: null,
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
    invoiced_date: null,
    start_date: null,
    end_date: null,
    schedule_status: null,
    // Odoo integration
    odoo_order_id: null,
    odoo_invoice_status: null,
    odoo_last_synced_at: null,
    project_description: null,
    // Portal customization
    is_draft: false,
    delivery_street: null,
    delivery_city: null,
    delivery_state: null,
    delivery_zip: null,
    delivery_country: null,
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

// ============================================
// L10 Factories
// ============================================

// Team factory
export function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    name: 'Leadership Team',
    description: null,
    created_by: 'profile-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// TeamMember factory
export function createTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'team-member-1',
    team_id: 'team-1',
    user_id: 'profile-1',
    role: 'member',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Meeting factory
export function createMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    team_id: 'team-1',
    title: 'Weekly L10',
    started_at: '2024-01-08T14:00:00Z',
    ended_at: null,
    current_segment: 'segue',
    segment_started_at: '2024-01-08T14:00:00Z',
    status: 'in_progress',
    facilitator_id: 'profile-1',
    notes: null,
    average_rating: null,
    created_at: '2024-01-08T14:00:00Z',
    updated_at: '2024-01-08T14:00:00Z',
    ...overrides,
  };
}

// MeetingAttendee factory
export function createMeetingAttendee(overrides: Partial<MeetingAttendee> = {}): MeetingAttendee {
  return {
    id: 'attendee-1',
    meeting_id: 'meeting-1',
    user_id: 'profile-1',
    is_present: true,
    joined_at: '2024-01-08T14:00:00Z',
    ...overrides,
  };
}

// MeetingRating factory
export function createMeetingRating(overrides: Partial<MeetingRating> = {}): MeetingRating {
  return {
    id: 'rating-1',
    meeting_id: 'meeting-1',
    user_id: 'profile-1',
    rating: 8,
    explanation: null,
    created_at: '2024-01-08T15:30:00Z',
    ...overrides,
  };
}

// Rock factory
export function createRock(overrides: Partial<Rock> = {}): Rock {
  return {
    id: 'rock-1',
    team_id: 'team-1',
    title: 'Launch new product line',
    description: null,
    owner_id: 'profile-1',
    quarter: '2024-Q1',
    due_date: '2024-03-31',
    status: 'on_track',
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// RockMilestone factory
export function createRockMilestone(overrides: Partial<RockMilestone> = {}): RockMilestone {
  return {
    id: 'milestone-1',
    rock_id: 'rock-1',
    title: 'Complete market research',
    description: null,
    due_date: '2024-02-15',
    owner_id: 'profile-1',
    is_complete: false,
    display_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Todo factory
export function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    team_id: 'team-1',
    title: 'Follow up with vendor',
    description: null,
    owner_id: 'profile-1',
    due_date: '2024-01-15',
    is_done: false,
    source_meeting_id: null,
    source_issue_id: null,
    source_milestone_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Issue factory
export function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    team_id: 'team-1',
    title: 'Customer onboarding bottleneck',
    description: null,
    created_by: 'profile-1',
    priority_rank: 0,
    status: 'open',
    source_type: null,
    source_id: null,
    source_meta: null,
    resolved_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Headline factory
export function createHeadline(overrides: Partial<Headline> = {}): Headline {
  return {
    id: 'headline-1',
    team_id: 'team-1',
    title: 'New partnership signed',
    category: null,
    sentiment: 'good',
    created_by: 'profile-1',
    meeting_id: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Scorecard factory
export function createScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    id: 'scorecard-1',
    team_id: 'team-1',
    name: 'Team Scorecard',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ScorecardMeasurable factory
export function createScorecardMeasurable(overrides: Partial<ScorecardMeasurable> = {}): ScorecardMeasurable {
  return {
    id: 'measurable-1',
    scorecard_id: 'scorecard-1',
    title: 'Weekly Revenue',
    owner_id: 'profile-1',
    unit: 'currency',
    goal_value: 50000,
    goal_direction: 'above',
    auto_source: null,
    odoo_account_code: null,
    odoo_account_name: null,
    odoo_date_mode: null,
    display_order: 0,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ScorecardEntry factory
export function createScorecardEntry(overrides: Partial<ScorecardEntry> = {}): ScorecardEntry {
  return {
    id: 'entry-1',
    measurable_id: 'measurable-1',
    week_of: '2024-01-01',
    value: 52000,
    entered_by: 'profile-1',
    is_auto_populated: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================
// Confirmation Request Factory
// ============================================

// ConfirmationRequest factory
export function createConfirmationRequest(overrides: Partial<ConfirmationRequest> = {}): ConfirmationRequest {
  return {
    id: 'confirmation-1',
    project_id: 'project-1',
    token: 'token-abc123',
    sent_to_email: 'client@example.com',
    sent_to_name: 'Jane Smith',
    sent_at: '2024-01-01T00:00:00Z',
    expires_at: '2024-01-08T00:00:00Z',
    status: 'pending',
    responded_at: null,
    decline_reason: null,
    created_by: 'profile-1',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
