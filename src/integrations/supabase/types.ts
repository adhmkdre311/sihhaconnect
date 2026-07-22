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
      insurer_employer_scope: {
        Row: {
          employer_id: string
          insurer_id: string
        }
        Insert: {
          employer_id: string
          insurer_id: string
        }
        Update: {
          employer_id?: string
          insurer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_employer_scope_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_compliance_stats"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "insurer_employer_scope_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_employer_scope_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "insurer_employer_aggregates"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "insurer_employer_scope_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          created_at: string
          form: string | null
          generic_name: string | null
          id: string
          name: string
          strength: string | null
        }
        Insert: {
          created_at?: string
          form?: string | null
          generic_name?: string | null
          id?: string
          name: string
          strength?: string | null
        }
        Update: {
          created_at?: string
          form?: string | null
          generic_name?: string | null
          id?: string
          name?: string
          strength?: string | null
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
          {
            foreignKeyName: "notifications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "insurer_employer_aggregates"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          area: string | null
          created_at: string
          hours: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_lookups: {
        Row: {
          area: string | null
          created_at: string
          id: string
          medication_id: string | null
          pharmacy_id: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          medication_id?: string | null
          pharmacy_id?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          medication_id?: string | null
          pharmacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_lookups_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_lookups_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_stock: {
        Row: {
          in_stock: boolean
          medication_id: string
          pharmacy_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          in_stock?: boolean
          medication_id: string
          pharmacy_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          in_stock?: boolean
          medication_id?: string
          pharmacy_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_stock_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_stock_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          clinic_id: string | null
          consent_accepted_at: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          employer_id: string | null
          full_name: string | null
          id: string
          insurer_id: string | null
          is_active: boolean
          notification_prefs: Json
          pharmacy_id: string | null
          phone_number: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          push_token: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          clinic_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employer_id?: string | null
          full_name?: string | null
          id: string
          insurer_id?: string | null
          is_active?: boolean
          notification_prefs?: Json
          pharmacy_id?: string | null
          phone_number?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          push_token?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          clinic_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          employer_id?: string | null
          full_name?: string | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean
          notification_prefs?: Json
          pharmacy_id?: string | null
          phone_number?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          push_token?: string | null
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
          {
            foreignKeyName: "profiles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "insurer_employer_aggregates"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      role_requests: {
        Row: {
          clinic_id: string | null
          company_name: string | null
          created_at: string
          id: string
          insurer_id: string | null
          pharmacy_id: string | null
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
          insurer_id?: string | null
          pharmacy_id?: string | null
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
          insurer_id?: string | null
          pharmacy_id?: string | null
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
          {
            foreignKeyName: "role_requests_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_requests_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
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
          insurer_id: string | null
          pharmacy_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          insurer_id?: string | null
          pharmacy_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          insurer_id?: string | null
          pharmacy_id?: string | null
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
          {
            foreignKeyName: "user_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "insurer_employer_aggregates"
            referencedColumns: ["employer_id"]
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
      insurer_employer_aggregates: {
        Row: {
          appointments_total: number | null
          checkups_completed: number | null
          company_name: string | null
          employer_id: string | null
          insurer_id: string | null
          no_shows: number | null
          workers_enrolled: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insurer_employer_scope_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: { _uid: string }; Returns: boolean }
      my_clinic_id: { Args: never; Returns: string }
      my_employer_id: { Args: never; Returns: string }
      my_insurance_company_id: { Args: never; Returns: string }
      my_pharmacy_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      profile_in_my_employer: { Args: { _profile: string }; Returns: boolean }
      purge_old_documents: { Args: never; Returns: undefined }
      request_privileged_role: {
        Args: { _clinic_id: string; _company_name: string; _role: string }
        Returns: string
      }
      send_broadcast: {
        Args: {
          _audience?: string
          _body: string
          _category?: string
          _title: string
        }
        Returns: number
      }
      worker_has_appointment_at_clinic: {
        Args: { _worker: string }
        Returns: boolean
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
