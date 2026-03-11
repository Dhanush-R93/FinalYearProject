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
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          language: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          language?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          audio_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      commodities: {
        Row: {
          category: string
          created_at: string
          icon: string | null
          id: string
          name: string
          name_hi: string | null
          name_ta: string | null
          name_te: string | null
          unit: string
        }
        Insert: {
          category: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          name_hi?: string | null
          name_ta?: string | null
          name_te?: string | null
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          name_hi?: string | null
          name_ta?: string | null
          name_te?: string | null
          unit?: string
        }
        Relationships: []
      }
      mandi_arbitrage: {
        Row: {
          calculated_at: string
          commodity_id: string
          destination_mandi: string
          destination_price: number
          distance_km: number | null
          id: string
          price_difference: number
          profit_potential: number | null
          source_mandi: string
          source_price: number
          transport_cost_estimate: number | null
        }
        Insert: {
          calculated_at?: string
          commodity_id: string
          destination_mandi: string
          destination_price: number
          distance_km?: number | null
          id?: string
          price_difference: number
          profit_potential?: number | null
          source_mandi: string
          source_price: number
          transport_cost_estimate?: number | null
        }
        Update: {
          calculated_at?: string
          commodity_id?: string
          destination_mandi?: string
          destination_price?: number
          distance_km?: number | null
          id?: string
          price_difference?: number
          profit_potential?: number | null
          source_mandi?: string
          source_price?: number
          transport_cost_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mandi_arbitrage_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      market_news: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          published_at: string
          source: string | null
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string | null
          title?: string
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          commodity_id: string
          created_at: string
          description: string | null
          harvest_date: string | null
          id: string
          images: string[] | null
          is_available: boolean | null
          location: string
          price_per_unit: number
          quality_grade: string | null
          quantity: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          commodity_id: string
          created_at?: string
          description?: string | null
          harvest_date?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean | null
          location: string
          price_per_unit: number
          quality_grade?: string | null
          quantity: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          commodity_id?: string
          created_at?: string
          description?: string | null
          harvest_date?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean | null
          location?: string
          price_per_unit?: number
          quality_grade?: string | null
          quantity?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          commodity_id: string
          confidence_score: number | null
          created_at: string
          id: string
          model_version: string | null
          predicted_price: number
          prediction_date: string
          prediction_horizon: string | null
        }
        Insert: {
          commodity_id: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          model_version?: string | null
          predicted_price: number
          prediction_date: string
          prediction_horizon?: string | null
        }
        Update: {
          commodity_id?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          model_version?: string | null
          predicted_price?: number
          prediction_date?: string
          prediction_horizon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          alert_type: string
          commodity_id: string
          created_at: string
          id: string
          is_active: boolean | null
          threshold_price: number
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          commodity_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          threshold_price: number
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          commodity_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          threshold_price?: number
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      price_data: {
        Row: {
          commodity_id: string
          id: string
          mandi_location: string | null
          mandi_name: string
          price: number
          recorded_at: string
          source: string | null
          state: string | null
        }
        Insert: {
          commodity_id: string
          id?: string
          mandi_location?: string | null
          mandi_name: string
          price: number
          recorded_at?: string
          source?: string | null
          state?: string | null
        }
        Update: {
          commodity_id?: string
          id?: string
          mandi_location?: string | null
          mandi_name?: string
          price?: number
          recorded_at?: string
          source?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_data_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          preferred_language: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "farmer"
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
      app_role: ["admin", "moderator", "farmer"],
    },
  },
} as const
