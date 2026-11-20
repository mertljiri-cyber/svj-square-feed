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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          details: Json
          id: number
          object_id: string | null
          object_type: string
          occurred_at: string
          organization_id: string | null
          tx_id: number
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          details?: Json
          id?: never
          object_id?: string | null
          object_type: string
          occurred_at?: string
          organization_id?: string | null
          tx_id?: number
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          details?: Json
          id?: never
          object_id?: string | null
          object_type?: string
          occurred_at?: string
          organization_id?: string | null
          tx_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_grants: {
        Row: {
          document_id: string
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string
          permission: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          document_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          permission: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          document_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          permission?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_grants_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      document_versions: {
        Row: {
          bytes: number
          created_at: string
          document_id: string
          failure_reason: string | null
          id: string
          mime_type: string
          object_key: string
          organization_id: string
          original_filename: string
          ready_at: string | null
          sha256: string
          upload_status: string
          uploaded_by: string | null
          version_no: number
        }
        Insert: {
          bytes: number
          created_at?: string
          document_id: string
          failure_reason?: string | null
          id?: string
          mime_type: string
          object_key: string
          organization_id: string
          original_filename: string
          ready_at?: string | null
          sha256: string
          upload_status?: string
          uploaded_by?: string | null
          version_no: number
        }
        Update: {
          bytes?: number
          created_at?: string
          document_id?: string
          failure_reason?: string | null
          id?: string
          mime_type?: string
          object_key?: string
          organization_id?: string
          original_filename?: string
          ready_at?: string | null
          sha256?: string
          upload_status?: string
          uploaded_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          id: string
          lifecycle: string
          organization_id: string
          period_from: string | null
          period_to: string | null
          row_version: number
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          lifecycle?: string
          organization_id: string
          period_from?: string | null
          period_to?: string | null
          row_version?: number
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          lifecycle?: string
          organization_id?: string
          period_from?: string | null
          period_to?: string | null
          row_version?: number
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_current_version_fk"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["document_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_id: string | null
          id: string
          organization_id: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
          organization_id: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
          organization_id?: string
          submitted_by?: string | null
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
            foreignKeyName: "form_submissions_form_same_org_fk"
            columns: ["organization_id", "form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "form_submissions_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          fields: Json
          id: string
          organization_id: string
          submit_target: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          organization_id: string
          submit_target?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          organization_id?: string
          submit_target?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_events: {
        Row: {
          actor_user_id: string | null
          details: Json
          event_type: string
          from_status: string | null
          id: number
          intent_id: string
          note: string | null
          occurred_at: string
          organization_id: string
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          details?: Json
          event_type: string
          from_status?: string | null
          id?: never
          intent_id: string
          note?: string | null
          occurred_at?: string
          organization_id: string
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          details?: Json
          event_type?: string
          from_status?: string | null
          id?: never
          intent_id?: string
          note?: string | null
          occurred_at?: string
          organization_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intent_events_organization_id_intent_id_fkey"
            columns: ["organization_id", "intent_id"]
            isOneToOne: false
            referencedRelation: "intents"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      intents: {
        Row: {
          created_at: string
          created_by: string | null
          decision_note: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          location: string | null
          organization_id: string
          planned_year: number | null
          priority: string
          proposer_name: string | null
          row_version: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          location?: string | null
          organization_id: string
          planned_year?: number | null
          priority?: string
          proposer_name?: string | null
          row_version?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          location?: string | null
          organization_id?: string
          planned_year?: number | null
          priority?: string
          proposer_name?: string | null
          row_version?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          membership_id: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_organization_id_membership_id_fkey"
            columns: ["organization_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          invitation_id: string | null
          organization_id: string
          row_version: number
          status: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          organization_id: string
          row_version?: number
          status?: string
          updated_at?: string
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          organization_id?: string
          row_version?: number
          status?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invitation_fk"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          image: string | null
          organization_id: string
          perex: string | null
          pinned: boolean | null
          published_at: string | null
          row_version: number
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image?: string | null
          organization_id: string
          perex?: string | null
          pinned?: boolean | null
          published_at?: string | null
          row_version?: number
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image?: string | null
          organization_id?: string
          perex?: string | null
          pinned?: boolean | null
          published_at?: string | null
          row_version?: number
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          channel: string
          created_at: string
          event_id: number | null
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          organization_id: string
          provider_message_id: string | null
          recipient_user_id: string
          request_id: string
          retry_count: number
          sent_at: string | null
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_id?: number | null
          id?: string
          idempotency_key: string
          kind: string
          last_error?: string | null
          organization_id: string
          provider_message_id?: string | null
          recipient_user_id: string
          request_id: string
          retry_count?: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: number | null
          id?: string
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          organization_id?: string
          provider_message_id?: string | null
          recipient_user_id?: string
          request_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "request_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_counters: {
        Row: {
          last_number: number
          organization_id: string
        }
        Insert: {
          last_number?: number
          organization_id: string
        }
        Update: {
          last_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_user_id: string | null
          details: Json
          event_type: string
          from_status: string | null
          id: number
          internal: boolean
          note: string | null
          occurred_at: string
          organization_id: string
          request_id: string
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          details?: Json
          event_type: string
          from_status?: string | null
          id?: never
          internal?: boolean
          note?: string | null
          occurred_at?: string
          organization_id: string
          request_id: string
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          details?: Json
          event_type?: string
          from_status?: string | null
          id?: never
          internal?: boolean
          note?: string | null
          occurred_at?: string
          organization_id?: string
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      request_evidence: {
        Row: {
          document_id: string
          linked_at: string
          organization_id: string
          request_id: string
          version_id: string
        }
        Insert: {
          document_id: string
          linked_at?: string
          organization_id: string
          request_id: string
          version_id: string
        }
        Update: {
          document_id?: string
          linked_at?: string
          organization_id?: string
          request_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_evidence_document_id_version_id_fkey"
            columns: ["document_id", "version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["document_id", "id"]
          },
          {
            foreignKeyName: "request_evidence_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_evidence_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      requests: {
        Row: {
          asset_ref: string | null
          assignee_user_id: string | null
          author_user_id: string
          created_at: string
          description: string
          due_on: string | null
          duplicate_of: string | null
          id: string
          idempotency_key: string | null
          location: string | null
          number: number
          organization_id: string
          resolution_text: string | null
          row_version: number
          title: string
          triage_priority: string | null
          type: string
          updated_at: string
          visibility: string
          workflow_status: string
        }
        Insert: {
          asset_ref?: string | null
          assignee_user_id?: string | null
          author_user_id: string
          created_at?: string
          description: string
          due_on?: string | null
          duplicate_of?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          number: number
          organization_id: string
          resolution_text?: string | null
          row_version?: number
          title: string
          triage_priority?: string | null
          type: string
          updated_at?: string
          visibility?: string
          workflow_status?: string
        }
        Update: {
          asset_ref?: string | null
          assignee_user_id?: string | null
          author_user_id?: string
          created_at?: string
          description?: string
          due_on?: string | null
          duplicate_of?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          number?: number
          organization_id?: string
          resolution_text?: string | null
          row_version?: number
          title?: string
          triage_priority?: string | null
          type?: string
          updated_at?: string
          visibility?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_organization_id_duplicate_of_fkey"
            columns: ["organization_id", "duplicate_of"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scoped_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          membership_id: string
          organization_id: string
          permission: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id: string
          organization_id: string
          permission: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id?: string
          organization_id?: string
          permission?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoped_grants_organization_id_membership_id_fkey"
            columns: ["organization_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          is_public: boolean
          key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          is_public?: boolean
          key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          is_public?: boolean
          key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_excerpts: {
        Row: {
          approved_at: string | null
          body: string
          document_id: string
          id: string
          note_key: string
          organization_id: string
          page: number
          source_revision: string
          version_id: string
        }
        Insert: {
          approved_at?: string | null
          body: string
          document_id: string
          id?: string
          note_key: string
          organization_id: string
          page: number
          source_revision: string
          version_id: string
        }
        Update: {
          approved_at?: string | null
          body?: string
          document_id?: string
          id?: string
          note_key?: string
          organization_id?: string
          page?: number
          source_revision?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_excerpts_document_id_version_id_fkey"
            columns: ["document_id", "version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["document_id", "id"]
          },
          {
            foreignKeyName: "wiki_excerpts_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      wiki_markdown_revisions: {
        Row: {
          content_sha256: string
          imported_at: string
          note_key: string
          object_key: string | null
          organization_id: string
        }
        Insert: {
          content_sha256: string
          imported_at?: string
          note_key: string
          object_key?: string | null
          organization_id: string
        }
        Update: {
          content_sha256?: string
          imported_at?: string
          note_key?: string
          object_key?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_markdown_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_house_markdown: { Args: { p_org: string; p_key: string; p_title: string; p_markdown: string }; Returns: string }
      withdraw_house_markdown: { Args: { p_org: string; p_key: string }; Returns: undefined }
      read_house_markdown: { Args: { p_org: string; p_terms: string[]; p_ids?: string[] }; Returns: Json }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      add_intent_comment: {
        Args: { p_body: string; p_intent_id: string }
        Returns: number
      }
      add_request_comment: {
        Args: { p_body: string; p_internal?: boolean; p_request_id: string }
        Returns: number
      }
      attach_request_evidence: {
        Args: { p_request_id: string; p_version_id: string }
        Returns: undefined
      }
      authorize_download: { Args: { p_version_id: string }; Returns: Json }
      begin_upload: {
        Args: {
          p_bytes: number
          p_document_id: string
          p_filename: string
          p_mime: string
          p_sha256: string
        }
        Returns: Json
      }
      change_intent_status: {
        Args: {
          p_decision_note?: string
          p_expected_row_version: number
          p_intent_id: string
          p_status: string
        }
        Returns: number
      }
      change_request_status: {
        Args: {
          p_assignee?: string
          p_due_on?: string
          p_duplicate_of?: string
          p_expected_row_version: number
          p_note?: string
          p_priority?: string
          p_request_id: string
          p_resolution?: string
          p_to: string
        }
        Returns: number
      }
      complete_upload: { Args: { p_version_id: string }; Returns: Json }
      consume_house_question: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      create_document: {
        Args: {
          p_category: string
          p_organization_id: string
          p_period_from: string
          p_period_to: string
          p_title: string
          p_visibility: string
        }
        Returns: string
      }
      create_invitation: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role?: string
          p_valid_days?: number
        }
        Returns: Json
      }
      create_request: {
        Args: {
          p_asset_ref?: string
          p_description: string
          p_idempotency_key?: string
          p_location?: string
          p_organization_id: string
          p_title: string
          p_type: string
        }
        Returns: Json
      }
      grant_document_access: {
        Args: { p_document_id: string; p_permission: string; p_user_id: string }
        Returns: string
      }
      grant_role: {
        Args: { p_membership_id: string; p_role: string }
        Returns: string
      }
      grant_scope: {
        Args: { p_membership_id: string; p_permission: string; p_scope: string }
        Returns: string
      }
      intent_people: {
        Args: { p_intent_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      list_members: {
        Args: { p_organization_id: string }
        Returns: {
          approved_at: string
          created_at: string
          display_name: string
          email: string
          grants: Json
          membership_id: string
          roles: Json
          row_version: number
          status: string
          user_id: string
        }[]
      }
      my_context: { Args: never; Returns: Json }
      publish_version: {
        Args: {
          p_document_id: string
          p_expected_row_version: number
          p_version_id: string
        }
        Returns: number
      }
      request_people: {
        Args: { p_request_ids: string[] }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      request_reopen: {
        Args: {
          p_expected_row_version: number
          p_reason: string
          p_request_id: string
        }
        Returns: number
      }
      revoke_document_access: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      revoke_role: { Args: { p_role_id: string }; Returns: undefined }
      revoke_scope: { Args: { p_grant_id: string }; Returns: undefined }
      search_house_terms: {
        Args: { p_organization_id: string; p_terms: string[] }
        Returns: Json
      }
      search_wiki_sources: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: Json
      }
      set_document_lifecycle: {
        Args: {
          p_document_id: string
          p_expected_row_version: number
          p_to: string
        }
        Returns: number
      }
      set_membership_status: {
        Args: {
          p_expected_row_version: number
          p_membership_id: string
          p_status: string
        }
        Returns: number
      }
      submit_form: {
        Args: { p_data: Json; p_form_id: string }
        Returns: string
      }
      submit_intent: {
        Args: {
          p_description: string
          p_organization_id: string
          p_proposer_name: string
          p_title: string
        }
        Returns: string
      }
      update_document: {
        Args: {
          p_category: string
          p_document_id: string
          p_expected_row_version: number
          p_period_from: string
          p_period_to: string
          p_title: string
          p_visibility: string
        }
        Returns: number
      }
      update_intent: {
        Args: {
          p_description: string
          p_estimated_cost: number
          p_expected_row_version: number
          p_intent_id: string
          p_location: string
          p_planned_year: number
          p_priority: string
          p_title: string
        }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
