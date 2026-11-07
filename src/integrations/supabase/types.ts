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
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean | null
          organization_id: string
          created_at: string
          description: string | null
          fields: Json | null
          id: string
          submit_target: string | null
          title: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          id?: string
          submit_target?: string | null
          title: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          id?: string
          submit_target?: string | null
          title?: string
        }
        Relationships: []
      }
      intents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: string | null
          proposer_name: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          proposer_name?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          proposer_name?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          author: string | null
          content: string | null
          created_at: string
          id: string
          image: string | null
          perex: string | null
          pinned: boolean | null
          published_at: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image?: string | null
          perex?: string | null
          pinned?: boolean | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image?: string | null
          perex?: string | null
          pinned?: boolean | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          id: number
          organization_id: string
          request_id: string
          actor_user_id: string | null
          event_type: string
          from_status: string | null
          to_status: string | null
          note: string | null
          internal: boolean
          details: Json
          occurred_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          organization_id: string
          number: number
          author_user_id: string
          type: string
          title: string
          description: string
          location: string | null
          asset_ref: string | null
          visibility: string
          workflow_status: string
          triage_priority: string | null
          assignee_user_id: string | null
          due_on: string | null
          resolution_text: string | null
          duplicate_of: string | null
          created_at: string
          updated_at: string
          row_version: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      my_context: { Args: Record<string, never>; Returns: Json }
      create_invitation: { Args: { p_organization_id: string; p_email: string; p_role?: string; p_valid_days?: number }; Returns: Json }
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      set_membership_status: { Args: { p_membership_id: string; p_status: string; p_expected_row_version: number }; Returns: number }
      grant_role: { Args: { p_membership_id: string; p_role: string }; Returns: string }
      revoke_role: { Args: { p_role_id: string }; Returns: undefined }
      grant_scope: { Args: { p_membership_id: string; p_scope: string; p_permission: string }; Returns: string }
      revoke_scope: { Args: { p_grant_id: string }; Returns: undefined }
      list_members: { Args: { p_organization_id: string }; Returns: Json }
      submit_intent: { Args: { p_organization_id: string; p_title: string; p_description: string; p_proposer_name: string | null }; Returns: string }
      change_intent_status: { Args: { p_intent_id: string; p_status: string; p_expected_row_version: number }; Returns: number }
      create_request: { Args: { p_organization_id: string; p_type: string; p_title: string; p_description: string; p_location?: string | null; p_asset_ref?: string | null; p_idempotency_key?: string | null }; Returns: Json }
      add_request_comment: { Args: { p_request_id: string; p_body: string; p_internal?: boolean }; Returns: number }
      request_reopen: { Args: { p_request_id: string; p_reason: string; p_expected_row_version: number }; Returns: number }
      change_request_status: { Args: { p_request_id: string; p_to: string; p_expected_row_version: number; p_note?: string | null; p_assignee?: string | null; p_due_on?: string | null; p_resolution?: string | null; p_duplicate_of?: string | null; p_priority?: string | null }; Returns: number }
      request_people: { Args: { p_request_ids: string[] }; Returns: { user_id: string; display_name: string | null }[] }
      submit_form: { Args: { p_form_id: string; p_data: Json }; Returns: string }
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
