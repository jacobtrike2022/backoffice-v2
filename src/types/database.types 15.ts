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
      activity_events: {
        Row: {
          context_grouping_ids: string[] | null
          context_language: string | null
          context_parent_id: string | null
          context_parent_type: string | null
          context_platform: string | null
          context_registration: string | null
          id: string
          metadata: Json | null
          object_id: string
          object_name: string | null
          object_type: string
          result_completion: boolean | null
          result_duration: string | null
          result_response: string | null
          result_score_max: number | null
          result_score_min: number | null
          result_score_raw: number | null
          result_score_scaled: number | null
          result_success: boolean | null
          stored_at: string
          timestamp: string
          user_id: string
          verb: string
        }
        Insert: {
          context_grouping_ids?: string[] | null
          context_language?: string | null
          context_parent_id?: string | null
          context_parent_type?: string | null
          context_platform?: string | null
          context_registration?: string | null
          id?: string
          metadata?: Json | null
          object_id: string
          object_name?: string | null
          object_type: string
          result_completion?: boolean | null
          result_duration?: string | null
          result_response?: string | null
          result_score_max?: number | null
          result_score_min?: number | null
          result_score_raw?: number | null
          result_score_scaled?: number | null
          result_success?: boolean | null
          stored_at?: string
          timestamp: string
          user_id: string
          verb: string
        }
        Update: {
          context_grouping_ids?: string[] | null
          context_language?: string | null
          context_parent_id?: string | null
          context_parent_type?: string | null
          context_platform?: string | null
          context_registration?: string | null
          id?: string
          metadata?: Json | null
          object_id?: string
          object_name?: string | null
          object_type?: string
          result_completion?: boolean | null
          result_duration?: string | null
          result_response?: string | null
          result_score_max?: number | null
          result_score_min?: number | null
          result_score_raw?: number | null
          result_score_scaled?: number | null
          result_success?: boolean | null
          stored_at?: string
          timestamp?: string
          user_id?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_log: {
        Row: {
          analysis_type: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          organization_id: string | null
          started_at: string | null
          status: string | null
          track_id: string | null
        }
        Insert: {
          analysis_type: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          started_at?: string | null
          status?: string | null
          track_id?: string | null
        }
        Update: {
          analysis_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          started_at?: string | null
          status?: string | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_log_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tag_suggestions: {
        Row: {
          confidence: number | null
          created_at: string | null
          created_tag_id: string | null
          id: string
          model_version: string | null
          organization_id: string | null
          processing_time_ms: number | null
          prompt_hash: string | null
          reasoning: string | null
          response_hash: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_parent_category: string | null
          suggested_parent_id: string | null
          suggested_tag_name: string
          track_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          created_tag_id?: string | null
          id?: string
          model_version?: string | null
          organization_id?: string | null
          processing_time_ms?: number | null
          prompt_hash?: string | null
          reasoning?: string | null
          response_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_parent_category?: string | null
          suggested_parent_id?: string | null
          suggested_tag_name: string
          track_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          created_tag_id?: string | null
          id?: string
          model_version?: string | null
          organization_id?: string | null
          processing_time_ms?: number | null
          prompt_hash?: string | null
          reasoning?: string | null
          response_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_parent_category?: string | null
          suggested_parent_id?: string | null
          suggested_tag_name?: string
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_tag_suggestions_created_tag_id_fkey"
            columns: ["created_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tag_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tag_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tag_suggestions_suggested_parent_id_fkey"
            columns: ["suggested_parent_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tag_suggestions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      album_tracks: {
        Row: {
          album_id: string
          created_at: string
          display_order: number
          id: string
          is_required: boolean | null
          track_id: string
          unlock_previous: boolean | null
        }
        Insert: {
          album_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean | null
          track_id: string
          unlock_previous?: boolean | null
        }
        Update: {
          album_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean | null
          track_id?: string
          unlock_previous?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "album_tracks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      album_versions: {
        Row: {
          album_id: string
          change_notes: string | null
          created_at: string | null
          created_by: string | null
          id: string
          track_ids: string[]
          track_order: Json | null
          version: number
        }
        Insert: {
          album_id: string
          change_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          track_ids: string[]
          track_order?: Json | null
          version: number
        }
        Update: {
          album_id?: string
          change_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          track_ids?: string[]
          track_order?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "album_versions_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          organization_id: string
          requirement_id: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          organization_id: string
          requirement_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          requirement_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          expires_at: string | null
          id: string
          notification_sent: boolean | null
          organization_id: string
          playlist_id: string | null
          progress_percent: number | null
          reminder_sent: boolean | null
          started_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          expires_at?: string | null
          id?: string
          notification_sent?: boolean | null
          organization_id: string
          playlist_id?: string | null
          progress_percent?: number | null
          reminder_sent?: boolean | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          expires_at?: string | null
          id?: string
          notification_sent?: boolean | null
          organization_id?: string
          playlist_id?: string | null
          progress_percent?: number | null
          reminder_sent?: boolean | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          id: string
          organization_id: string
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_embeddings: {
        Row: {
          chunk_index: number | null
          chunk_text: string
          content_id: string
          content_summary: string | null
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          is_system_template: boolean | null
          metadata: Json | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          chunk_index?: number | null
          chunk_text: string
          content_id: string
          content_summary?: string | null
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_system_template?: boolean | null
          metadata?: Json | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          chunk_index?: number | null
          chunk_text?: string
          content_id?: string
          content_summary?: string | null
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_system_template?: boolean | null
          metadata?: Json | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          sources: Json | null
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          sources?: Json | null
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          sources?: Json | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "brain_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_imports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_log: Json | null
          failed_rows: number | null
          file_name: string
          file_storage_path: string | null
          id: string
          imported_by: string
          organization_id: string
          status: string | null
          successful_rows: number | null
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name: string
          file_storage_path?: string | null
          id?: string
          imported_by: string
          organization_id: string
          status?: string | null
          successful_rows?: number | null
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name?: string
          file_storage_path?: string | null
          id?: string
          imported_by?: string
          organization_id?: string
          status?: string | null
          successful_rows?: number | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certification_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          badge_url: string | null
          certificate_template: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_after_days: number | null
          id: string
          is_active: boolean | null
          minimum_score: number | null
          name: string
          organization_id: string
          required_album_ids: string[] | null
          required_playlist_ids: string[] | null
          required_track_ids: string[] | null
          requires_renewal: boolean | null
          updated_at: string
        }
        Insert: {
          badge_url?: string | null
          certificate_template?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_after_days?: number | null
          id?: string
          is_active?: boolean | null
          minimum_score?: number | null
          name: string
          organization_id: string
          required_album_ids?: string[] | null
          required_playlist_ids?: string[] | null
          required_track_ids?: string[] | null
          requires_renewal?: boolean | null
          updated_at?: string
        }
        Update: {
          badge_url?: string | null
          certificate_template?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_after_days?: number | null
          id?: string
          is_active?: boolean | null
          minimum_score?: number | null
          name?: string
          organization_id?: string
          required_album_ids?: string[] | null
          required_playlist_ids?: string[] | null
          required_track_ids?: string[] | null
          requires_renewal?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_assignment_queue: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          employee_id: string
          id: string
          organization_id: string
          playlist_id: string | null
          requirement_id: string
          status: string
          suppressed_at: string | null
          suppressed_by: string | null
          suppression_reason: string | null
          trigger_details: Json | null
          trigger_source_id: string | null
          triggered_by: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          organization_id: string
          playlist_id?: string | null
          requirement_id: string
          status?: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          suppression_reason?: string | null
          trigger_details?: Json | null
          trigger_source_id?: string | null
          triggered_by: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          playlist_id?: string | null
          requirement_id?: string
          status?: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          suppression_reason?: string | null
          trigger_details?: Json | null
          trigger_source_id?: string | null
          triggered_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assignment_queue_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assignment_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assignment_queue_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assignment_queue_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assignment_queue_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
        ]
      }
      compliance_authorities: {
        Row: {
          abbreviation: string | null
          authority_type: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          state_code: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          authority_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          state_code: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          authority_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          state_code?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      compliance_requirements: {
        Row: {
          applies_to_everyone: boolean | null
          applies_to_foodservice: boolean | null
          applies_to_frontline: boolean | null
          applies_to_managers: boolean | null
          applies_to_retail: boolean | null
          approval_required: string | null
          authority_id: string | null
          authority_url: string | null
          cert_details_url: string | null
          course_name: string | null
          created_at: string | null
          days_to_complete: number | null
          ee_training_required: string | null
          id: string
          jurisdiction_level: string | null
          jurisdiction_name: string | null
          last_verified_date: string | null
          law_code_reference: string | null
          law_name: string | null
          notes: string | null
          notion_id: string | null
          partner_available: boolean | null
          partner_name: string | null
          recertification_years: number | null
          requirement_name: string
          roadmap_priority: string | null
          state_code: string
          status: string | null
          topic_id: string | null
          training_hours: number | null
          updated_at: string | null
        }
        Insert: {
          applies_to_everyone?: boolean | null
          applies_to_foodservice?: boolean | null
          applies_to_frontline?: boolean | null
          applies_to_managers?: boolean | null
          applies_to_retail?: boolean | null
          approval_required?: string | null
          authority_id?: string | null
          authority_url?: string | null
          cert_details_url?: string | null
          course_name?: string | null
          created_at?: string | null
          days_to_complete?: number | null
          ee_training_required?: string | null
          id?: string
          jurisdiction_level?: string | null
          jurisdiction_name?: string | null
          last_verified_date?: string | null
          law_code_reference?: string | null
          law_name?: string | null
          notes?: string | null
          notion_id?: string | null
          partner_available?: boolean | null
          partner_name?: string | null
          recertification_years?: number | null
          requirement_name: string
          roadmap_priority?: string | null
          state_code: string
          status?: string | null
          topic_id?: string | null
          training_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          applies_to_everyone?: boolean | null
          applies_to_foodservice?: boolean | null
          applies_to_frontline?: boolean | null
          applies_to_managers?: boolean | null
          applies_to_retail?: boolean | null
          approval_required?: string | null
          authority_id?: string | null
          authority_url?: string | null
          cert_details_url?: string | null
          course_name?: string | null
          created_at?: string | null
          days_to_complete?: number | null
          ee_training_required?: string | null
          id?: string
          jurisdiction_level?: string | null
          jurisdiction_name?: string | null
          last_verified_date?: string | null
          law_code_reference?: string | null
          law_name?: string | null
          notes?: string | null
          notion_id?: string | null
          partner_available?: boolean | null
          partner_name?: string | null
          recertification_years?: number | null
          requirement_name?: string
          roadmap_priority?: string | null
          state_code?: string
          status?: string | null
          topic_id?: string | null
          training_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "compliance_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "compliance_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_topics: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_knowledge: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          knowledge_id: string
          relevance_score: number | null
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          knowledge_id: string
          relevance_score?: number | null
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          knowledge_id?: string
          relevance_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_knowledge_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "onet_knowledge"
            referencedColumns: ["knowledge_id"]
          },
        ]
      }
      content_occupations: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          onet_code: string
          relevance_score: number | null
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          onet_code: string
          relevance_score?: number | null
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          onet_code?: string
          relevance_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_occupations_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      content_skills: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          relevance_score: number | null
          skill_id: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          skill_id: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          skill_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "onet_skills"
            referencedColumns: ["skill_id"]
          },
        ]
      }
      content_tasks: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          relevance_score: number | null
          task_id: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          task_id: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onet_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      content_type_registry: {
        Row: {
          created_at: string | null
          description: string | null
          detection_keywords: string[] | null
          detection_patterns: string[] | null
          display_name: string
          extraction_handler: string | null
          id: string
          is_active: boolean | null
          min_confidence: number | null
          target_entity: string | null
          type_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          detection_keywords?: string[] | null
          detection_patterns?: string[] | null
          display_name: string
          extraction_handler?: string | null
          id?: string
          is_active?: boolean | null
          min_confidence?: number | null
          target_entity?: string | null
          type_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          detection_keywords?: string[] | null
          detection_patterns?: string[] | null
          display_name?: string
          extraction_handler?: string | null
          id?: string
          is_active?: boolean | null
          min_confidence?: number | null
          target_entity?: string | null
          type_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          deal_id: string
          description: string | null
          from_stage: string | null
          from_value: number | null
          id: string
          metadata: Json | null
          title: string
          to_stage: string | null
          to_value: number | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          deal_id: string
          description?: string | null
          from_stage?: string | null
          from_value?: number | null
          id?: string
          metadata?: Json | null
          title: string
          to_stage?: string | null
          to_value?: number | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          deal_id?: string
          description?: string | null
          from_stage?: string | null
          from_value?: number | null
          id?: string
          metadata?: Json | null
          title?: string
          to_stage?: string | null
          to_value?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          contract_id: string | null
          contract_signed_at: string | null
          contract_signer_email: string | null
          contract_status: string | null
          created_at: string | null
          deal_type: string | null
          expected_close_date: string | null
          id: string
          last_activity_at: string | null
          lost_competitor: string | null
          lost_reason: string | null
          metadata: Json | null
          mrr: number | null
          name: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          organization_id: string
          owner_id: string | null
          probability: number | null
          stage: string
          tags: string[] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          actual_close_date?: string | null
          contract_id?: string | null
          contract_signed_at?: string | null
          contract_signer_email?: string | null
          contract_status?: string | null
          created_at?: string | null
          deal_type?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_competitor?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          mrr?: number | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          actual_close_date?: string | null
          contract_id?: string | null
          contract_signed_at?: string | null
          contract_signer_email?: string | null
          contract_status?: string | null
          created_at?: string | null
          deal_type?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_competitor?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          mrr?: number | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string | null
          created_at: string
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          organization_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_districts_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body_html: string | null
          clicked_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          organization_id: string
          recipient_email: string
          recipient_user_id: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          template_slug: string | null
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          body_html?: string | null
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          organization_id: string
          recipient_email: string
          recipient_user_id?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          template_slug?: string | null
          trigger_type: string
          triggered_by?: string | null
        }
        Update: {
          body_html?: string | null
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string
          recipient_email?: string
          recipient_user_id?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          template_slug?: string | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: Json | null
          body_html: string
          body_text: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_locked: boolean | null
          name: string
          organization_id: string | null
          slug: string
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          available_variables?: Json | null
          body_html: string
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          name: string
          organization_id?: string | null
          slug: string
          subject: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          available_variables?: Json | null
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          name?: string
          organization_id?: string | null
          slug?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_certification_uploads: {
        Row: {
          certificate_number: string | null
          certificate_type: string
          created_at: string | null
          document_storage_path: string
          document_url: string
          expiry_date: string | null
          id: string
          issue_date: string
          issuing_authority: string
          name_on_certificate: string
          organization_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state_issued: string | null
          status: string | null
          training_provider: string | null
          updated_at: string | null
          user_certification_id: string | null
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          certificate_type: string
          created_at?: string | null
          document_storage_path: string
          document_url: string
          expiry_date?: string | null
          id?: string
          issue_date: string
          issuing_authority: string
          name_on_certificate: string
          organization_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state_issued?: string | null
          status?: string | null
          training_provider?: string | null
          updated_at?: string | null
          user_certification_id?: string | null
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string | null
          document_storage_path?: string
          document_url?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string
          issuing_authority?: string
          name_on_certificate?: string
          organization_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state_issued?: string | null
          status?: string | null
          training_provider?: string | null
          updated_at?: string | null
          user_certification_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_certification_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_certification_uploads_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_certification_uploads_user_certification_id_fkey"
            columns: ["user_certification_id"]
            isOneToOne: false
            referencedRelation: "user_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_certification_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_entities: {
        Row: {
          created_at: string | null
          entity_status: string | null
          entity_type: string
          extracted_data: Json
          extraction_confidence: number | null
          extraction_method: string | null
          id: string
          link_action: string | null
          linked_at: string | null
          linked_by: string | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          onet_suggestions: Json | null
          organization_id: string
          processed_at: string | null
          processed_by: string | null
          processing_notes: string | null
          source_chunk_id: string | null
          source_file_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_status?: string | null
          entity_type: string
          extracted_data?: Json
          extraction_confidence?: number | null
          extraction_method?: string | null
          id?: string
          link_action?: string | null
          linked_at?: string | null
          linked_by?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          onet_suggestions?: Json | null
          organization_id: string
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          source_chunk_id?: string | null
          source_file_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_status?: string | null
          entity_type?: string
          extracted_data?: Json
          extraction_confidence?: number | null
          extraction_method?: string | null
          id?: string
          link_action?: string | null
          linked_at?: string | null
          linked_by?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          onet_suggestions?: Json | null
          organization_id?: string
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          source_chunk_id?: string | null
          source_file_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_entities_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_conflicts: {
        Row: {
          conflicting_fact_id: string
          detected_at: string | null
          fact_id: string
          id: string
          reason: string
          resolution: string | null
        }
        Insert: {
          conflicting_fact_id: string
          detected_at?: string | null
          fact_id: string
          id?: string
          reason: string
          resolution?: string | null
        }
        Update: {
          conflicting_fact_id?: string
          detected_at?: string | null
          fact_id?: string
          id?: string
          reason?: string
          resolution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fact_conflicts_conflicting_fact_id_fkey"
            columns: ["conflicting_fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_conflicts_conflicting_fact_id_fkey"
            columns: ["conflicting_fact_id"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_conflicts_conflicting_fact_id_fkey"
            columns: ["conflicting_fact_id"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_conflicts_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_conflicts_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_conflicts_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_usage: {
        Row: {
          added_at: string | null
          display_order: number | null
          fact_id: string
          id: string
          media_transcript_id: string | null
          source_media_id: string | null
          source_media_type: string | null
          source_media_url: string | null
          track_id: string
          track_type: string
        }
        Insert: {
          added_at?: string | null
          display_order?: number | null
          fact_id: string
          id?: string
          media_transcript_id?: string | null
          source_media_id?: string | null
          source_media_type?: string | null
          source_media_url?: string | null
          track_id: string
          track_type: string
        }
        Update: {
          added_at?: string | null
          display_order?: number | null
          fact_id?: string
          id?: string
          media_transcript_id?: string | null
          source_media_id?: string | null
          source_media_type?: string | null
          source_media_url?: string | null
          track_id?: string
          track_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_usage_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_usage_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_usage_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_usage_media_transcript_id_fkey"
            columns: ["media_transcript_id"]
            isOneToOne: false
            referencedRelation: "media_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          change_history: Json | null
          company_id: string | null
          content: string
          context: Json
          created_at: string | null
          effectiveness: number | null
          external_source: Json | null
          extracted_by: string | null
          extraction_confidence: number | null
          id: string
          last_verified: string | null
          needs_review: boolean | null
          prerequisite_facts: Json | null
          related_facts: Json | null
          source_id: string | null
          source_page: number | null
          source_section: string | null
          steps: Json | null
          superseded_by: string | null
          supersedes: Json | null
          title: string
          type: string
          updated_at: string | null
          verified_by: string | null
          version: number | null
          views: number | null
        }
        Insert: {
          change_history?: Json | null
          company_id?: string | null
          content: string
          context?: Json
          created_at?: string | null
          effectiveness?: number | null
          external_source?: Json | null
          extracted_by?: string | null
          extraction_confidence?: number | null
          id?: string
          last_verified?: string | null
          needs_review?: boolean | null
          prerequisite_facts?: Json | null
          related_facts?: Json | null
          source_id?: string | null
          source_page?: number | null
          source_section?: string | null
          steps?: Json | null
          superseded_by?: string | null
          supersedes?: Json | null
          title: string
          type: string
          updated_at?: string | null
          verified_by?: string | null
          version?: number | null
          views?: number | null
        }
        Update: {
          change_history?: Json | null
          company_id?: string | null
          content?: string
          context?: Json
          created_at?: string | null
          effectiveness?: number | null
          external_source?: Json | null
          extracted_by?: string | null
          extraction_confidence?: number | null
          id?: string
          last_verified?: string | null
          needs_review?: boolean | null
          prerequisite_facts?: Json | null
          related_facts?: Json | null
          source_id?: string | null
          source_page?: number | null
          source_section?: string | null
          steps?: Json | null
          superseded_by?: string | null
          supersedes?: Json | null
          title?: string
          type?: string
          updated_at?: string | null
          verified_by?: string | null
          version?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_by_id: string | null
          assignment_type: string
          created_at: string
          due_date: string | null
          form_id: string
          id: string
          organization_id: string
          recurrence: string | null
          status: string | null
          target_id: string
          updated_at: string
        }
        Insert: {
          assigned_by_id?: string | null
          assignment_type: string
          created_at?: string
          due_date?: string | null
          form_id: string
          id?: string
          organization_id: string
          recurrence?: string | null
          status?: string | null
          target_id: string
          updated_at?: string
        }
        Update: {
          assigned_by_id?: string | null
          assignment_type?: string
          created_at?: string
          due_date?: string | null
          form_id?: string
          id?: string
          organization_id?: string
          recurrence?: string | null
          status?: string | null
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_blocks: {
        Row: {
          conditional_logic: Json | null
          created_at: string
          description: string | null
          display_order: number
          form_id: string
          id: string
          is_required: boolean | null
          label: string | null
          options: string[] | null
          placeholder: string | null
          type: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          conditional_logic?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          form_id: string
          id?: string
          is_required?: boolean | null
          label?: string | null
          options?: string[] | null
          placeholder?: string | null
          type: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          conditional_logic?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          form_id?: string
          id?: string
          is_required?: boolean | null
          label?: string | null
          options?: string[] | null
          placeholder?: string | null
          type?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_blocks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers: Json
          created_at: string
          form_id: string
          id: string
          ip_address: string | null
          organization_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_id: string | null
          status: string | null
          submitted_at: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          answers: Json
          created_at?: string
          form_id: string
          id?: string
          ip_address?: string | null
          organization_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          status?: string | null
          submitted_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          form_id?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          status?: string | null
          submitted_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_reviewed_by_fkey"
            columns: ["reviewed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          allow_anonymous: boolean | null
          category: string | null
          created_at: string
          created_by_id: string | null
          description: string | null
          id: string
          organization_id: string
          requires_approval: boolean | null
          settings: Json | null
          status: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          allow_anonymous?: boolean | null
          category?: string | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          id?: string
          organization_id: string
          requires_approval?: boolean | null
          settings?: Json | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          allow_anonymous?: boolean | null
          category?: string | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          requires_approval?: boolean | null
          settings?: Json | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hris_sync_log: {
        Row: {
          completed_at: string | null
          errors: Json | null
          id: string
          organization_id: string
          provider: string
          records_created: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          organization_id: string
          provider: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string | null
          status: string
          sync_type: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          organization_id?: string
          provider?: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hris_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hris_sync_log_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_compliance_requirements: {
        Row: {
          created_at: string | null
          industry_id: string
          is_required: boolean | null
          notes: string | null
          requirement_id: string
        }
        Insert: {
          created_at?: string | null
          industry_id: string
          is_required?: boolean | null
          notes?: string | null
          requirement_id: string
        }
        Update: {
          created_at?: string | null
          industry_id?: string
          is_required?: boolean | null
          notes?: string | null
          requirement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "industry_compliance_requirements_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industry_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industry_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
        ]
      }
      industry_compliance_topics: {
        Row: {
          created_at: string | null
          industry_id: string
          is_typical: boolean | null
          notes: string | null
          priority: number | null
          topic_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          industry_id: string
          is_typical?: boolean | null
          notes?: string | null
          priority?: number | null
          topic_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          industry_id?: string
          is_typical?: boolean | null
          notes?: string | null
          priority?: number | null
          topic_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_compliance_topics_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industry_compliance_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "compliance_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_programs: {
        Row: {
          created_at: string | null
          industry_id: string
          is_common: boolean | null
          market_share_tier: string | null
          notes: string | null
          program_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          industry_id: string
          is_common?: boolean | null
          market_share_tier?: string | null
          notes?: string | null
          program_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          industry_id?: string
          is_common?: boolean | null
          market_share_tier?: string | null
          notes?: string | null
          program_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_programs_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industry_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_attachments: {
        Row: {
          article_id: string
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string
          filename: string
          id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          filename: string
          id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          filename?: string
          id?: string
        }
        Relationships: []
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_page_views: {
        Row: {
          id: string
          ip_address: string | null
          referrer: string | null
          track_id: string
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          referrer?: string | null
          track_id: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          referrer?: string | null
          track_id?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      kb_track_assignments: {
        Row: {
          added_at: string
          added_by: string | null
          display_order: number | null
          display_type: string | null
          id: string
          kb_category_id: string
          organization_id: string
          pinned: boolean | null
          track_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          display_order?: number | null
          display_type?: string | null
          id?: string
          kb_category_id: string
          organization_id: string
          pinned?: boolean | null
          track_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          display_order?: number | null
          display_type?: string | null
          id?: string
          kb_category_id?: string
          organization_id?: string
          pinned?: boolean | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_track_assignments_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_assignments_kb_category_id_fkey"
            columns: ["kb_category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_assignments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_track_bookmarks: {
        Row: {
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_track_bookmarks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_track_views: {
        Row: {
          id: string
          kb_category_id: string | null
          track_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          kb_category_id?: string | null
          track_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          kb_category_id?: string | null
          track_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_track_views_kb_category_id_fkey"
            columns: ["kb_category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_views_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_track_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_store_2858cc8b: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      media_transcripts: {
        Row: {
          confidence_score: number | null
          created_at: string
          duration_seconds: number | null
          id: string
          language: string | null
          last_used_at: string | null
          manual_corrections: string | null
          media_type: string
          media_url: string
          media_url_hash: string
          needs_review: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          transcribed_at: string
          transcript_json: Json | null
          transcript_text: string
          transcript_utterances: Json | null
          transcription_model: string | null
          transcription_service: string | null
          updated_at: string
          usage_count: number | null
          used_in_tracks: string[] | null
          word_count: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          last_used_at?: string | null
          manual_corrections?: string | null
          media_type: string
          media_url: string
          media_url_hash: string
          needs_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          transcribed_at?: string
          transcript_json?: Json | null
          transcript_text: string
          transcript_utterances?: Json | null
          transcription_model?: string | null
          transcription_service?: string | null
          updated_at?: string
          usage_count?: number | null
          used_in_tracks?: string[] | null
          word_count?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          last_used_at?: string | null
          manual_corrections?: string | null
          media_type?: string
          media_url?: string
          media_url_hash?: string
          needs_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          transcribed_at?: string
          transcript_json?: Json | null
          transcript_text?: string
          transcript_utterances?: Json | null
          transcription_model?: string | null
          transcription_service?: string | null
          updated_at?: string
          usage_count?: number | null
          used_in_tracks?: string[] | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_transcripts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          created_at: string | null
          event_type: string
          id: string
          is_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string | null
          event_type: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          event_type?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          link_id: string | null
          link_type: string | null
          message: string
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link_id?: string | null
          link_type?: string | null
          message: string
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link_id?: string | null
          link_type?: string | null
          message?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          collected_data: Json | null
          completed_at: string | null
          conversation_history: Json | null
          created_at: string | null
          current_step: string | null
          id: string
          ip_address: string | null
          last_activity_at: string | null
          organization_id: string | null
          referrer: string | null
          session_token: string
          started_at: string | null
          status: string | null
          steps_completed: string[] | null
          user_agent: string | null
          utm_params: Json | null
        }
        Insert: {
          collected_data?: Json | null
          completed_at?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          ip_address?: string | null
          last_activity_at?: string | null
          organization_id?: string | null
          referrer?: string | null
          session_token: string
          started_at?: string | null
          status?: string | null
          steps_completed?: string[] | null
          user_agent?: string | null
          utm_params?: Json | null
        }
        Update: {
          collected_data?: Json | null
          completed_at?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          ip_address?: string | null
          last_activity_at?: string | null
          organization_id?: string | null
          referrer?: string | null
          session_token?: string
          started_at?: string | null
          status?: string | null
          steps_completed?: string[] | null
          user_agent?: string | null
          utm_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onet_abilities: {
        Row: {
          ability_id: string
          category: string | null
          created_at: string | null
          description: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          ability_id: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          ability_id?: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onet_detailed_activities: {
        Row: {
          activity_id: string
          category: string | null
          created_at: string | null
          description: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          activity_id: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          activity_id?: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onet_education: {
        Row: {
          created_at: string | null
          education_level: string | null
          id: string
          onet_code: string
          percentage: number | null
          required: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          education_level?: string | null
          id?: string
          onet_code: string
          percentage?: number | null
          required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          education_level?: string | null
          id?: string
          onet_code?: string
          percentage?: number | null
          required?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_education_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_knowledge: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          knowledge_id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          knowledge_id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          knowledge_id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onet_licensing: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          license_name: string
          license_type: string | null
          onet_code: string
          required: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          license_name: string
          license_type?: string | null
          onet_code: string
          required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          license_name?: string
          license_type?: string | null
          onet_code?: string
          required?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_licensing_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_occupation_abilities: {
        Row: {
          ability_id: string
          created_at: string | null
          id: string
          importance: number | null
          level: number | null
          onet_code: string
          updated_at: string | null
        }
        Insert: {
          ability_id: string
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code: string
          updated_at?: string | null
        }
        Update: {
          ability_id?: string
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_occupation_abilities_ability_id_fkey"
            columns: ["ability_id"]
            isOneToOne: false
            referencedRelation: "onet_abilities"
            referencedColumns: ["ability_id"]
          },
          {
            foreignKeyName: "onet_occupation_abilities_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_occupation_activities: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          importance: number | null
          level: number | null
          onet_code: string
          updated_at: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code: string
          updated_at?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_occupation_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "onet_detailed_activities"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "onet_occupation_activities_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_occupation_knowledge: {
        Row: {
          created_at: string | null
          id: string
          importance: number | null
          knowledge_id: string
          level: number | null
          onet_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          importance?: number | null
          knowledge_id: string
          level?: number | null
          onet_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          importance?: number | null
          knowledge_id?: string
          level?: number | null
          onet_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_occupation_knowledge_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "onet_knowledge"
            referencedColumns: ["knowledge_id"]
          },
          {
            foreignKeyName: "onet_occupation_knowledge_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_occupation_skills: {
        Row: {
          created_at: string | null
          id: string
          importance: number | null
          level: number | null
          onet_code: string
          skill_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code: string
          skill_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          importance?: number | null
          level?: number | null
          onet_code?: string
          skill_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_occupation_skills_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
          {
            foreignKeyName: "onet_occupation_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "onet_skills"
            referencedColumns: ["skill_id"]
          },
        ]
      }
      onet_occupation_work_styles: {
        Row: {
          created_at: string | null
          distinctiveness_rank: number | null
          id: string
          impact: number | null
          onet_code: string
          updated_at: string | null
          work_style_id: string
        }
        Insert: {
          created_at?: string | null
          distinctiveness_rank?: number | null
          id?: string
          impact?: number | null
          onet_code: string
          updated_at?: string | null
          work_style_id: string
        }
        Update: {
          created_at?: string | null
          distinctiveness_rank?: number | null
          id?: string
          impact?: number | null
          onet_code?: string
          updated_at?: string | null
          work_style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onet_occupation_work_styles_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
          {
            foreignKeyName: "onet_occupation_work_styles_work_style_id_fkey"
            columns: ["work_style_id"]
            isOneToOne: false
            referencedRelation: "onet_work_styles"
            referencedColumns: ["work_style_id"]
          },
        ]
      }
      onet_occupations: {
        Row: {
          also_called: string[] | null
          created_at: string | null
          description: string | null
          job_zone: number | null
          onet_code: string
          title: string
          updated_at: string | null
        }
        Insert: {
          also_called?: string[] | null
          created_at?: string | null
          description?: string | null
          job_zone?: number | null
          onet_code: string
          title: string
          updated_at?: string | null
        }
        Update: {
          also_called?: string[] | null
          created_at?: string | null
          description?: string | null
          job_zone?: number | null
          onet_code?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onet_skills: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          name: string
          skill_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          name: string
          skill_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          name?: string
          skill_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onet_tasks: {
        Row: {
          created_at: string | null
          id: string
          importance: number | null
          onet_code: string
          relevance: number | null
          task_description: string
          task_id: number | null
          task_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          importance?: number | null
          onet_code: string
          relevance?: number | null
          task_description: string
          task_id?: number | null
          task_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          importance?: number | null
          onet_code?: string
          relevance?: number | null
          task_description?: string
          task_id?: number | null
          task_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_tasks_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_technology_skills: {
        Row: {
          created_at: string | null
          hot_technology: boolean | null
          id: string
          onet_code: string
          technology_name: string
          technology_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hot_technology?: boolean | null
          id?: string
          onet_code: string
          technology_name: string
          technology_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hot_technology?: boolean | null
          id?: string
          onet_code?: string
          technology_name?: string
          technology_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_technology_skills_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_work_context: {
        Row: {
          context_category: string
          context_item: string
          created_at: string | null
          id: string
          onet_code: string
          percentage: number | null
          updated_at: string | null
        }
        Insert: {
          context_category: string
          context_item: string
          created_at?: string | null
          id?: string
          onet_code: string
          percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          context_category?: string
          context_item?: string
          created_at?: string | null
          id?: string
          onet_code?: string
          percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onet_work_context_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: false
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      onet_work_styles: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          name: string
          updated_at: string | null
          work_style_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          name: string
          updated_at?: string | null
          work_style_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          name?: string
          updated_at?: string | null
          work_style_id?: string
        }
        Relationships: []
      }
      organization_compliance_topics: {
        Row: {
          added_during: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          priority: number | null
          topic_id: string
        }
        Insert: {
          added_during?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          priority?: number | null
          topic_id: string
        }
        Update: {
          added_during?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          priority?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_compliance_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_compliance_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "compliance_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_status: string | null
          brand_color_primary: string | null
          brand_color_secondary: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          city: string | null
          contract_signed_at: string | null
          converted_at: string | null
          created_at: string
          deal_close_date: string | null
          deal_lost_reason: string | null
          deal_owner_id: string | null
          deal_probability: number | null
          deal_stage: string | null
          deal_value: number | null
          demo_expires_at: string | null
          domain: string | null
          email: string | null
          id: string
          industry: string | null
          industry_id: string | null
          kb_allow_guest_access: boolean | null
          kb_privacy_mode: string | null
          kb_shared_password: string | null
          last_activity_at: string | null
          logo_dark_url: string | null
          logo_light_url: string | null
          logo_url: string | null
          name: string
          next_action: string | null
          next_action_date: string | null
          onboarding_completed_at: string | null
          onboarding_source: string | null
          operating_states: string[] | null
          phone: string | null
          scraped_data: Json | null
          services_offered: string[] | null
          settings: Json | null
          state: string | null
          status: string | null
          street_address: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          subdomain: string | null
          subscription_tier: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          billing_status?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          city?: string | null
          contract_signed_at?: string | null
          converted_at?: string | null
          created_at?: string
          deal_close_date?: string | null
          deal_lost_reason?: string | null
          deal_owner_id?: string | null
          deal_probability?: number | null
          deal_stage?: string | null
          deal_value?: number | null
          demo_expires_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          industry_id?: string | null
          kb_allow_guest_access?: boolean | null
          kb_privacy_mode?: string | null
          kb_shared_password?: string | null
          last_activity_at?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_url?: string | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          onboarding_completed_at?: string | null
          onboarding_source?: string | null
          operating_states?: string[] | null
          phone?: string | null
          scraped_data?: Json | null
          services_offered?: string[] | null
          settings?: Json | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          subdomain?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          billing_status?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          city?: string | null
          contract_signed_at?: string | null
          converted_at?: string | null
          created_at?: string
          deal_close_date?: string | null
          deal_lost_reason?: string | null
          deal_owner_id?: string | null
          deal_probability?: number | null
          deal_stage?: string | null
          deal_value?: number | null
          demo_expires_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          industry_id?: string | null
          kb_allow_guest_access?: boolean | null
          kb_privacy_mode?: string | null
          kb_shared_password?: string | null
          last_activity_at?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_url?: string | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          onboarding_completed_at?: string | null
          onboarding_source?: string | null
          operating_states?: string[] | null
          phone?: string | null
          scraped_data?: Json | null
          services_offered?: string[] | null
          settings?: Json | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          subdomain?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_deal_owner_id_fkey"
            columns: ["deal_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_notifications: {
        Row: {
          actioned_at: string | null
          created_at: string | null
          deal_id: string | null
          delivered_via: string[] | null
          delivery_channels: string[] | null
          id: string
          is_actioned: boolean | null
          is_read: boolean | null
          message: string | null
          metadata: Json | null
          organization_id: string | null
          priority: string
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          actioned_at?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_via?: string[] | null
          delivery_channels?: string[] | null
          id?: string
          is_actioned?: boolean | null
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          organization_id?: string | null
          priority?: string
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          actioned_at?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_via?: string[] | null
          delivery_channels?: string[] | null
          id?: string
          is_actioned?: boolean | null
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          organization_id?: string | null
          priority?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_track_chunks: {
        Row: {
          created_at: string
          id: string
          playbook_track_id: string
          sequence_order: number
          source_chunk_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playbook_track_id: string
          sequence_order?: number
          source_chunk_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playbook_track_id?: string
          sequence_order?: number
          source_chunk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_track_chunks_playbook_track_id_fkey"
            columns: ["playbook_track_id"]
            isOneToOne: false
            referencedRelation: "playbook_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_track_chunks_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_tracks: {
        Row: {
          conflict_resolution: string | null
          conflicts: Json | null
          created_at: string
          description: string | null
          display_order: number
          generated_at: string | null
          generated_content: string | null
          generation_error: string | null
          has_conflicts: boolean | null
          id: string
          organization_id: string
          playbook_id: string
          published_at: string | null
          published_track_id: string | null
          rag_confidence: number | null
          rag_reasoning: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          conflict_resolution?: string | null
          conflicts?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          generated_at?: string | null
          generated_content?: string | null
          generation_error?: string | null
          has_conflicts?: boolean | null
          id?: string
          organization_id: string
          playbook_id: string
          published_at?: string | null
          published_track_id?: string | null
          rag_confidence?: number | null
          rag_reasoning?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          conflict_resolution?: string | null
          conflicts?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          generated_at?: string | null
          generated_content?: string | null
          generation_error?: string | null
          has_conflicts?: boolean | null
          id?: string
          organization_id?: string
          playbook_id?: string
          published_at?: string | null
          published_track_id?: string | null
          rag_confidence?: number | null
          rag_reasoning?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_tracks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_tracks_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_tracks_published_track_id_fkey"
            columns: ["published_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          album_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          rag_analysis: Json | null
          source_file_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          album_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          rag_analysis?: Json | null
          source_file_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          album_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          rag_analysis?: Json | null
          source_file_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_albums: {
        Row: {
          album_id: string
          created_at: string
          display_order: number
          id: string
          playlist_id: string
          release_stage: number | null
        }
        Insert: {
          album_id: string
          created_at?: string
          display_order?: number
          id?: string
          playlist_id: string
          release_stage?: number | null
        }
        Update: {
          album_id?: string
          created_at?: string
          display_order?: number
          id?: string
          playlist_id?: string
          release_stage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_albums_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_albums_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          created_at: string
          display_order: number
          id: string
          playlist_id: string
          release_stage: number | null
          track_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          playlist_id: string
          release_stage?: number | null
          track_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          playlist_id?: string
          release_stage?: number | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          release_schedule: Json | null
          release_type: string | null
          title: string
          trigger_rules: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          release_schedule?: Json | null
          release_type?: string | null
          title: string
          trigger_rules?: Json | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          release_schedule?: Json | null
          release_type?: string | null
          title?: string
          trigger_rules?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_compliance_topics: {
        Row: {
          created_at: string | null
          notes: string | null
          program_id: string
          relationship_type: string | null
          topic_id: string
        }
        Insert: {
          created_at?: string | null
          notes?: string | null
          program_id: string
          relationship_type?: string | null
          topic_id: string
        }
        Update: {
          created_at?: string | null
          notes?: string | null
          program_id?: string
          relationship_type?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_compliance_topics_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_compliance_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "compliance_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          metadata: Json | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
          vendor_name: string | null
          website_url: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
          vendor_name?: string | null
          website_url?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
          vendor_name?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "program_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          content_json: Json | null
          created_at: string | null
          created_by: string | null
          deal_id: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          name: string
          notes: string | null
          organization_id: string
          pdf_url: string | null
          pricing_tiers: Json | null
          rejection_reason: string | null
          responded_at: string | null
          selected_tier: string | null
          sent_at: string | null
          status: string | null
          total_value: number | null
          updated_at: string | null
          version: number | null
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          pdf_url?: string | null
          pricing_tiers?: Json | null
          rejection_reason?: string | null
          responded_at?: string | null
          selected_tier?: string | null
          sent_at?: string | null
          status?: string | null
          total_value?: number | null
          updated_at?: string | null
          version?: number | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          pdf_url?: string | null
          pricing_tiers?: Json | null
          rejection_reason?: string | null
          responded_at?: string | null
          selected_tier?: string | null
          sent_at?: string | null
          status?: string | null
          total_value?: number | null
          updated_at?: string | null
          version?: number | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_topics: {
        Row: {
          created_at: string | null
          id: string
          requirement_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          requirement_id: string
          topic_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          requirement_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_topics_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_topics_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "requirement_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "compliance_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      role_ability_customizations: {
        Row: {
          ability_id: string | null
          action: string
          created_at: string | null
          custom_importance: number | null
          custom_level: number | null
          custom_name: string | null
          id: string
          notes: string | null
          role_id: string
          updated_at: string | null
        }
        Insert: {
          ability_id?: string | null
          action: string
          created_at?: string | null
          custom_importance?: number | null
          custom_level?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          role_id: string
          updated_at?: string | null
        }
        Update: {
          ability_id?: string | null
          action?: string
          created_at?: string | null
          custom_importance?: number | null
          custom_level?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_ability_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_aliases: {
        Row: {
          alias_name: string
          alias_source: string | null
          confidence: number | null
          created_at: string | null
          hris_id: string | null
          id: string
          is_primary: boolean | null
          organization_id: string
          role_id: string
        }
        Insert: {
          alias_name: string
          alias_source?: string | null
          confidence?: number | null
          created_at?: string | null
          hris_id?: string | null
          id?: string
          is_primary?: boolean | null
          organization_id: string
          role_id: string
        }
        Update: {
          alias_name?: string
          alias_source?: string | null
          confidence?: number | null
          created_at?: string | null
          hris_id?: string | null
          id?: string
          is_primary?: boolean | null
          organization_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_aliases_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_compliance_requirements: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          priority: number | null
          requirement_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          priority?: number | null
          requirement_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          priority?: number | null
          requirement_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "role_compliance_requirements_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_knowledge_customizations: {
        Row: {
          action: string
          base_knowledge_id: string | null
          created_at: string | null
          created_by: string | null
          custom_description: string | null
          custom_importance: number | null
          custom_name: string | null
          id: string
          notes: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          base_knowledge_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          base_knowledge_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_knowledge_customizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_knowledge_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_merge_history: {
        Row: {
          id: string
          merged_at: string | null
          merged_by: string | null
          organization_id: string
          reason: string | null
          source_role_id: string
          source_role_name: string
          target_role_id: string
          users_migrated: number | null
        }
        Insert: {
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          organization_id: string
          reason?: string | null
          source_role_id: string
          source_role_name: string
          target_role_id: string
          users_migrated?: number | null
        }
        Update: {
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          organization_id?: string
          reason?: string | null
          source_role_id?: string
          source_role_name?: string
          target_role_id?: string
          users_migrated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "role_merge_history_merged_by_fkey"
            columns: ["merged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_merge_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_merge_history_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_skill_customizations: {
        Row: {
          action: string
          base_skill_id: string | null
          created_at: string | null
          created_by: string | null
          custom_description: string | null
          custom_importance: number | null
          custom_name: string | null
          id: string
          notes: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          base_skill_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          base_skill_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_skill_customizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_skill_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_task_customizations: {
        Row: {
          action: string
          base_task_id: string | null
          created_at: string | null
          created_by: string | null
          custom_description: string | null
          custom_importance: number | null
          id: string
          notes: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          base_task_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          base_task_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_description?: string | null
          custom_importance?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_task_customizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_task_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_technology_customizations: {
        Row: {
          action: string
          base_technology_name: string | null
          created_at: string | null
          created_by: string | null
          custom_examples: string[] | null
          custom_name: string | null
          id: string
          notes: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          base_technology_name?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_examples?: string[] | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          base_technology_name?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_examples?: string[] | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_technology_customizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_technology_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_work_style_customizations: {
        Row: {
          action: string
          created_at: string | null
          custom_impact: number | null
          custom_name: string | null
          id: string
          notes: string | null
          role_id: string
          updated_at: string | null
          work_style_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          custom_impact?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          role_id: string
          updated_at?: string | null
          work_style_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          custom_impact?: number | null
          custom_name?: string | null
          id?: string
          notes?: string | null
          role_id?: string
          updated_at?: string | null
          work_style_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_work_style_customizations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          extracted_jd_data: Json | null
          flsa_status: string | null
          hris_id: string | null
          hris_last_sync: string | null
          hris_provider: string | null
          id: string
          is_frontline: boolean | null
          is_manager: boolean | null
          job_code: string | null
          job_description: string | null
          job_description_source: string | null
          job_description_updated_at: string | null
          job_family: string | null
          level: number | null
          merged_into_role_id: string | null
          name: string
          onet_applied_at: string | null
          onet_code: string | null
          onet_match_confidence: number | null
          organization_id: string
          permission_level: number | null
          permissions: Json | null
          permissions_json: Json | null
          reports_to_role_id: string | null
          source_chunk_id: string | null
          source_entity_id: string | null
          source_file_id: string | null
          standard_role_type_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          extracted_jd_data?: Json | null
          flsa_status?: string | null
          hris_id?: string | null
          hris_last_sync?: string | null
          hris_provider?: string | null
          id?: string
          is_frontline?: boolean | null
          is_manager?: boolean | null
          job_code?: string | null
          job_description?: string | null
          job_description_source?: string | null
          job_description_updated_at?: string | null
          job_family?: string | null
          level?: number | null
          merged_into_role_id?: string | null
          name: string
          onet_applied_at?: string | null
          onet_code?: string | null
          onet_match_confidence?: number | null
          organization_id: string
          permission_level?: number | null
          permissions?: Json | null
          permissions_json?: Json | null
          reports_to_role_id?: string | null
          source_chunk_id?: string | null
          source_entity_id?: string | null
          source_file_id?: string | null
          standard_role_type_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          extracted_jd_data?: Json | null
          flsa_status?: string | null
          hris_id?: string | null
          hris_last_sync?: string | null
          hris_provider?: string | null
          id?: string
          is_frontline?: boolean | null
          is_manager?: boolean | null
          job_code?: string | null
          job_description?: string | null
          job_description_source?: string | null
          job_description_updated_at?: string | null
          job_family?: string | null
          level?: number | null
          merged_into_role_id?: string | null
          name?: string
          onet_applied_at?: string | null
          onet_code?: string | null
          onet_match_confidence?: number | null
          organization_id?: string
          permission_level?: number | null
          permissions?: Json | null
          permissions_json?: Json | null
          reports_to_role_id?: string | null
          source_chunk_id?: string | null
          source_entity_id?: string | null
          source_file_id?: string | null
          standard_role_type_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_merged_into_role_id_fkey"
            columns: ["merged_into_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_reports_to_role_id_fkey"
            columns: ["reports_to_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "extracted_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_standard_role_type_id_fkey"
            columns: ["standard_role_type_id"]
            isOneToOne: false
            referencedRelation: "standard_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_definitions: {
        Row: {
          compliance_domains: string[] | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_license: boolean | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          compliance_domains?: string[] | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_license?: boolean | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          compliance_domains?: string[] | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_license?: boolean | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      source_chunks: {
        Row: {
          char_count: number | null
          chunk_index: number | null
          chunk_reasoning: string | null
          chunk_type: string | null
          content: string
          content_class: string | null
          content_class_confidence: number | null
          content_class_detected_at: string | null
          converted_at: string | null
          converted_track_id: string | null
          created_at: string | null
          display_order: number | null
          duplicate_score: number | null
          duplicate_warning_track_id: string | null
          estimated_read_time_seconds: number | null
          extraction_status: string | null
          hierarchy_level: number | null
          id: string
          is_converted: boolean | null
          is_extractable: boolean | null
          key_terms: string[] | null
          metadata: Json | null
          organization_id: string
          parent_chunk_id: string | null
          published_at: string | null
          published_track_id: string | null
          source_file_id: string
          status: string | null
          suggested_tags: string[] | null
          summary: string | null
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          char_count?: number | null
          chunk_index?: number | null
          chunk_reasoning?: string | null
          chunk_type?: string | null
          content: string
          content_class?: string | null
          content_class_confidence?: number | null
          content_class_detected_at?: string | null
          converted_at?: string | null
          converted_track_id?: string | null
          created_at?: string | null
          display_order?: number | null
          duplicate_score?: number | null
          duplicate_warning_track_id?: string | null
          estimated_read_time_seconds?: number | null
          extraction_status?: string | null
          hierarchy_level?: number | null
          id?: string
          is_converted?: boolean | null
          is_extractable?: boolean | null
          key_terms?: string[] | null
          metadata?: Json | null
          organization_id: string
          parent_chunk_id?: string | null
          published_at?: string | null
          published_track_id?: string | null
          source_file_id: string
          status?: string | null
          suggested_tags?: string[] | null
          summary?: string | null
          title: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          char_count?: number | null
          chunk_index?: number | null
          chunk_reasoning?: string | null
          chunk_type?: string | null
          content?: string
          content_class?: string | null
          content_class_confidence?: number | null
          content_class_detected_at?: string | null
          converted_at?: string | null
          converted_track_id?: string | null
          created_at?: string | null
          display_order?: number | null
          duplicate_score?: number | null
          duplicate_warning_track_id?: string | null
          estimated_read_time_seconds?: number | null
          extraction_status?: string | null
          hierarchy_level?: number | null
          id?: string
          is_converted?: boolean | null
          is_extractable?: boolean | null
          key_terms?: string[] | null
          metadata?: Json | null
          organization_id?: string
          parent_chunk_id?: string | null
          published_at?: string | null
          published_track_id?: string | null
          source_file_id?: string
          status?: string | null
          suggested_tags?: string[] | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_chunks_converted_track_id_fkey"
            columns: ["converted_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_duplicate_warning_track_id_fkey"
            columns: ["duplicate_warning_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_published_track_id_fkey"
            columns: ["published_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      source_files: {
        Row: {
          chunk_count: number | null
          chunked_at: string | null
          created_at: string | null
          detected_entity_count: number | null
          extracted_text: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          has_job_descriptions: boolean | null
          id: string
          is_chunked: boolean | null
          is_processed: boolean | null
          jd_processed: boolean | null
          jd_processed_at: string | null
          jd_processing_error: string | null
          metadata: Json | null
          organization_id: string
          pending_entity_count: number | null
          processed_at: string | null
          processing_error: string | null
          source_type: string | null
          storage_path: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          chunk_count?: number | null
          chunked_at?: string | null
          created_at?: string | null
          detected_entity_count?: number | null
          extracted_text?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          has_job_descriptions?: boolean | null
          id?: string
          is_chunked?: boolean | null
          is_processed?: boolean | null
          jd_processed?: boolean | null
          jd_processed_at?: string | null
          jd_processing_error?: string | null
          metadata?: Json | null
          organization_id: string
          pending_entity_count?: number | null
          processed_at?: string | null
          processing_error?: string | null
          source_type?: string | null
          storage_path: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          chunk_count?: number | null
          chunked_at?: string | null
          created_at?: string | null
          detected_entity_count?: number | null
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          has_job_descriptions?: boolean | null
          id?: string
          is_chunked?: boolean | null
          is_processed?: boolean | null
          jd_processed?: boolean | null
          jd_processed_at?: string | null
          jd_processing_error?: string | null
          metadata?: Json | null
          organization_id?: string
          pending_entity_count?: number | null
          processed_at?: string | null
          processing_error?: string | null
          source_type?: string | null
          storage_path?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          company_id: string | null
          created_at: string | null
          external_source: Json | null
          id: string
          last_updated: string | null
          markdown: string | null
          name: string
          original_format: string | null
          type: string | null
          updated_at: string | null
          uploaded_at: string | null
          version: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          external_source?: Json | null
          id?: string
          last_updated?: string | null
          markdown?: string | null
          name: string
          original_format?: string | null
          type?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          version?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          external_source?: Json | null
          id?: string
          last_updated?: string | null
          markdown?: string | null
          name?: string
          original_format?: string | null
          type?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      standard_role_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_compliance_requirements: {
        Row: {
          created_at: string | null
          id: string
          is_applicable: boolean | null
          override_notes: string | null
          requirement_id: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_applicable?: boolean | null
          override_notes?: string | null
          requirement_id: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_applicable?: boolean | null
          override_notes?: string | null
          requirement_id?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_requirements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "store_compliance_requirements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_requirements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["store_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          address_line_2: string | null
          city: string | null
          code: string | null
          county: string | null
          created_at: string
          district_id: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          manager_id: string | null
          name: string
          organization_id: string
          phone: string | null
          photo_url: string | null
          place_id: string | null
          services_excluded: string[] | null
          services_offered: string[] | null
          state: string | null
          store_email: string | null
          timezone: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          county?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          place_id?: string | null
          services_excluded?: string[] | null
          services_offered?: string[] | null
          state?: string | null
          store_email?: string | null
          timezone?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          county?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          place_id?: string | null
          services_excluded?: string[] | null
          services_offered?: string[] | null
          state?: string | null
          store_email?: string | null
          timezone?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stores_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_system_locked: boolean | null
          name: string
          organization_id: string | null
          parent_id: string | null
          system_category: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system_locked?: boolean | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          system_category?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system_locked?: boolean | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          system_category?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      task_ratings_staging: {
        Row: {
          Category: number | null
          "Data Value": number | null
          Date: string | null
          "Domain Source": string | null
          "Lower CI Bound": number | null
          N: number | null
          "O*NET-SOC Code": string | null
          "Recommend Suppress": string | null
          "Scale ID": string | null
          "Scale Name": string | null
          "Standard Error": number | null
          Task: string | null
          "Task ID": number | null
          Title: string | null
          "Upper CI Bound": number | null
        }
        Insert: {
          Category?: number | null
          "Data Value"?: number | null
          Date?: string | null
          "Domain Source"?: string | null
          "Lower CI Bound"?: number | null
          N?: number | null
          "O*NET-SOC Code"?: string | null
          "Recommend Suppress"?: string | null
          "Scale ID"?: string | null
          "Scale Name"?: string | null
          "Standard Error"?: number | null
          Task?: string | null
          "Task ID"?: number | null
          Title?: string | null
          "Upper CI Bound"?: number | null
        }
        Update: {
          Category?: number | null
          "Data Value"?: number | null
          Date?: string | null
          "Domain Source"?: string | null
          "Lower CI Bound"?: number | null
          N?: number | null
          "O*NET-SOC Code"?: string | null
          "Recommend Suppress"?: string | null
          "Scale ID"?: string | null
          "Scale Name"?: string | null
          "Standard Error"?: number | null
          Task?: string | null
          "Task ID"?: number | null
          Title?: string | null
          "Upper CI Bound"?: number | null
        }
        Relationships: []
      }
      task_statements_staging: {
        Row: {
          Date: string | null
          "Domain Source": string | null
          "Incumbents Responding": number | null
          "O*NET-SOC Code": string | null
          Task: string | null
          "Task ID": number
          "Task Type": string | null
          Title: string | null
        }
        Insert: {
          Date?: string | null
          "Domain Source"?: string | null
          "Incumbents Responding"?: number | null
          "O*NET-SOC Code"?: string | null
          Task?: string | null
          "Task ID": number
          "Task Type"?: string | null
          Title?: string | null
        }
        Update: {
          Date?: string | null
          "Domain Source"?: string | null
          "Incumbents Responding"?: number | null
          "O*NET-SOC Code"?: string | null
          Task?: string | null
          "Task ID"?: number
          "Task Type"?: string | null
          Title?: string | null
        }
        Relationships: []
      }
      tasks_to_dwas: {
        Row: {
          Date: string | null
          "Domain Source": string | null
          "DWA ID": string | null
          "DWA Title": string | null
          "O*NET-SOC Code": string | null
          Task: string | null
          "Task ID": number | null
          Title: string | null
        }
        Insert: {
          Date?: string | null
          "Domain Source"?: string | null
          "DWA ID"?: string | null
          "DWA Title"?: string | null
          "O*NET-SOC Code"?: string | null
          Task?: string | null
          "Task ID"?: number | null
          Title?: string | null
        }
        Update: {
          Date?: string | null
          "Domain Source"?: string | null
          "DWA ID"?: string | null
          "DWA Title"?: string | null
          "O*NET-SOC Code"?: string | null
          Task?: string | null
          "Task ID"?: number | null
          Title?: string | null
        }
        Relationships: []
      }
      track_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          storage_path: string
          track_id: string
          url: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path: string
          track_id: string
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path?: string
          track_id?: string
          url?: string
        }
        Relationships: []
      }
      track_completions: {
        Row: {
          attempts: number | null
          completed_at: string
          completed_via_album_id: string | null
          completed_via_assignment_id: string | null
          completed_via_playlist_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          passed: boolean | null
          score: number | null
          status: string
          time_spent_minutes: number | null
          track_id: string
          track_version_number: number
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string
          completed_via_album_id?: string | null
          completed_via_assignment_id?: string | null
          completed_via_playlist_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          passed?: boolean | null
          score?: number | null
          status?: string
          time_spent_minutes?: number | null
          track_id: string
          track_version_number: number
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string
          completed_via_album_id?: string | null
          completed_via_assignment_id?: string | null
          completed_via_playlist_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          passed?: boolean | null
          score?: number | null
          status?: string
          time_spent_minutes?: number | null
          track_id?: string
          track_version_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_completions_completed_via_album_id_fkey"
            columns: ["completed_via_album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_completions_completed_via_assignment_id_fkey"
            columns: ["completed_via_assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_completions_completed_via_playlist_id_fkey"
            columns: ["completed_via_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_completions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      track_relationships: {
        Row: {
          created_at: string | null
          derived_track_id: string
          id: string
          organization_id: string
          relationship_type: string
          source_track_id: string
          variant_context: Json | null
          variant_type: string | null
        }
        Insert: {
          created_at?: string | null
          derived_track_id: string
          id?: string
          organization_id: string
          relationship_type: string
          source_track_id: string
          variant_context?: Json | null
          variant_type?: string | null
        }
        Update: {
          created_at?: string | null
          derived_track_id?: string
          id?: string
          organization_id?: string
          relationship_type?: string
          source_track_id?: string
          variant_context?: Json | null
          variant_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_relationships_derived_track_id_fkey"
            columns: ["derived_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_relationships_source_track_id_fkey"
            columns: ["source_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_source_chunks: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          sequence_order: number | null
          source_chunk_id: string
          track_id: string
          usage_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          sequence_order?: number | null
          source_chunk_id: string
          track_id: string
          usage_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          sequence_order?: number | null
          source_chunk_id?: string
          track_id?: string
          usage_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_source_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_source_chunks_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_source_chunks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_scopes: {
        Row: {
          id: string
          track_id: string
          organization_id: string
          scope_level: string
          sector: string | null
          industry_id: string | null
          state_id: string | null
          company_id: string | null
          program_id: string | null
          unit_id: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          track_id: string
          organization_id: string
          scope_level: string
          sector?: string | null
          industry_id?: string | null
          state_id?: string | null
          company_id?: string | null
          program_id?: string | null
          unit_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          track_id?: string
          organization_id?: string
          scope_level?: string
          sector?: string | null
          industry_id?: string | null
          state_id?: string | null
          company_id?: string | null
          program_id?: string | null
          unit_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_scopes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "us_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_scopes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      track_tags: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          track_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          track_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_tags_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          content_text: string | null
          content_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          facts_content_hash: string | null
          facts_generated_at: string | null
          generated_from_chunks: boolean | null
          id: string
          is_demo_content: boolean | null
          is_latest_version: boolean | null
          is_system_content: boolean
          kb_qr_downloaded_count: number | null
          kb_qr_enabled: boolean | null
          kb_qr_location: string | null
          kb_slug: string | null
          learning_objectives: string[] | null
          likes_count: number | null
          max_attempts: number | null
          media_transcript_id: string | null
          organization_id: string
          parent_track_id: string | null
          passing_score: number | null
          published_at: string | null
          published_by: string | null
          show_in_knowledge_base: boolean | null
          source_file_id: string | null
          state_approvals: Json | null
          status: string | null
          summary: string | null
          thumbnail_url: string | null
          thumbnail_user_set: boolean | null
          title: string
          transcript: string | null
          transcript_data: Json | null
          tts_audio_url: string | null
          tts_content_hash: string | null
          tts_generated_at: string | null
          tts_voice: string | null
          type: string
          updated_at: string
          version: string | null
          version_notes: string | null
          version_number: number | null
          view_count: number | null
        }
        Insert: {
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          facts_content_hash?: string | null
          facts_generated_at?: string | null
          generated_from_chunks?: boolean | null
          id?: string
          is_demo_content?: boolean | null
          is_latest_version?: boolean | null
          is_system_content?: boolean
          kb_qr_downloaded_count?: number | null
          kb_qr_enabled?: boolean | null
          kb_qr_location?: string | null
          kb_slug?: string | null
          learning_objectives?: string[] | null
          likes_count?: number | null
          max_attempts?: number | null
          media_transcript_id?: string | null
          organization_id: string
          parent_track_id?: string | null
          passing_score?: number | null
          published_at?: string | null
          published_by?: string | null
          show_in_knowledge_base?: boolean | null
          source_file_id?: string | null
          state_approvals?: Json | null
          status?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          thumbnail_user_set?: boolean | null
          title: string
          transcript?: string | null
          transcript_data?: Json | null
          tts_audio_url?: string | null
          tts_content_hash?: string | null
          tts_generated_at?: string | null
          tts_voice?: string | null
          type: string
          updated_at?: string
          version?: string | null
          version_notes?: string | null
          version_number?: number | null
          view_count?: number | null
        }
        Update: {
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          facts_content_hash?: string | null
          facts_generated_at?: string | null
          generated_from_chunks?: boolean | null
          id?: string
          is_demo_content?: boolean | null
          is_latest_version?: boolean | null
          is_system_content?: boolean
          kb_qr_downloaded_count?: number | null
          kb_qr_enabled?: boolean | null
          kb_qr_location?: string | null
          kb_slug?: string | null
          learning_objectives?: string[] | null
          likes_count?: number | null
          max_attempts?: number | null
          media_transcript_id?: string | null
          organization_id?: string
          parent_track_id?: string | null
          passing_score?: number | null
          published_at?: string | null
          published_by?: string | null
          show_in_knowledge_base?: boolean | null
          source_file_id?: string | null
          state_approvals?: Json | null
          status?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          thumbnail_user_set?: boolean | null
          title?: string
          transcript?: string | null
          transcript_data?: Json | null
          tts_audio_url?: string | null
          tts_content_hash?: string | null
          tts_generated_at?: string | null
          tts_voice?: string | null
          type?: string
          updated_at?: string
          version?: string | null
          version_notes?: string | null
          version_number?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_media_transcript_id_fkey"
            columns: ["media_transcript_id"]
            isOneToOne: false
            referencedRelation: "media_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_parent_track_id_fkey"
            columns: ["parent_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      trike_relevant_occupations: {
        Row: {
          category: string | null
          created_at: string | null
          onet_code: string
          relevance_tier: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          onet_code: string
          relevance_tier?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          onet_code?: string
          relevance_tier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trike_relevant_occupations_onet_code_fkey"
            columns: ["onet_code"]
            isOneToOne: true
            referencedRelation: "onet_occupations"
            referencedColumns: ["onet_code"]
          },
        ]
      }
      unit_tags: {
        Row: {
          created_at: string | null
          id: string
          store_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          store_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          store_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "unit_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      user_certifications: {
        Row: {
          certificate_number: string | null
          certificate_url: string | null
          certification_id: string
          created_at: string
          expires_at: string | null
          external_provider_id: string | null
          id: string
          import_batch_id: string | null
          issued_at: string
          issued_by: string | null
          organization_id: string
          requirement_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          source_type: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          certificate_url?: string | null
          certification_id: string
          created_at?: string
          expires_at?: string | null
          external_provider_id?: string | null
          id?: string
          import_batch_id?: string | null
          issued_at?: string
          issued_by?: string | null
          organization_id: string
          requirement_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          certificate_url?: string | null
          certification_id?: string
          created_at?: string
          expires_at?: string | null
          external_provider_id?: string | null
          id?: string
          import_batch_id?: string | null
          issued_at?: string
          issued_by?: string | null
          organization_id?: string
          requirement_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "user_certifications_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          answers: Json | null
          assignment_id: string | null
          attempts: number | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          passed: boolean | null
          progress_percent: number | null
          score: number | null
          started_at: string | null
          status: string | null
          time_spent_minutes: number | null
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          assignment_id?: string | null
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          passed?: boolean | null
          progress_percent?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          assignment_id?: string | null
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          passed?: boolean | null
          progress_percent?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      us_states: {
        Row: {
          id: string
          code: string
          name: string
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          employee_id: string | null
          first_name: string
          hire_date: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          last_name: string
          metadata: Json | null
          organization_id: string
          phone: string | null
          pin: string | null
          pin_set_at: string | null
          role_id: string | null
          status: string | null
          store_id: string | null
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          employee_id?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          last_name: string
          metadata?: Json | null
          organization_id: string
          phone?: string | null
          pin?: string | null
          pin_set_at?: string | null
          role_id?: string | null
          status?: string | null
          store_id?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          employee_id?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          last_name?: string
          metadata?: Json | null
          organization_id?: string
          phone?: string | null
          pin?: string | null
          pin_set_at?: string | null
          role_id?: string | null
          status?: string | null
          store_id?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_applicable_requirements"
            referencedColumns: ["store_id"]
          },
        ]
      }
      variant_change_notes: {
        Row: {
          affected_range_end: number
          affected_range_start: number
          anchor_matches: string[]
          citations: Json
          created_at: string
          description: string
          draft_id: string
          id: string
          key_fact_ids: string[]
          mapped_action: string
          organization_id: string
          status: string
          title: string
        }
        Insert: {
          affected_range_end: number
          affected_range_start: number
          anchor_matches?: string[]
          citations?: Json
          created_at?: string
          description: string
          draft_id: string
          id: string
          key_fact_ids?: string[]
          mapped_action: string
          organization_id: string
          status: string
          title: string
        }
        Update: {
          affected_range_end?: number
          affected_range_start?: number
          anchor_matches?: string[]
          citations?: Json
          created_at?: string
          description?: string
          draft_id?: string
          id?: string
          key_fact_ids?: string[]
          mapped_action?: string
          organization_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_change_notes_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "variant_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_change_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_draft_history: {
        Row: {
          applied_key_fact_ids: string[]
          blocked_changes: Json | null
          change_notes: Json
          created_at: string
          diff_ops: Json
          draft_id: string
          id: string
          instruction: string
          new_content: string
          organization_id: string
          previous_content: string
        }
        Insert: {
          applied_key_fact_ids?: string[]
          blocked_changes?: Json | null
          change_notes?: Json
          created_at?: string
          diff_ops?: Json
          draft_id: string
          id?: string
          instruction: string
          new_content: string
          organization_id: string
          previous_content: string
        }
        Update: {
          applied_key_fact_ids?: string[]
          blocked_changes?: Json | null
          change_notes?: Json
          created_at?: string
          diff_ops?: Json
          draft_id?: string
          id?: string
          instruction?: string
          new_content?: string
          organization_id?: string
          previous_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_draft_history_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "variant_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_draft_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_drafts: {
        Row: {
          applied_key_fact_ids: string[]
          blocked_reasons: string[] | null
          contract_id: string | null
          created_at: string
          diff_ops: Json
          draft_content: string
          draft_title: string
          extraction_id: string | null
          id: string
          needs_review_key_fact_ids: string[]
          organization_id: string
          source_track_id: string | null
          state_code: string
          state_name: string | null
          status: string
          track_type: string
          updated_at: string
        }
        Insert: {
          applied_key_fact_ids?: string[]
          blocked_reasons?: string[] | null
          contract_id?: string | null
          created_at?: string
          diff_ops?: Json
          draft_content: string
          draft_title: string
          extraction_id?: string | null
          id?: string
          needs_review_key_fact_ids?: string[]
          organization_id: string
          source_track_id?: string | null
          state_code: string
          state_name?: string | null
          status: string
          track_type: string
          updated_at?: string
        }
        Update: {
          applied_key_fact_ids?: string[]
          blocked_reasons?: string[] | null
          contract_id?: string | null
          created_at?: string
          diff_ops?: Json
          draft_content?: string
          draft_title?: string
          extraction_id?: string | null
          id?: string
          needs_review_key_fact_ids?: string[]
          organization_id?: string
          source_track_id?: string | null
          state_code?: string
          state_name?: string | null
          status?: string
          track_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_drafts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "variant_scope_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_drafts_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "variant_key_facts_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_drafts_source_track_id_fkey"
            columns: ["source_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_key_facts: {
        Row: {
          anchor_hits: string[]
          citations: Json
          created_at: string
          extraction_id: string
          fact_text: string
          id: string
          is_strong_claim: boolean
          mapped_action: string
          organization_id: string
          qa_flags: string[]
          qa_status: string
        }
        Insert: {
          anchor_hits?: string[]
          citations?: Json
          created_at?: string
          extraction_id: string
          fact_text: string
          id?: string
          is_strong_claim?: boolean
          mapped_action: string
          organization_id: string
          qa_flags?: string[]
          qa_status: string
        }
        Update: {
          anchor_hits?: string[]
          citations?: Json
          created_at?: string
          extraction_id?: string
          fact_text?: string
          id?: string
          is_strong_claim?: boolean
          mapped_action?: string
          organization_id?: string
          qa_flags?: string[]
          qa_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_key_facts_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "variant_key_facts_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_key_facts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_key_facts_extractions: {
        Row: {
          contract_id: string | null
          created_at: string
          extraction_method: string
          gate_results: Json
          id: string
          key_facts_count: number
          organization_id: string
          overall_status: string
          plan_id: string | null
          raw_llm_response: string | null
          rejected_facts_count: number
          state_code: string
          state_name: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          extraction_method: string
          gate_results?: Json
          id?: string
          key_facts_count?: number
          organization_id: string
          overall_status: string
          plan_id?: string | null
          raw_llm_response?: string | null
          rejected_facts_count?: number
          state_code: string
          state_name?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          extraction_method?: string
          gate_results?: Json
          id?: string
          key_facts_count?: number
          organization_id?: string
          overall_status?: string
          plan_id?: string | null
          raw_llm_response?: string | null
          rejected_facts_count?: number
          state_code?: string
          state_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variant_key_facts_extractions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "variant_scope_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_key_facts_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_key_facts_extractions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "variant_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_rejected_facts: {
        Row: {
          created_at: string
          extraction_id: string
          fact_text: string
          failed_gates: string[]
          id: string
          organization_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          extraction_id: string
          fact_text: string
          failed_gates?: string[]
          id?: string
          organization_id: string
          reason: string
        }
        Update: {
          created_at?: string
          extraction_id?: string
          fact_text?: string
          failed_gates?: string[]
          id?: string
          organization_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_rejected_facts_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "variant_key_facts_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_rejected_facts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_research_plans: {
        Row: {
          contract_id: string | null
          created_at: string
          id: string
          organization_id: string
          research_plan: Json
          state_code: string
          state_name: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          research_plan: Json
          state_code: string
          state_name?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          research_plan?: Json
          state_code?: string
          state_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_research_plans_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "variant_scope_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_research_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_retrieval_results: {
        Row: {
          contract_id: string | null
          created_at: string
          evidence_count: number
          id: string
          organization_id: string
          plan_id: string
          rejected_count: number
          retrieval_output: Json
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          evidence_count?: number
          id?: string
          organization_id: string
          plan_id: string
          rejected_count?: number
          retrieval_output: Json
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          evidence_count?: number
          id?: string
          organization_id?: string
          plan_id?: string
          rejected_count?: number
          retrieval_output?: Json
        }
        Relationships: [
          {
            foreignKeyName: "variant_retrieval_results_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "variant_scope_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_retrieval_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_retrieval_results_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "variant_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_scope_contracts: {
        Row: {
          created_at: string
          extraction_method: string
          id: string
          organization_id: string
          raw_llm_response: string | null
          role_selection_needed: boolean
          scope_contract: Json
          source_track_id: string
          top_role_matches: Json | null
          updated_at: string
          validation_errors: string[] | null
          variant_context: Json
          variant_type: string
        }
        Insert: {
          created_at?: string
          extraction_method: string
          id?: string
          organization_id: string
          raw_llm_response?: string | null
          role_selection_needed?: boolean
          scope_contract: Json
          source_track_id: string
          top_role_matches?: Json | null
          updated_at?: string
          validation_errors?: string[] | null
          variant_context?: Json
          variant_type: string
        }
        Update: {
          created_at?: string
          extraction_method?: string
          id?: string
          organization_id?: string
          raw_llm_response?: string | null
          role_selection_needed?: boolean
          scope_contract?: Json
          source_track_id?: string
          top_role_matches?: Json | null
          updated_at?: string
          validation_errors?: string[] | null
          variant_context?: Json
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_scope_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_scope_contracts_source_track_id_fkey"
            columns: ["source_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      facts_needing_review: {
        Row: {
          change_history: Json | null
          company_id: string | null
          conflict_count: number | null
          content: string | null
          context: Json | null
          created_at: string | null
          effectiveness: number | null
          external_source: Json | null
          extracted_by: string | null
          extraction_confidence: number | null
          id: string | null
          last_verified: string | null
          needs_review: boolean | null
          prerequisite_facts: Json | null
          related_facts: Json | null
          source_id: string | null
          source_page: number | null
          source_section: string | null
          steps: Json | null
          superseded_by: string | null
          supersedes: Json | null
          title: string | null
          type: string | null
          updated_at: string | null
          verified_by: string | null
          version: number | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_with_usage: {
        Row: {
          change_history: Json | null
          company_id: string | null
          content: string | null
          context: Json | null
          created_at: string | null
          effectiveness: number | null
          external_source: Json | null
          extracted_by: string | null
          extraction_confidence: number | null
          id: string | null
          last_verified: string | null
          needs_review: boolean | null
          prerequisite_facts: Json | null
          related_facts: Json | null
          source_id: string | null
          source_page: number | null
          source_section: string | null
          steps: Json | null
          superseded_by: string | null
          supersedes: Json | null
          title: string | null
          type: string | null
          updated_at: string | null
          usage_count: number | null
          verified_by: string | null
          version: number | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_needing_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "facts_with_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_summary: {
        Row: {
          avg_probability: number | null
          deal_count: number | null
          stage: string | null
          total_mrr: number | null
          total_value: number | null
          weighted_value: number | null
        }
        Relationships: []
      }
      v_store_applicable_requirements: {
        Row: {
          course_name: string | null
          days_to_complete: number | null
          ee_training_required: string | null
          is_applicable: boolean | null
          law_code_reference: string | null
          organization_id: string | null
          override_notes: string | null
          recertification_years: number | null
          requirement_id: string | null
          requirement_name: string | null
          store_id: string | null
          store_name: string | null
          store_state: string | null
          topic_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_waterfall_due_days: {
        Args: {
          p_base_due_days: number
          p_release_schedule: Json
          p_release_type: string
        }
        Returns: number
      }
      compare_trigger_rules_impact: {
        Args: { p_new_trigger_rules: Json; p_playlist_id: string }
        Returns: {
          current_status: string
          email: string
          first_name: string
          last_name: string
          population: string
          progress_percent: number
          role_name: string
          user_id: string
        }[]
      }
      count_users_matching_trigger_rules: {
        Args: { p_organization_id: string; p_trigger_rules: Json }
        Returns: number
      }
      create_onboarding_assignments: {
        Args: { p_user_id: string }
        Returns: number
      }
      create_playlist_auto_assignments: {
        Args: { p_user_id: string }
        Returns: number
      }
      find_duplicate_roles: {
        Args: { p_org_id: string; p_threshold?: number }
        Returns: {
          potential_match_id: string
          potential_match_name: string
          role_id: string
          role_name: string
          similarity_score: number
        }[]
      }
      generate_pin: { Args: never; Returns: string }
      get_applicable_requirements: {
        Args: { p_user_id: string }
        Returns: {
          days_to_complete: number
          has_valid_cert: boolean
          playlist_id: string
          recertification_years: number
          requirement_id: string
          requirement_name: string
          source: string
          state_code: string
          topic_name: string
        }[]
      }
      get_entity_lineage: {
        Args: { p_entity_id: string }
        Returns: {
          chunk_index: number
          chunk_title: string
          entity_id: string
          entity_status: string
          entity_type: string
          extracted_data: Json
          extraction_confidence: number
          file_name: string
          linked_entity_id: string
          linked_entity_type: string
          source_chunk_id: string
          source_file_id: string
        }[]
      }
      get_matching_auto_playlists: {
        Args: { p_user_id: string }
        Returns: {
          playlist_id: string
          playlist_title: string
          trigger_rules: Json
        }[]
      }
      get_org_qr_enabled_tracks: {
        Args: { org_id: string }
        Returns: {
          kb_qr_downloaded_count: number
          kb_qr_location: string
          kb_slug: string
          show_in_knowledge_base: boolean
          status: string
          title: string
          track_id: string
        }[]
      }
      get_pending_certification_uploads_count: {
        Args: { p_org_id: string }
        Returns: number
      }
      get_playbook_with_details: {
        Args: { p_playbook_id: string }
        Returns: {
          album_id: string
          chunk_content: string
          chunk_id: string
          chunk_index: number
          chunk_sequence_order: number
          chunk_title: string
          playbook_id: string
          playbook_status: string
          playbook_title: string
          source_file_id: string
          source_file_name: string
          track_display_order: number
          track_has_conflicts: boolean
          track_id: string
          track_rag_confidence: number
          track_rag_reasoning: string
          track_status: string
          track_title: string
        }[]
      }
      get_playlist_assignment_history: {
        Args: { p_limit?: number; p_playlist_id: string }
        Returns: {
          assigned_at: string
          assignment_id: string
          completed_at: string
          email: string
          first_name: string
          hire_date: string
          last_name: string
          progress_percent: number
          role_name: string
          status: string
          store_name: string
          user_id: string
        }[]
      }
      get_role_abilities: {
        Args: { p_role_id: string }
        Returns: {
          ability_id: string
          category: string
          customization_id: string
          importance: number
          is_active: boolean
          level: number
          name: string
          notes: string
          source: string
        }[]
      }
      get_role_knowledge: {
        Args: { p_role_id: string }
        Returns: {
          customization_id: string
          description: string
          importance: number
          is_active: boolean
          knowledge_id: string
          knowledge_name: string
          notes: string
          source: string
        }[]
      }
      get_role_skills: {
        Args: { p_role_id: string }
        Returns: {
          customization_id: string
          description: string
          importance: number
          is_active: boolean
          notes: string
          skill_id: string
          skill_name: string
          source: string
        }[]
      }
      get_role_tasks: {
        Args: { p_role_id: string }
        Returns: {
          customization_id: string
          description: string
          dwas: Json
          importance: number
          is_active: boolean
          notes: string
          relevance: number
          source: string
          task_id: string
        }[]
      }
      get_role_work_styles: {
        Args: { p_role_id: string }
        Returns: {
          customization_id: string
          distinctiveness_rank: number
          impact: number
          is_active: boolean
          name: string
          notes: string
          source: string
          work_style_id: string
        }[]
      }
      get_roles_from_source_file: {
        Args: { p_source_file_id: string }
        Returns: {
          entity_id: string
          entity_status: string
          extraction_confidence: number
          link_action: string
          linked_at: string
          role_id: string
          role_name: string
        }[]
      }
      get_user_by_pin: {
        Args: { org_id: string; pin_input: string }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          organization_id: string
          role_id: string
          status: string
          store_id: string
        }[]
      }
      get_user_compliance_requirements: {
        Args: { p_user_id: string }
        Returns: {
          days_to_complete: number
          ee_training_required: string
          is_from_role: boolean
          is_from_store: boolean
          recertification_years: number
          requirement_id: string
          requirement_name: string
          state_code: string
          topic_name: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_users_matching_trigger_rules: {
        Args: { p_organization_id: string; p_trigger_rules: Json }
        Returns: {
          email: string
          first_name: string
          hire_date: string
          last_name: string
          role_name: string
          store_name: string
          user_id: string
        }[]
      }
      handle_location_transfer: {
        Args: {
          p_new_store_id: string
          p_old_store_id: string
          p_user_id: string
        }
        Returns: Json
      }
      has_valid_certification: {
        Args: { p_requirement_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_track_likes: { Args: { track_id: string }; Returns: undefined }
      increment_track_views: { Args: { track_id: string }; Returns: undefined }
      is_user_admin: { Args: never; Returns: boolean }
      is_user_district_manager_or_admin: { Args: never; Returns: boolean }
      lock_album: {
        Args: { p_album_id: string; p_change_notes?: string }
        Returns: {
          album_id: string
          change_notes: string | null
          created_at: string | null
          created_by: string | null
          id: string
          track_ids: string[]
          track_order: Json | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "album_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      match_brain_embeddings: {
        Args: {
          match_count?: number
          match_threshold?: number
          org_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_type: string
          id: string
          is_system_template: boolean
          metadata: Json
          similarity: number
        }[]
      }
      match_embeddings: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_organization_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content_text: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      merge_roles: {
        Args: {
          p_merged_by?: string
          p_reason?: string
          p_source_role_id: string
          p_target_role_id: string
        }
        Returns: Json
      }
      search_onet_occupations: {
        Args: { match_limit?: number; search_term: string }
        Returns: {
          also_called: string[]
          description: string
          match_percentage: number
          match_score: number
          onet_code: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_source_file_entity_counts: {
        Args: { p_source_file_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
