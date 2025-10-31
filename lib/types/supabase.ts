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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_chat_history: {
        Row: {
          ai_response: string
          analysis_type: string | null
          created_at: string | null
          id: string
          message_count: number | null
          model_used: string | null
          room_id: string
          structured_data: Json | null
          token_count: number | null
          updated_at: string | null
          user_id: string
          user_query: string
        }
        Insert: {
          ai_response: string
          analysis_type?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          model_used?: string | null
          room_id: string
          structured_data?: Json | null
          token_count?: number | null
          updated_at?: string | null
          user_id: string
          user_query: string
        }
        Update: {
          ai_response?: string
          analysis_type?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          model_used?: string | null
          room_id?: string
          structured_data?: Json | null
          token_count?: number | null
          updated_at?: string | null
          user_id?: string
          user_query?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_chats: {
        Row: {
          created_at: string | null
          id: string
          initiator_id: string
          interest_status: string | null
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          initiator_id: string
          interest_status?: string | null
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string | null
          id?: string
          initiator_id?: string
          interest_status?: string | null
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_chats_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_chats_user_id_1_fkey"
            columns: ["user_id_1"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_chats_user_id_2_fkey"
            columns: ["user_id_2"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          direct_chat_id: string | null
          dm_thread_id: string | null
          id: string
          is_edited: boolean
          room_id: string | null
          sender_id: string
          status: string | null
          text: string
        }
        Insert: {
          created_at?: string
          direct_chat_id?: string | null
          dm_thread_id?: string | null
          id?: string
          is_edited?: boolean
          room_id?: string | null
          sender_id?: string
          status?: string | null
          text: string
        }
        Update: {
          created_at?: string
          direct_chat_id?: string | null
          dm_thread_id?: string | null
          id?: string
          is_edited?: boolean
          room_id?: string | null
          sender_id?: string
          status?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_direct_chat_id_fkey"
            columns: ["direct_chat_id"]
            isOneToOne: false
            referencedRelation: "direct_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_display_names"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          direct_chat_id: string | null
          id: string
          join_status: string | null
          message: string
          room_id: string | null
          sender_id: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          direct_chat_id?: string | null
          id?: string
          join_status?: string | null
          message: string
          room_id?: string | null
          sender_id?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          direct_chat_id?: string | null
          id?: string
          join_status?: string | null
          message?: string
          room_id?: string | null
          sender_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_direct_chat_id_fkey"
            columns: ["direct_chat_id"]
            isOneToOne: false
            referencedRelation: "direct_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_display_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_display_names"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      room_members: {
        Row: {
          active: boolean | null
          joined_at: string | null
          room_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          joined_at?: string | null
          room_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          joined_at?: string | null
          room_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          active: boolean | null
          created_at: string | null
          joined_at: string
          room_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          joined_at?: string
          room_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          joined_at?: string
          room_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_private: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          name?: string
        }
        Relationships: []
      }
      typing_status: {
        Row: {
          is_typing: boolean | null
          room_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          is_typing?: boolean | null
          room_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          is_typing?: boolean | null
          room_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_status_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string
          created_at: string
          display_name: string
          id: string
          username: string
        }
        Insert: {
          avatar_url: string
          created_at?: string
          display_name: string
          id?: string
          username?: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          display_name?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_display_names: {
        Row: {
          display_name: string | null
          display_text: string | null
          id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_notification: {
        Args: { p_notification_id: string; p_target_user_id: string }
        Returns: undefined
      }
      batch_mark_messages_read: {
        Args: { p_message_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      create_room_with_member: {
        Args: {
          p_is_private: boolean
          p_name: string
          p_timestamp: string
          p_user_id: string
        }
        Returns: {
          id: string
        }[]
      }
      get_room_user_counts: {
        Args: never
        Returns: {
          room_id: string
          user_count: number
        }[]
      }
      get_rooms_with_counts:
        | {
            Args: { p_query?: string; p_user_id: string }
            Returns: {
              created_at: string
              created_by: string
              id: string
              is_member: boolean
              is_private: boolean
              member_count: number
              name: string
            }[]
          }
        | {
            Args: { user_id: string }
            Returns: {
              created_at: string
              created_by: string
              id: string
              is_member: boolean
              is_private: boolean
              member_count: number
              name: string
              participation_status: string
            }[]
          }
      get_typing_users: {
        Args: { p_room_id: string; p_stale_threshold?: unknown }
        Returns: {
          is_typing: boolean
          updated_at: string
          user_id: string
        }[]
      }
      handle_notification_action: {
        Args: {
          p_action: string
          p_notification_id: string
          p_room_id?: string
          p_sender_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      handle_room_join_request: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      join_room: {
        Args: { p_room_id: string; p_status?: string; p_user_id: string }
        Returns: undefined
      }
      leave_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      reject_notification: {
        Args: {
          p_notification_id: string
          p_room_id: string
          p_sender_id: string
        }
        Returns: undefined
      }
      send_message_with_notify: {
        Args: {
          p_direct_chat_id: string
          p_room_id: string
          p_text: string
          p_user_id: string
        }
        Returns: Json
      }
      switch_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      transfer_room_ownership: {
        Args: {
          p_current_owner_id: string
          p_new_owner_id: string
          p_room_id: string
        }
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
