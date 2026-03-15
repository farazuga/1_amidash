export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      assignment_days: {
        Row: {
          assignment_id: string
          created_at: string | null
          created_by: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_days_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_days_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_conflicts: {
        Row: {
          assignment_id_1: string
          assignment_id_2: string
          conflict_date: string
          created_at: string | null
          id: string
          is_resolved: boolean | null
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          user_id: string
        }
        Insert: {
          assignment_id_1: string
          assignment_id_2: string
          conflict_date: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          user_id: string
        }
        Update: {
          assignment_id_1?: string
          assignment_id_2?: string
          conflict_date?: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_conflicts_assignment_id_1_fkey"
            columns: ["assignment_id_1"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_conflicts_assignment_id_2_fkey"
            columns: ["assignment_id_2"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_conflicts_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_conflicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          assignment_id: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          note: string | null
          old_status: string | null
        }
        Insert: {
          assignment_id: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
        }
        Update: {
          assignment_id?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_request_assignments: {
        Row: {
          assignment_id: string
          confirmation_request_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          assignment_id: string
          confirmation_request_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          assignment_id?: string
          confirmation_request_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_request_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_request_assignments_confirmation_request_id_fkey"
            columns: ["confirmation_request_id"]
            isOneToOne: false
            referencedRelation: "confirmation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_request_assignments_confirmation_request_id_fkey"
            columns: ["confirmation_request_id"]
            isOneToOne: false
            referencedRelation: "pending_confirmations"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_requests: {
        Row: {
          created_at: string | null
          created_by: string | null
          decline_reason: string | null
          expires_at: string
          id: string
          project_id: string
          responded_at: string | null
          sent_at: string | null
          sent_to_email: string
          sent_to_name: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          decline_reason?: string | null
          expires_at?: string
          id?: string
          project_id: string
          responded_at?: string | null
          sent_at?: string | null
          sent_to_email: string
          sent_to_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          decline_reason?: string | null
          expires_at?: string
          id?: string
          project_id?: string
          responded_at?: string | null
          sent_at?: string | null
          sent_to_email?: string
          sent_to_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_approval_tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          file_upload_id: string
          id: string
          note: string | null
          status: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          file_upload_id: string
          id?: string
          note?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          file_upload_id?: string
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_approval_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_tasks_file_upload_id_fkey"
            columns: ["file_upload_id"]
            isOneToOne: false
            referencedRelation: "portal_file_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_address_confirmations: {
        Row: {
          address_snapshot: Json
          confirmed_at: string
          confirmed_by_email: string
          id: string
          project_id: string
        }
        Insert: {
          address_snapshot: Json
          confirmed_at?: string
          confirmed_by_email: string
          id?: string
          project_id: string
        }
        Update: {
          address_snapshot?: Json
          confirmed_at?: string
          confirmed_by_email?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_address_confirmations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notification_preferences: {
        Row: {
          created_at: string | null
          email: string
          id: string
          notifications_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      engineer_outlook_calendars: {
        Row: {
          created_at: string
          id: string
          outlook_calendar_id: string
          outlook_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outlook_calendar_id: string
          outlook_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outlook_calendar_id?: string
          outlook_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_outlook_calendars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_comments: {
        Row: {
          content: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_headlines: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          meeting_id: string | null
          sentiment: string | null
          team_id: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_id?: string | null
          sentiment?: string | null
          team_id: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_id?: string | null
          sentiment?: string | null
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_headlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_headlines_meeting_fk"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_headlines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_issues: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          priority_rank: number
          resolved_at: string | null
          source_id: string | null
          source_meta: Json | null
          source_type: string | null
          status: string
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority_rank?: number
          resolved_at?: string | null
          source_id?: string | null
          source_meta?: Json | null
          source_type?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority_rank?: number
          resolved_at?: string | null
          source_id?: string | null
          source_meta?: Json | null
          source_type?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_issues_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meeting_attendees: {
        Row: {
          id: string
          is_present: boolean
          joined_at: string | null
          meeting_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_present?: boolean
          joined_at?: string | null
          meeting_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_present?: boolean
          joined_at?: string | null
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_meeting_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meeting_ratings: {
        Row: {
          created_at: string | null
          explanation: string | null
          id: string
          meeting_id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          meeting_id: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          meeting_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_meeting_ratings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_meeting_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meetings: {
        Row: {
          average_rating: number | null
          created_at: string | null
          current_segment: string | null
          ended_at: string | null
          facilitator_id: string | null
          id: string
          notes: string | null
          segment_started_at: string | null
          started_at: string | null
          status: string
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          average_rating?: number | null
          created_at?: string | null
          current_segment?: string | null
          ended_at?: string | null
          facilitator_id?: string | null
          id?: string
          notes?: string | null
          segment_started_at?: string | null
          started_at?: string | null
          status?: string
          team_id: string
          title?: string
          updated_at?: string | null
        }
        Update: {
          average_rating?: number | null
          created_at?: string | null
          current_segment?: string | null
          ended_at?: string | null
          facilitator_id?: string | null
          id?: string
          notes?: string | null
          segment_started_at?: string | null
          started_at?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_meetings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_rock_milestones: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          due_date: string | null
          id: string
          is_complete: boolean
          owner_id: string | null
          rock_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_complete?: boolean
          owner_id?: string | null
          rock_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_complete?: boolean
          owner_id?: string | null
          rock_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_rock_milestones_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_rock_milestones_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "l10_rocks"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_rocks: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          owner_id: string | null
          quarter: string
          status: string
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          owner_id?: string | null
          quarter: string
          status?: string
          team_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          owner_id?: string | null
          quarter?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_rocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_rocks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_scorecard_entries: {
        Row: {
          created_at: string | null
          entered_by: string | null
          id: string
          is_auto_populated: boolean
          measurable_id: string
          updated_at: string | null
          value: number | null
          week_of: string
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          id?: string
          is_auto_populated?: boolean
          measurable_id: string
          updated_at?: string | null
          value?: number | null
          week_of: string
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          id?: string
          is_auto_populated?: boolean
          measurable_id?: string
          updated_at?: string | null
          value?: number | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_scorecard_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_scorecard_entries_measurable_id_fkey"
            columns: ["measurable_id"]
            isOneToOne: false
            referencedRelation: "l10_scorecard_measurables"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_scorecard_measurables: {
        Row: {
          auto_source: string | null
          created_at: string | null
          display_order: number
          goal_direction: string | null
          goal_value: number | null
          id: string
          is_active: boolean
          odoo_account_code: string | null
          odoo_account_name: string | null
          odoo_date_mode: string | null
          owner_id: string | null
          scorecard_id: string
          title: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          auto_source?: string | null
          created_at?: string | null
          display_order?: number
          goal_direction?: string | null
          goal_value?: number | null
          id?: string
          is_active?: boolean
          odoo_account_code?: string | null
          odoo_account_name?: string | null
          odoo_date_mode?: string | null
          owner_id?: string | null
          scorecard_id: string
          title: string
          unit?: string
          updated_at?: string | null
        }
        Update: {
          auto_source?: string | null
          created_at?: string | null
          display_order?: number
          goal_direction?: string | null
          goal_value?: number | null
          id?: string
          is_active?: boolean
          odoo_account_code?: string | null
          odoo_account_name?: string | null
          odoo_date_mode?: string | null
          owner_id?: string | null
          scorecard_id?: string
          title?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_scorecard_measurables_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_scorecard_measurables_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "l10_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_scorecards: {
        Row: {
          created_at: string | null
          id: string
          name: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_scorecards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_todos: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_done: boolean
          owner_id: string | null
          source_issue_id: string | null
          source_meeting_id: string | null
          source_milestone_id: string | null
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          owner_id?: string | null
          source_issue_id?: string | null
          source_meeting_id?: string | null
          source_milestone_id?: string | null
          team_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          owner_id?: string | null
          source_issue_id?: string | null
          source_meeting_id?: string | null
          source_milestone_id?: string | null
          team_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "l10_todos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_todos_source_issue_id_fkey"
            columns: ["source_issue_id"]
            isOneToOne: false
            referencedRelation: "l10_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_todos_source_meeting_fk"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_todos_source_milestone_id_fkey"
            columns: ["source_milestone_id"]
            isOneToOne: false
            referencedRelation: "l10_rock_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_todos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_email_templates: {
        Row: {
          button_color: string | null
          button_text_color: string | null
          created_at: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          portal_template_id: string
          primary_color: string | null
          updated_at: string | null
        }
        Insert: {
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          portal_template_id: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          portal_template_id?: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_email_templates_portal_template_id_fkey"
            columns: ["portal_template_id"]
            isOneToOne: true
            referencedRelation: "portal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_file_uploads: {
        Row: {
          block_id: string
          created_at: string | null
          file_description: string | null
          file_label: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          project_id: string
          rejection_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sharepoint_item_id: string | null
          sharepoint_web_url: string | null
          slot_index: number
          stored_filename: string | null
          upload_status: string
          uploaded_at: string | null
        }
        Insert: {
          block_id: string
          created_at?: string | null
          file_description?: string | null
          file_label: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          project_id: string
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sharepoint_item_id?: string | null
          sharepoint_web_url?: string | null
          slot_index: number
          stored_filename?: string | null
          upload_status?: string
          uploaded_at?: string | null
        }
        Update: {
          block_id?: string
          created_at?: string | null
          file_description?: string | null
          file_label?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          project_id?: string
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sharepoint_item_id?: string | null
          sharepoint_web_url?: string | null
          slot_index?: number
          stored_filename?: string | null
          upload_status?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_file_uploads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_file_uploads_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_templates: {
        Row: {
          background_image_url: string | null
          blocks: Json
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          background_image_url?: string | null
          blocks?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          background_image_url?: string | null
          blocks?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      presales_files: {
        Row: {
          activecampaign_deal_id: string
          activecampaign_deal_name: string | null
          captured_offline: boolean | null
          captured_on_device: string | null
          category: Database["public"]["Enums"]["file_category"]
          created_at: string | null
          download_url: string | null
          file_extension: string | null
          file_name: string
          file_size: number | null
          id: string
          local_thumbnail_url: string | null
          mime_type: string | null
          notes: string | null
          project_id: string | null
          sharepoint_folder_path: string | null
          sharepoint_item_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
          upload_error: string | null
          upload_status: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by: string | null
          web_url: string | null
        }
        Insert: {
          activecampaign_deal_id: string
          activecampaign_deal_name?: string | null
          captured_offline?: boolean | null
          captured_on_device?: string | null
          category?: Database["public"]["Enums"]["file_category"]
          created_at?: string | null
          download_url?: string | null
          file_extension?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          local_thumbnail_url?: string | null
          mime_type?: string | null
          notes?: string | null
          project_id?: string | null
          sharepoint_folder_path?: string | null
          sharepoint_item_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
          web_url?: string | null
        }
        Update: {
          activecampaign_deal_id?: string
          activecampaign_deal_name?: string | null
          captured_offline?: boolean | null
          captured_on_device?: string | null
          category?: Database["public"]["Enums"]["file_category"]
          created_at?: string | null
          download_url?: string | null
          file_extension?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          local_thumbnail_url?: string | null
          mime_type?: string | null
          notes?: string | null
          project_id?: string | null
          sharepoint_folder_path?: string | null
          sharepoint_item_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presales_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presales_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_assignable: boolean | null
          is_salesperson: boolean | null
          role: string | null
          timezone: string | null
          updated_at: string | null
          user_preferences: Json | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_assignable?: boolean | null
          is_salesperson?: boolean | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_preferences?: Json | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_assignable?: boolean | null
          is_salesperson?: boolean | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_preferences?: Json | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          booking_status: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_status?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_status?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_file_access_logs: {
        Row: {
          action: string
          created_at: string | null
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_file_access_logs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_file_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          captured_offline: boolean | null
          captured_on_device: string | null
          category: Database["public"]["Enums"]["file_category"]
          connection_id: string | null
          created_at: string | null
          download_url: string | null
          file_extension: string | null
          file_name: string
          file_size: number | null
          id: string
          is_synced: boolean | null
          local_thumbnail_url: string | null
          mime_type: string | null
          notes: string | null
          offline_id: string | null
          presales_file_id: string | null
          project_id: string
          project_phase: string | null
          sharepoint_item_id: string | null
          sharepoint_modified_at: string | null
          sharepoint_modified_by: string | null
          sync_error: string | null
          thumbnail_url: string | null
          updated_at: string | null
          upload_error: string | null
          upload_status: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by: string | null
          web_url: string | null
        }
        Insert: {
          captured_offline?: boolean | null
          captured_on_device?: string | null
          category?: Database["public"]["Enums"]["file_category"]
          connection_id?: string | null
          created_at?: string | null
          download_url?: string | null
          file_extension?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_synced?: boolean | null
          local_thumbnail_url?: string | null
          mime_type?: string | null
          notes?: string | null
          offline_id?: string | null
          presales_file_id?: string | null
          project_id: string
          project_phase?: string | null
          sharepoint_item_id?: string | null
          sharepoint_modified_at?: string | null
          sharepoint_modified_by?: string | null
          sync_error?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
          web_url?: string | null
        }
        Update: {
          captured_offline?: boolean | null
          captured_on_device?: string | null
          category?: Database["public"]["Enums"]["file_category"]
          connection_id?: string | null
          created_at?: string | null
          download_url?: string | null
          file_extension?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_synced?: boolean | null
          local_thumbnail_url?: string | null
          mime_type?: string | null
          notes?: string | null
          offline_id?: string | null
          presales_file_id?: string | null
          project_id?: string
          project_phase?: string | null
          sharepoint_item_id?: string | null
          sharepoint_modified_at?: string | null
          sharepoint_modified_by?: string | null
          sync_error?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "project_sharepoint_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_presales_file_id_fkey"
            columns: ["presales_file_id"]
            isOneToOne: false
            referencedRelation: "presales_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sharepoint_connections: {
        Row: {
          auto_created: boolean | null
          connected_by: string
          created_at: string | null
          drive_id: string
          folder_id: string
          folder_path: string
          folder_url: string
          id: string
          last_synced_at: string | null
          project_id: string
          site_id: string
          sync_error: string | null
          updated_at: string | null
        }
        Insert: {
          auto_created?: boolean | null
          connected_by: string
          created_at?: string | null
          drive_id: string
          folder_id: string
          folder_path: string
          folder_url: string
          id?: string
          last_synced_at?: string | null
          project_id: string
          site_id: string
          sync_error?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_created?: boolean | null
          connected_by?: string
          created_at?: string | null
          drive_id?: string
          folder_id?: string
          folder_path?: string
          folder_url?: string
          id?: string
          last_synced_at?: string | null
          project_id?: string
          site_id?: string
          sync_error?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sharepoint_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sharepoint_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tags: {
        Row: {
          project_id: string
          tag_id: string
        }
        Insert: {
          project_id: string
          tag_id: string
        }
        Update: {
          project_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      project_type_statuses: {
        Row: {
          project_type_id: string
          status_id: string
        }
        Insert: {
          project_type_id: string
          status_id: string
        }
        Update: {
          project_type_id?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_type_statuses_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_type_statuses_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          name: string
          portal_template_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order: number
          id?: string
          is_active?: boolean | null
          name: string
          portal_template_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          name?: string
          portal_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_types_portal_template_id_fkey"
            columns: ["portal_template_id"]
            isOneToOne: false
            referencedRelation: "portal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          activecampaign_account_id: string | null
          activecampaign_contact_id: string | null
          client_name: string
          client_portal_views: number
          client_token: string | null
          contract_type: string | null
          created_at: string | null
          created_by: string | null
          created_date: string
          current_status_id: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_state: string | null
          delivery_street: string | null
          delivery_zip: string | null
          email_notifications_enabled: boolean | null
          end_date: string | null
          expected_update_auto: boolean | null
          expected_update_date: string | null
          goal_completion_date: string | null
          id: string
          invoiced_date: string | null
          is_draft: boolean
          number_of_vidpods: number | null
          odoo_invoice_status: string | null
          odoo_last_synced_at: string | null
          odoo_order_id: number | null
          po_number: string | null
          poc_email: string | null
          poc_name: string | null
          poc_phone: string | null
          project_description: string | null
          project_type_id: string | null
          sales_amount: number | null
          sales_order_number: string
          sales_order_url: string | null
          salesperson_id: string | null
          schedule_status: string | null
          scope_link: string | null
          secondary_activecampaign_contact_id: string | null
          secondary_poc_email: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          activecampaign_account_id?: string | null
          activecampaign_contact_id?: string | null
          client_name: string
          client_portal_views?: number
          client_token?: string | null
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          created_date?: string
          current_status_id?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_state?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email_notifications_enabled?: boolean | null
          end_date?: string | null
          expected_update_auto?: boolean | null
          expected_update_date?: string | null
          goal_completion_date?: string | null
          id?: string
          invoiced_date?: string | null
          is_draft?: boolean
          number_of_vidpods?: number | null
          odoo_invoice_status?: string | null
          odoo_last_synced_at?: string | null
          odoo_order_id?: number | null
          po_number?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          project_description?: string | null
          project_type_id?: string | null
          sales_amount?: number | null
          sales_order_number?: string
          sales_order_url?: string | null
          salesperson_id?: string | null
          schedule_status?: string | null
          scope_link?: string | null
          secondary_activecampaign_contact_id?: string | null
          secondary_poc_email?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          activecampaign_account_id?: string | null
          activecampaign_contact_id?: string | null
          client_name?: string
          client_portal_views?: number
          client_token?: string | null
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          created_date?: string
          current_status_id?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_state?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email_notifications_enabled?: boolean | null
          end_date?: string | null
          expected_update_auto?: boolean | null
          expected_update_date?: string | null
          goal_completion_date?: string | null
          id?: string
          invoiced_date?: string | null
          is_draft?: boolean
          number_of_vidpods?: number | null
          odoo_invoice_status?: string | null
          odoo_last_synced_at?: string | null
          odoo_order_id?: number | null
          po_number?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          project_description?: string | null
          project_type_id?: string | null
          sales_amount?: number | null
          sales_order_number?: string
          sales_order_url?: string | null
          salesperson_id?: string | null
          schedule_status?: string | null
          scope_link?: string | null
          secondary_activecampaign_contact_id?: string | null
          secondary_poc_email?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_current_status_id_fkey"
            columns: ["current_status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_goals: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          invoiced_revenue_goal: number | null
          month: number
          projects_goal: number
          revenue_goal: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoiced_revenue_goal?: number | null
          month: number
          projects_goal?: number
          revenue_goal?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoiced_revenue_goal?: number | null
          month?: number
          projects_goal?: number
          revenue_goal?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters: Json
          id?: string
          is_default?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signage_slides: {
        Row: {
          config: Json | null
          created_at: string | null
          display_order: number
          duration_ms: number | null
          enabled: boolean | null
          id: string
          slide_type: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          display_order: number
          duration_ms?: number | null
          enabled?: boolean | null
          id?: string
          slide_type: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          display_order?: number
          duration_ms?: number | null
          enabled?: boolean | null
          id?: string
          slide_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          note: string | null
          project_id: string | null
          status_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          status_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          is_exception: boolean | null
          is_internal_only: boolean | null
          name: string
          require_note: boolean | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order: number
          id?: string
          is_active?: boolean | null
          is_exception?: boolean | null
          is_internal_only?: boolean | null
          name: string
          require_note?: boolean | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          is_exception?: boolean | null
          is_internal_only?: boolean | null
          name?: string
          require_note?: boolean | null
        }
        Relationships: []
      }
      synced_calendar_events: {
        Row: {
          assignment_id: string
          external_event_id: string
          id: string
          last_synced_at: string | null
          sync_error: string | null
          user_id: string
        }
        Insert: {
          assignment_id: string
          external_event_id: string
          id?: string
          last_synced_at?: string | null
          sync_error?: string | null
          user_id: string
        }
        Update: {
          assignment_id?: string
          external_event_id?: string
          id?: string
          last_synced_at?: string | null
          sync_error?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_calendar_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pending_confirmations: {
        Row: {
          assignment_count: number | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          is_expired: boolean | null
          project_id: string | null
          project_name: string | null
          sent_at: string | null
          sent_to_email: string | null
          sent_to_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_user_conflicts: {
        Args: {
          p_end_date: string
          p_exclude_assignment_id?: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          conflict_date: string
          conflicting_assignment_id: string
          conflicting_project_id: string
          conflicting_project_name: string
        }[]
      }
      expire_pending_confirmation_requests: { Args: never; Returns: number }
      get_calendar_assignments: {
        Args: {
          p_end_date: string
          p_project_id?: string
          p_start_date: string
        }
        Returns: {
          assignment_id: string
          booking_status: string
          project_end_date: string
          project_id: string
          project_name: string
          project_start_date: string
          user_id: string
          user_name: string
        }[]
      }
      get_comment_team_id: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: string
      }
      get_confirmation_details: {
        Args: { p_token: string }
        Returns: {
          assignment_count: number
          customer_name: string
          expires_at: string
          is_expired: boolean
          project_name: string
          sent_to_email: string
          sent_to_name: string
          status: string
        }[]
      }
      get_confirmation_schedule: {
        Args: { p_token: string }
        Returns: {
          end_time: string
          engineer_name: string
          start_time: string
          work_date: string
        }[]
      }
      get_monthly_goal: {
        Args: { p_month: number; p_year: number }
        Returns: {
          projects_goal: number
          revenue_goal: number
        }[]
      }
      get_next_booking_status: {
        Args: { p_current_status: string }
        Returns: string
      }
      get_pending_upload_count: { Args: { p_user_id: string }; Returns: number }
      get_presales_file_counts: {
        Args: { p_deal_id: string }
        Returns: {
          category: Database["public"]["Enums"]["file_category"]
          count: number
        }[]
      }
      get_project_file_counts: {
        Args: { p_project_id: string }
        Returns: {
          category: Database["public"]["Enums"]["file_category"]
          count: number
        }[]
      }
      get_quarterly_goal: {
        Args: { p_quarter: number; p_year: number }
        Returns: {
          projects_goal: number
          revenue_goal: number
        }[]
      }
      get_sharepoint_config: { Args: never; Returns: Json }
      get_user_role: { Args: { user_id: string }; Returns: string }
      get_user_schedule: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: {
          assignment_id: string
          booking_status: string
          day_id: string
          end_time: string
          project_id: string
          project_name: string
          sales_order_number: string
          schedule_date: string
          start_time: string
        }[]
      }
      get_user_team_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_yearly_goal: {
        Args: { p_year: number }
        Returns: {
          projects_goal: number
          revenue_goal: number
        }[]
      }
      has_team_role: {
        Args: { p_roles: string[]; p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_portal_views: {
        Args: { project_id: string }
        Returns: undefined
      }
      is_sharepoint_configured: { Args: never; Returns: boolean }
      is_status_visible_to_engineers: {
        Args: { p_status: string }
        Returns: boolean
      }
      is_team_creator: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      link_presales_files_to_project: {
        Args: { p_deal_id: string; p_project_id: string }
        Returns: number
      }
      migrate_presales_to_project_files: {
        Args: {
          p_connection_id?: string
          p_deal_id: string
          p_project_id: string
        }
        Returns: number
      }
      process_confirmation_response: {
        Args: { p_action: string; p_decline_reason?: string; p_token: string }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      validate_confirmation_token: {
        Args: { p_token: string }
        Returns: {
          error_message: string
          is_expired: boolean
          is_valid: boolean
          project_id: string
          request_id: string
          status: string
        }[]
      }
    }
    Enums: {
      file_category:
        | "schematics"
        | "sow"
        | "photos"
        | "videos"
        | "other"
        | "media"
      upload_status: "pending" | "uploading" | "uploaded" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      file_category: [
        "schematics",
        "sow",
        "photos",
        "videos",
        "other",
        "media",
      ],
      upload_status: ["pending", "uploading", "uploaded", "failed"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.78.1 (currently installed v2.65.6)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
