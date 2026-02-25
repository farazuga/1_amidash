// ============================================
// L10 Meeting Types
// ============================================

// Team types
export type TeamMemberRole = 'member' | 'facilitator' | 'admin';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  created_at: string | null;
}

export interface TeamWithMembers extends Team {
  team_members: (TeamMember & {
    profiles: { id: string; full_name: string | null; email: string };
  })[];
}

// Rock types
export type RockStatus = 'on_track' | 'off_track' | 'complete' | 'dropped';

export interface Rock {
  id: string;
  team_id: string;
  title: string;
  owner_id: string | null;
  quarter: string; // e.g. '2026-Q1'
  status: RockStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface RockWithOwner extends Rock {
  profiles: { id: string; full_name: string | null; email: string } | null;
}

// Issue types
export type IssueStatus = 'open' | 'solving' | 'solved' | 'combined';

export interface Issue {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  priority_rank: number;
  status: IssueStatus;
  source_type: string | null;
  source_id: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IssueWithCreator extends Issue {
  profiles: { id: string; full_name: string | null; email: string } | null;
}

// Todo types
export interface Todo {
  id: string;
  team_id: string;
  title: string;
  owner_id: string | null;
  due_date: string | null;
  is_done: boolean;
  source_meeting_id: string | null;
  source_issue_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TodoWithOwner extends Todo {
  profiles: { id: string; full_name: string | null; email: string } | null;
}

// Headline types
export type HeadlineCategory = 'customer' | 'employee';
export type HeadlineSentiment = 'good' | 'bad' | 'neutral';

export interface Headline {
  id: string;
  team_id: string;
  title: string;
  category: HeadlineCategory | null;
  sentiment: HeadlineSentiment | null;
  created_by: string | null;
  meeting_id: string | null;
  created_at: string | null;
}

export interface HeadlineWithCreator extends Headline {
  profiles: { id: string; full_name: string | null; email: string } | null;
}

// Scorecard types
export type MeasurableUnit = 'number' | 'currency' | 'percentage';
export type GoalDirection = 'above' | 'below' | 'exact';
export type AutoSource = 'po_revenue' | 'invoiced_revenue' | 'open_projects';

export interface Scorecard {
  id: string;
  team_id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScorecardMeasurable {
  id: string;
  scorecard_id: string;
  title: string;
  owner_id: string | null;
  unit: MeasurableUnit;
  goal_value: number | null;
  goal_direction: GoalDirection;
  auto_source: AutoSource | null;
  display_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScorecardMeasurableWithOwner extends ScorecardMeasurable {
  profiles: { id: string; full_name: string | null; email: string } | null;
}

export interface ScorecardEntry {
  id: string;
  measurable_id: string;
  week_of: string; // DATE - Monday of the week
  value: number | null;
  entered_by: string | null;
  is_auto_populated: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// Meeting types
export type MeetingSegment = 'segue' | 'scorecard' | 'rock_review' | 'headlines' | 'todo_review' | 'ids' | 'conclude';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  team_id: string;
  title: string;
  started_at: string | null;
  ended_at: string | null;
  current_segment: MeetingSegment | null;
  segment_started_at: string | null;
  status: MeetingStatus;
  facilitator_id: string | null;
  notes: string | null;
  average_rating: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  user_id: string;
  is_present: boolean;
  joined_at: string | null;
}

export interface MeetingAttendeeWithProfile extends MeetingAttendee {
  profiles: { id: string; full_name: string | null; email: string };
}

export interface MeetingRating {
  id: string;
  meeting_id: string;
  user_id: string;
  rating: number;
  explanation: string | null;
  created_at: string | null;
}

export interface MeetingWithDetails extends Meeting {
  l10_meeting_attendees: MeetingAttendeeWithProfile[];
  l10_meeting_ratings: MeetingRating[];
  profiles: { id: string; full_name: string | null; email: string } | null; // facilitator
}

// ============================================
// Constants
// ============================================

export const SEGMENT_ORDER: MeetingSegment[] = [
  'segue',
  'scorecard',
  'rock_review',
  'headlines',
  'todo_review',
  'ids',
  'conclude',
];

export const SEGMENT_LABELS: Record<MeetingSegment, string> = {
  segue: 'Segue',
  scorecard: 'Scorecard',
  rock_review: 'Rock Review',
  headlines: 'Headlines',
  todo_review: 'To-Do Review',
  ids: 'IDS',
  conclude: 'Conclude',
};

// Duration per segment in seconds
export const SEGMENT_DURATIONS: Record<MeetingSegment, number> = {
  segue: 5 * 60,       // 5 minutes
  scorecard: 5 * 60,   // 5 minutes
  rock_review: 5 * 60, // 5 minutes
  headlines: 5 * 60,   // 5 minutes
  todo_review: 5 * 60, // 5 minutes
  ids: 60 * 60,        // 60 minutes
  conclude: 5 * 60,    // 5 minutes
};

// Total meeting duration: 90 minutes
export const TOTAL_MEETING_DURATION = Object.values(SEGMENT_DURATIONS).reduce((a, b) => a + b, 0);
