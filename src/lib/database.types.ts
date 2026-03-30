// =============================================================================
// Equipo Nico Barrera — Database Type Definitions
// Generated from supabase/schema.sql
//
// IMPORTANT: Postgres `numeric` columns are serialized as strings by PostgREST.
// Columns with defaults are typed as non-nullable (application invariant).
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          target_name: string | null
          impact: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json
          target_name?: string | null
          impact?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json
          target_name?: string | null
          impact?: string | null
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_events: {
        Row: {
          id: string
          launch_id: string
          user_id: string
          event_type: "task_completed" | "early_delivery" | "late_delivery" | "quality_bonus" | "initiative" | "collaboration" | "streak" | "penalty" | "adjustment" | "settlement" | "kpi_weekly" | "daily_close" | "missed_daily_close"
          points: number
          description: string | null
          registered_by: string
          final_bonus_amount: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          launch_id: string
          user_id: string
          event_type: "task_completed" | "early_delivery" | "late_delivery" | "quality_bonus" | "initiative" | "collaboration" | "streak" | "penalty" | "adjustment" | "settlement" | "kpi_weekly" | "daily_close" | "missed_daily_close"
          points: number
          description?: string | null
          registered_by: string
          final_bonus_amount?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          launch_id?: string
          user_id?: string
          event_type?: string
          points?: number
          description?: string | null
          registered_by?: string
          final_bonus_amount?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_events_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "bonus_launches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_events_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_launches: {
        Row: {
          id: string
          name: string
          type: "principal" | "low_ticket"
          status: "active" | "projected" | "closed"
          revenue_bruto: string
          margen_neto_pct: string
          pool_pct: string
          revenue_real: string | null
          margen_real_pct: string | null
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          type: "principal" | "low_ticket"
          status?: "active" | "projected" | "closed"
          revenue_bruto?: string | number
          margen_neto_pct?: string | number
          pool_pct?: string | number
          revenue_real?: string | number | null
          margen_real_pct?: string | number | null
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: "principal" | "low_ticket"
          status?: "active" | "projected" | "closed"
          revenue_bruto?: string | number
          margen_neto_pct?: string | number
          pool_pct?: string | number
          revenue_real?: string | number | null
          margen_real_pct?: string | number | null
          created_at?: string
          closed_at?: string | null
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          id: string
          user_id: string
          checkin_date: string
          hours_worked: string // numeric -> string via PostgREST
          fires_handled: number
          blocks_count: number
          summary: string
          completion_pct: string // numeric -> string via PostgREST
          auto_closed: boolean   // migration 020: ghost-close flag
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          checkin_date?: string
          hours_worked: number | string
          fires_handled: number
          blocks_count: number
          summary: string
          completion_pct?: number | string
          auto_closed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          checkin_date?: string
          hours_worked?: number | string
          fires_handled?: number
          blocks_count?: number
          summary?: string
          completion_pct?: number | string
          auto_closed?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          id: string
          user_id: string
          date: string
          tasks_completed: Json[]
          tasks_pending: Json[]
          tasks_overdue: Json[]
          completion_pct: string
          streak: number
          notes: string | null
          auto_generated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          tasks_completed?: Json[]
          tasks_pending?: Json[]
          tasks_overdue?: Json[]
          completion_pct?: string | number
          streak?: number
          notes?: string | null
          auto_generated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          tasks_completed?: Json[]
          tasks_pending?: Json[]
          tasks_overdue?: Json[]
          completion_pct?: string | number
          streak?: number
          notes?: string | null
          auto_generated?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          id: string
          name: string
          description: string | null
          data_type: "number" | "boolean" | "percentage"
          target_value: string   // numeric -> string via PostgREST
          max_points: number
          assigned_to: string
          is_active: boolean
          display_order: number
          /** 'asc' = higher is better (default); 'desc' = lower is better */
          direction: "asc" | "desc"
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          data_type: "number" | "boolean" | "percentage"
          target_value?: number | string
          max_points: number
          assigned_to: string
          is_active?: boolean
          display_order?: number
          direction?: "asc" | "desc"
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          data_type?: "number" | "boolean" | "percentage"
          target_value?: number | string
          max_points?: number
          assigned_to?: string
          is_active?: boolean
          display_order?: number
          direction?: "asc" | "desc"
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_tracking: {
        Row: {
          id: string
          user_id: string
          kpi_id: string
          week_start: string   // date column -> "YYYY-MM-DDT00:00:00+00:00"
          value: string | null // numeric -> string via PostgREST
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kpi_id: string
          week_start: string
          value?: number | string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kpi_id?: string
          week_start?: string
          value?: number | string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_tracking_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_submissions: {
        Row: {
          id: string
          user_id: string
          week_start: string       // date column
          status: "draft" | "submitted"
          submitted_at: string | null
          total_points: string | null  // numeric -> string via PostgREST
          max_possible: string | null  // numeric -> string via PostgREST
          bonus_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          status?: "draft" | "submitted"
          submitted_at?: string | null
          total_points?: number | string | null
          max_possible?: number | string | null
          bonus_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          status?: "draft" | "submitted"
          submitted_at?: string | null
          total_points?: number | string | null
          max_possible?: number | string | null
          bonus_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_submissions_bonus_event_id_fkey"
            columns: ["bonus_event_id"]
            isOneToOne: false
            referencedRelation: "bonus_events"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          id: string
          name: string
          color: string
          is_default: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          is_default?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          is_default?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_recurrences: {
        Row: {
          id: string
          title: string
          description: string | null
          priority: "low" | "medium" | "high" | "urgent"
          category_id: string | null
          frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom"
          days_of_week: number[]
          assigned_to: string | null
          next_due_date: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          task_type: "planeada" | "incendio"
          default_status: "pending" | "in_progress" | "completed" | "blocked"
          attachments: Json[]
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          priority?: "low" | "medium" | "high" | "urgent"
          category_id?: string | null
          frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom"
          days_of_week?: number[]
          assigned_to?: string | null
          next_due_date?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          task_type?: "planeada" | "incendio"
          default_status?: "pending" | "in_progress" | "completed" | "blocked"
          attachments?: Json[]
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          priority?: "low" | "medium" | "high" | "urgent"
          category_id?: string | null
          frequency?: "daily" | "weekly" | "biweekly" | "monthly" | "custom"
          days_of_week?: number[]
          assigned_to?: string | null
          next_due_date?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          task_type?: "planeada" | "incendio"
          default_status?: "pending" | "in_progress" | "completed" | "blocked"
          attachments?: Json[]
        }
        Relationships: [
          {
            foreignKeyName: "task_recurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrences_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: "pending" | "in_progress" | "completed" | "blocked"
          priority: "low" | "medium" | "high" | "urgent"
          assigned_to: string | null
          created_by: string | null
          due_date: string | null
          completed_at: string | null
          category_id: string | null
          parent_task_id: string | null
          is_recurring_instance: boolean
          recurrence_id: string | null
          attachments: Json[]
          is_archived: boolean
          time_spent: number | null
          task_type: "planeada" | "incendio"
          estimated_time: number | null
          impact: "high" | "medium" | "low" | null
          block_type: "internal" | "external" | null
          block_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: "pending" | "in_progress" | "completed" | "blocked"
          priority?: "low" | "medium" | "high" | "urgent"
          assigned_to?: string | null
          created_by?: string | null
          due_date?: string | null
          completed_at?: string | null
          category_id?: string | null
          parent_task_id?: string | null
          is_recurring_instance?: boolean
          recurrence_id?: string | null
          attachments?: Json
          is_archived?: boolean
          time_spent?: number | null
          task_type?: "planeada" | "incendio"
          estimated_time?: number | null
          impact?: "high" | "medium" | "low" | null
          block_type?: "internal" | "external" | null
          block_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: "pending" | "in_progress" | "completed" | "blocked"
          priority?: "low" | "medium" | "high" | "urgent"
          assigned_to?: string | null
          created_by?: string | null
          due_date?: string | null
          completed_at?: string | null
          category_id?: string | null
          parent_task_id?: string | null
          is_recurring_instance?: boolean
          recurrence_id?: string | null
          attachments?: Json
          is_archived?: boolean
          time_spent?: number | null
          task_type?: "planeada" | "incendio"
          estimated_time?: number | null
          impact?: "high" | "medium" | "low" | null
          block_type?: "internal" | "external" | null
          block_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "task_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_absences: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_date: string
          end_date: string
          reason?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_absences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_absences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          discord_id: string
          name: string
          avatar_url: string | null
          role: "super_admin" | "ceo" | "member"
          area: string | null
          is_active: boolean
          notification_preferences: {
            all: boolean
            urgent_only: boolean
            reminders_only: boolean
            none: boolean
          }
          created_at: string
        }
        Insert: {
          id?: string
          discord_id: string
          name: string
          avatar_url?: string | null
          role?: "super_admin" | "ceo" | "member"
          area?: string | null
          is_active?: boolean
          notification_preferences?: Json
          created_at?: string
        }
        Update: {
          id?: string
          discord_id?: string
          name?: string
          avatar_url?: string | null
          role?: "super_admin" | "ceo" | "member"
          area?: string | null
          is_active?: boolean
          notification_preferences?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
