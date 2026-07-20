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
      appointments: {
        Row: {
          ai_context_summary: string | null
          clinic_id: string
          created_at: string
          department: string
          id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          symptom_category: string | null
          updated_at: string
          visit_summary: string | null
          worker_id: string
          worker_notes: string | null
        }
        Insert: {
          ai_context_summary?: string | null
          clinic_id: string
          created_at?: string
          department: string
          id?: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          symptom_category?: string | null
          updated_at?: string
          visit_summary?: string | null
          worker_id: string
          worker_notes?: string | null
        }
        Update: {
          ai_context_summary?: string | null
          clinic_id?: string
          created_at?: string
          department?: string
          id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          symptom_category?: string | null
          updated_at?: string
          visit_summary?: string | null
          worker_id?: string
          worker_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attached_document_id: string | null
          content: string
          created_at: string
          flagged_for_human_review: boolean
          id: string
          role: Database["public"]["Enums"]["chat_role"]
          worker_id: string
        }
        Insert: {
          attached_document_id?: string | null
          content: string
          created_at?: string
          flagged_for_human_review?: boolean
          id?: string
          role: Database["public"]["Enums"]["chat_role"]
          worker_id: string
        }
        Update: {
          attached_document_id?: string | null
          content?: string
          created_at?: string
          flagged_for_human_review?: boolean
          id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_attached_document_id_fkey"
            columns: ["attached_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limits: {
        Row: {
          count: number
          window_start: string
          worker_id: string
        }
        Insert: {
          count?: number
          window_start?: string
          worker_id: string
        }
        Update: {
          count?: number
          window_start?: string
          worker_id?: string
        }
        Relationships: []
      }
      clinic_slots: {
        Row: {
          booked: number
          capacity: number
          clinic_id: string
          created_at: string
          department: string
          id: string
          slot_at: string
        }
        Insert: {
          booked?: number
          capacity?: number
          clinic_id: string
          created_at?: string
          department: string
          id?: string
          slot_at: string
        }
        Update: {
          booked?: number
          capacity?: number
          clinic_id?: string
          created_at?: string
          department?: string
          id?: string
          slot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          departments: string[]
          id: string
          languages_supported_onsite: string[]
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          departments?: string[]
          id?: string
          languages_supported_onsite?: string[]
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          departments?: string[]
          id?: string
          languages_supported_onsite?: string[]
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_plain_language_summary: string | null
          ai_summary_json: Json | null
          appointment_id: string | null
          created_at: string
          flagged_for_human_review: boolean
          id: string
          original_file_url: string | null
          original_language_detected: string | null
          original_text: string | null
          type: Database["public"]["Enums"]["document_type"]
          worker_id: string
        }
        Insert: {
          ai_plain_language_summary?: string | null
          ai_summary_json?: Json | null
          appointment_id?: string | null
          created_at?: string
          flagged_for_human_review?: boolean
          id?: string
          original_file_url?: string | null
          original_language_detected?: string | null
          original_text?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          worker_id: string
        }
        Update: {
          ai_plain_language_summary?: string | null
          ai_summary_json?: Json | null
          appointment_id?: string | null
          created_at?: string
          flagged_for_human_review?: boolean
          id?: string
          original_file_url?: string | null
          original_language_detected?: string | null
          original_text?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: {
          company_name: string
          contact_email: string | null
          created_at: string
          id: string
          industry: string | null
          invite_code: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          worker_count: number
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          invite_code?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          worker_count?: number
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          invite_code?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          worker_count?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          content: string
          created_at: string
          employer_id: string | null
          id: string
          read_at: string | null
          sent_at: string
          title: string | null
          type: Database["public"]["Enums"]["notification_type"]
          worker_id: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          content: string
          created_at?: string
          employer_id?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string
          title?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          worker_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          content?: string
          created_at?: string
          employer_id?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_compliance_stats"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "notifications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clinic_id: string | null
          consent_accepted_at: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          employer_id: string | null
          full_name: string | null
          id: string
          notification_prefs: Json
          phone_number: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employer_id?: string | null
          full_name?: string | null
          id: string
          notification_prefs?: Json
          phone_number?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employer_id?: string | null
          full_name?: string | null
          id?: string
          notification_prefs?: Json
          phone_number?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_compliance_stats"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "profiles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_requests: {
        Row: {
          clinic_id: string | null
          company_name: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinic_id: string | null
          created_at: string
          employer_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_compliance_stats"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "user_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employer_compliance_stats: {
        Row: {
          checkups_completed: number | null
          employer_id: string | null
          no_show_rate_pct: number | null
          no_shows: number | null
          workers_enrolled: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_clinic_id: { Args: never; Returns: string }
      current_employer_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purge_old_documents: { Args: never; Returns: undefined }
      request_privileged_role: {
        Args: { _clinic_id: string; _company_name: string; _role: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "worker"
        | "employer_admin"
        | "clinic_staff"
        | "super_admin"
        | "pharmacy_staff"
        | "insurance_staff"
        | "platform_admin"
      appointment_status: "booked" | "completed" | "no_show" | "cancelled"
      chat_role: "user" | "assistant"
      document_type:
        | "prescription"
        | "lab_report"
        | "visit_summary"
        | "insurance_form"
        | "other"
      language_code: "ar" | "en" | "hi" | "ur" | "ne" | "tl" | "bn"
      notification_channel: "push" | "sms" | "whatsapp" | "in_app"
      notification_type:
        | "appointment_reminder"
        | "medication_reminder"
        | "health_advisory"
        | "general"
      subscription_tier: "pilot" | "standard" | "enterprise"
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
      app_role: [
        "worker",
        "employer_admin",
        "clinic_staff",
        "super_admin",
        "pharmacy_staff",
        "insurance_staff",
        "platform_admin",
      ],
      appointment_status: ["booked", "completed", "no_show", "cancelled"],
      chat_role: ["user", "assistant"],
      document_type: [
        "prescription",
        "lab_report",
        "visit_summary",
        "insurance_form",
        "other",
      ],
      language_code: ["ar", "en", "hi", "ur", "ne", "tl", "bn"],
      notification_channel: ["push", "sms", "whatsapp", "in_app"],
      notification_type: [
        "appointment_reminder",
        "medication_reminder",
        "health_advisory",
        "general",
      ],
      subscription_tier: ["pilot", "standard", "enterprise"],
    },
  },
} as const
