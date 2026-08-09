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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          room_code: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          room_code?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          room_code?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      claim_locks: {
        Row: {
          claim_window: number
          created_at: string
          game_id: string
          id: string
          player_seat: number
          room_id: string
        }
        Insert: {
          claim_window: number
          created_at?: string
          game_id: string
          id?: string
          player_seat: number
          room_id: string
        }
        Update: {
          claim_window?: number
          created_at?: string
          game_id?: string
          id?: string
          player_seat?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_locks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_events: {
        Row: {
          created_at: string
          event: string
          id: string
          props: Json | null
          puzzle_number: number | null
          referrer: string | null
          utm_source: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          props?: Json | null
          puzzle_number?: number | null
          referrer?: string | null
          utm_source?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          props?: Json | null
          puzzle_number?: number | null
          referrer?: string | null
          utm_source?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      daily_results: {
        Row: {
          created_at: string
          elapsed_ms: number
          email: string | null
          id: string
          peek_used: boolean
          puzzle_date: string
          puzzle_number: number
          round_events: Json
          rounds_solved: number
          total_misses: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          elapsed_ms?: number
          email?: string | null
          id?: string
          peek_used?: boolean
          puzzle_date: string
          puzzle_number: number
          round_events?: Json
          rounds_solved?: number
          total_misses?: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          elapsed_ms?: number
          email?: string | null
          id?: string
          peek_used?: boolean
          puzzle_date?: string
          puzzle_number?: number
          round_events?: Json
          rounds_solved?: number
          total_misses?: number
          visitor_id?: string
        }
        Relationships: []
      }
      daily_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          synced_to_ac: boolean
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
          synced_to_ac?: boolean
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          synced_to_ac?: boolean
          visitor_id?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          host_visitor_id: string
          id: string
          last_active_at: string
          room_code: string
          status: string
        }
        Insert: {
          created_at?: string
          host_visitor_id: string
          id?: string
          last_active_at?: string
          room_code: string
          status?: string
        }
        Update: {
          created_at?: string
          host_visitor_id?: string
          id?: string
          last_active_at?: string
          room_code?: string
          status?: string
        }
        Relationships: []
      }
      write_limits: {
        Row: {
          bucket: string
          count: number
          created_at: string
          day: string
          key: string
          updated_at: string
        }
        Insert: {
          bucket: string
          count?: number
          created_at?: string
          day: string
          key: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          count?: number
          created_at?: string
          day?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_attribution: {
        Args: { p_from: string; p_to: string }
        Returns: {
          kind: string
          source: string
          visitors: number
        }[]
      }
      admin_difficulty: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_misses: number
          failed: number
          round: number
          solve_rate: number
          solved: number
        }[]
      }
      admin_export_subscribers: {
        Args: never
        Returns: {
          created_at: string
          email: string
          source: string
          synced_to_ac: boolean
        }[]
      }
      admin_funnel: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ready_viewed: number
          run_abandoned: number
          run_finished: number
          run_started: number
          shared: number
          subscribed: number
        }[]
      }
      admin_headline: {
        Args: { p_from: string; p_to: string }
        Returns: {
          d7_eligible: number
          d7_pct: number
          dau_avg: number
          dau_today: number
          returning_eligible: number
          returning_pct: number
          runs_finished: number
          share_rate: number
          shares: number
          subscribers: number
          total_players: number
        }[]
      }
      admin_howto: {
        Args: { p_from: string; p_to: string }
        Returns: {
          finished: number
          opened: number
          skip_count: number
          skip_slide: number
          skipped: number
        }[]
      }
      admin_subscribers: {
        Args: never
        Returns: {
          source: string
          synced: number
          total: number
        }[]
      }
      admin_trend: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          results_saved: number
          runs_finished: number
          runs_started: number
        }[]
      }
      create_room: {
        Args: { p_code: string; p_visitor_id: string }
        Returns: {
          id: string
          is_host: boolean
          room_code: string
          status: string
        }[]
      }
      daily_result_reject_reason: {
        Args: {
          p_elapsed_ms: number
          p_puzzle_date: string
          p_puzzle_number: number
          p_round_events: Json
          p_rounds_solved: number
          p_today?: string
          p_total_misses: number
        }
        Returns: string
      }
      daily_rows_for: {
        Args: { p_email: string; p_visitor_id: string }
        Returns: {
          elapsed_ms: number
          puzzle_number: number
          rounds_solved: number
          total_misses: number
        }[]
      }
      email_has_history: { Args: { p_email: string }; Returns: boolean }
      get_daily_event_counts: {
        Args: { p_days?: number }
        Returns: {
          day: string
          event: string
          events: number
          visitors: number
        }[]
      }
      get_daily_percentile: {
        Args: {
          p_email?: string
          p_puzzle_number: number
          p_visitor_id: string
        }
        Returns: number
      }
      get_daily_results: {
        Args: { p_visitor_id: string }
        Returns: {
          created_at: string
          elapsed_ms: number
          peek_used: boolean
          puzzle_date: string
          puzzle_number: number
          round_events: Json
          rounds_solved: number
          total_misses: number
        }[]
      }
      get_daily_stats: {
        Args: { p_email?: string; p_visitor_id: string }
        Returns: {
          avg_misses: number
          best_streak: number
          clean_runs: number
          total_played: number
        }[]
      }
      get_room_by_code: {
        Args: { p_code: string; p_visitor_id: string }
        Returns: {
          id: string
          is_host: boolean
          room_code: string
          status: string
        }[]
      }
      get_streak: {
        Args: {
          p_current_puzzle_number: number
          p_email?: string
          p_visitor_id: string
        }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      get_subscriber_email: { Args: { p_visitor_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      log_daily_events: {
        Args: { p_events: Json; p_visitor_id: string }
        Returns: number
      }
      request_ip: { Args: never; Returns: string }
      rl_hit: {
        Args: { p_bucket: string; p_key: string; p_max: number }
        Returns: boolean
      }
      save_daily_result: {
        Args: {
          p_elapsed_ms: number
          p_email?: string
          p_peek_used: boolean
          p_puzzle_date: string
          p_puzzle_number: number
          p_round_events: Json
          p_rounds_solved: number
          p_total_misses: number
          p_visitor_id: string
        }
        Returns: boolean
      }
      subscribe_daily:
        | { Args: { p_email: string; p_visitor_id?: string }; Returns: boolean }
        | {
            Args: { p_email: string; p_source: string; p_visitor_id: string }
            Returns: boolean
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
