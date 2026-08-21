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
      ai_daily_tips: {
        Row: {
          created_at: string
          day_name: string
          id: string
          plan_id: string
          tip_text: string
        }
        Insert: {
          created_at?: string
          day_name: string
          id?: string
          plan_id: string
          tip_text: string
        }
        Update: {
          created_at?: string
          day_name?: string
          id?: string
          plan_id?: string
          tip_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_daily_tips_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plans: {
        Row: {
          ai_model: string | null
          created_at: string
          generation_version: number
          id: string
          is_active: boolean
          plan_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          created_at?: string
          generation_version?: number
          id?: string
          is_active?: boolean
          plan_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          created_at?: string
          generation_version?: number
          id?: string
          is_active?: boolean
          plan_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          biggest_challenge: string | null
          created_at: string | null
          goal_type: string | null
          id: string
          meal_preference: string | null
          preferred_time: string | null
          target_weight: number | null
          user_id: string | null
          workout_days: number | null
          workout_duration: string | null
          workout_preference: string | null
        }
        Insert: {
          biggest_challenge?: string | null
          created_at?: string | null
          goal_type?: string | null
          id?: string
          meal_preference?: string | null
          preferred_time?: string | null
          target_weight?: number | null
          user_id?: string | null
          workout_days?: number | null
          workout_duration?: string | null
          workout_preference?: string | null
        }
        Update: {
          biggest_challenge?: string | null
          created_at?: string | null
          goal_type?: string | null
          id?: string
          meal_preference?: string | null
          preferred_time?: string | null
          target_weight?: number | null
          user_id?: string | null
          workout_days?: number | null
          workout_duration?: string | null
          workout_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_completions: {
        Row: {
          completed_on: string
          created_at: string
          id: string
          meal_item_id: string
          user_id: string
        }
        Insert: {
          completed_on?: string
          created_at?: string
          id?: string
          meal_item_id: string
          user_id: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          id?: string
          meal_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_completions_meal_item_id_fkey"
            columns: ["meal_item_id"]
            isOneToOne: false
            referencedRelation: "meal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_days: {
        Row: {
          carbohydrates: number | null
          created_at: string
          day_name: string
          fats: number | null
          id: string
          plan_id: string
          protein: number | null
          total_calories: number | null
        }
        Insert: {
          carbohydrates?: number | null
          created_at?: string
          day_name: string
          fats?: number | null
          id?: string
          plan_id: string
          protein?: number | null
          total_calories?: number | null
        }
        Update: {
          carbohydrates?: number | null
          created_at?: string
          day_name?: string
          fats?: number | null
          id?: string
          plan_id?: string
          protein?: number | null
          total_calories?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number | null
          carbohydrates: number | null
          created_at: string
          fats: number | null
          id: string
          image_path: string | null
          image_prompt: string | null
          image_status: string
          ingredients: string[]
          meal_day_id: string
          meal_name: string
          meal_order: number
          meal_type: string | null
          notes: string | null
          preparation_steps: string[]
          protein: number | null
          scheduled_time: string | null
        }
        Insert: {
          calories?: number | null
          carbohydrates?: number | null
          created_at?: string
          fats?: number | null
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          image_status?: string
          ingredients?: string[]
          meal_day_id: string
          meal_name: string
          meal_order?: number
          meal_type?: string | null
          notes?: string | null
          preparation_steps?: string[]
          protein?: number | null
          scheduled_time?: string | null
        }
        Update: {
          calories?: number | null
          carbohydrates?: number | null
          created_at?: string
          fats?: number | null
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          image_status?: string
          ingredients?: string[]
          meal_day_id?: string
          meal_name?: string
          meal_order?: number
          meal_type?: string | null
          notes?: string | null
          preparation_steps?: string[]
          protein?: number | null
          scheduled_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_meal_day_id_fkey"
            columns: ["meal_day_id"]
            isOneToOne: false
            referencedRelation: "meal_days"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          id: string
          plan: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plan?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          created_at: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          height: number | null
          id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          weight?: number | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          created_at: string | null
          current_weight: number | null
          id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_weight?: number | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_weight?: number | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          body_fat: number | null
          created_at: string
          id: string
          logged_at: string
          muscle_mass: number | null
          notes: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          body_fat?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          muscle_mass?: number | null
          notes?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          body_fat?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          muscle_mass?: number | null
          notes?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          schedule_json: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          schedule_json?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          schedule_json?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_completions: {
        Row: {
          completed_at: string
          completed_on: string
          completion_percentage: number
          created_at: string
          exercise_id: string | null
          id: string
          user_id: string
          workout_day_id: string
        }
        Insert: {
          completed_at?: string
          completed_on?: string
          completion_percentage?: number
          created_at?: string
          exercise_id?: string | null
          id?: string
          user_id: string
          workout_day_id: string
        }
        Update: {
          completed_at?: string
          completed_on?: string
          completion_percentage?: number
          created_at?: string
          exercise_id?: string | null
          id?: string
          user_id?: string
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_completions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_completions_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          created_at: string
          day_name: string
          duration_minutes: number | null
          estimated_calories: number | null
          id: string
          notes: string | null
          plan_id: string
          scheduled_end: string | null
          scheduled_start: string | null
          workout_title: string | null
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          day_name: string
          duration_minutes?: number | null
          estimated_calories?: number | null
          id?: string
          notes?: string | null
          plan_id: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          workout_title?: string | null
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          day_name?: string
          duration_minutes?: number | null
          estimated_calories?: number | null
          id?: string
          notes?: string | null
          plan_id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          workout_title?: string | null
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          duration_seconds: number | null
          exercise_name: string
          exercise_order: number
          id: string
          notes: string | null
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          workout_day_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          exercise_name: string
          exercise_order?: number
          id?: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          workout_day_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          exercise_name?: string
          exercise_order?: number
          id?: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string | null
          id: string
          plan: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plan?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_ai_plan: { Args: { _plan_id: string }; Returns: boolean }
      owns_meal_day: { Args: { _day_id: string }; Returns: boolean }
      owns_workout_day: { Args: { _day_id: string }; Returns: boolean }
      save_ai_plan: { Args: { _plan: Json }; Returns: string }
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
