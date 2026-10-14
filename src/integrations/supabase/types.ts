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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          articles_per_day: number
          autopilot: boolean
          created_at: string
          formatting_rules: string
          id: string
          last_error: string | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          persona: string
          seed_keywords: string
          site_id: string | null
          target_length: number
          tone: string
          writing_style: string
        }
        Insert: {
          articles_per_day?: number
          autopilot?: boolean
          created_at?: string
          formatting_rules?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          persona?: string
          seed_keywords?: string
          site_id?: string | null
          target_length?: number
          tone?: string
          writing_style?: string
        }
        Update: {
          articles_per_day?: number
          autopilot?: boolean
          created_at?: string
          formatting_rules?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          persona?: string
          seed_keywords?: string
          site_id?: string | null
          target_length?: number
          tone?: string
          writing_style?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          agent_id: string | null
          auto_generated: boolean
          citations: Json
          content_markdown: string
          cover_image_prompt: string
          created_at: string
          excerpt: string
          id: string
          keywords: string
          last_error: string | null
          meta_description: string
          published_at: string | null
          scheduled_at: string | null
          seo_report: Json
          seo_score: number | null
          seo_title: string
          site_id: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_generated?: boolean
          citations?: Json
          content_markdown?: string
          cover_image_prompt?: string
          created_at?: string
          excerpt?: string
          id?: string
          keywords?: string
          last_error?: string | null
          meta_description?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_report?: Json
          seo_score?: number | null
          seo_title?: string
          site_id?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          topic?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_generated?: boolean
          citations?: Json
          content_markdown?: string
          cover_image_prompt?: string
          created_at?: string
          excerpt?: string
          id?: string
          keywords?: string
          last_error?: string | null
          meta_description?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_report?: Json
          seo_score?: number | null
          seo_title?: string
          site_id?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_lock: {
        Row: {
          id: number
          locked_until: string
        }
        Insert: {
          id: number
          locked_until?: string
        }
        Update: {
          id?: number
          locked_until?: string
        }
        Relationships: []
      }
      google_rules: {
        Row: {
          changes_summary: string
          id: number
          last_checked_at: string | null
          last_error: string | null
          next_check_at: string
          rules_text: string
          sources: Json
          updated_at: string
        }
        Insert: {
          changes_summary?: string
          id: number
          last_checked_at?: string | null
          last_error?: string | null
          next_check_at?: string
          rules_text?: string
          sources?: Json
          updated_at?: string
        }
        Update: {
          changes_summary?: string
          id?: number
          last_checked_at?: string | null
          last_error?: string | null
          next_check_at?: string
          rules_text?: string
          sources?: Json
          updated_at?: string
        }
        Relationships: []
      }
      publish_logs: {
        Row: {
          article_id: string | null
          created_at: string
          http_status: number | null
          id: string
          message: string
          site_id: string | null
          success: boolean
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          message?: string
          site_id?: string | null
          success: boolean
        }
        Update: {
          article_id?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          message?: string
          site_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "publish_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          api_key: string
          created_at: string
          default_author: string
          default_category: string
          endpoint_url: string
          id: string
          name: string
          url: string
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          api_key?: string
          created_at?: string
          default_author?: string
          default_category?: string
          endpoint_url?: string
          id?: string
          name: string
          url?: string
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          api_key?: string
          created_at?: string
          default_author?: string
          default_category?: string
          endpoint_url?: string
          id?: string
          name?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
