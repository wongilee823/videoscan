export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          subscription_status: 'free' | 'pro' | 'cancelled'
          subscription_end_date: string | null
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          subscription_status?: 'free' | 'pro' | 'cancelled'
          subscription_end_date?: string | null
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          subscription_status?: 'free' | 'pro' | 'cancelled'
          subscription_end_date?: string | null
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scans: {
        Row: {
          id: string
          user_id: string
          file_name: string
          page_count: number
          status: 'processing' | 'completed' | 'failed'
          file_url: string | null
          file_size: number | null
          has_watermark: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          page_count?: number
          status?: 'processing' | 'completed' | 'failed'
          file_url?: string | null
          file_size?: number | null
          has_watermark?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          page_count?: number
          status?: 'processing' | 'completed' | 'failed'
          file_url?: string | null
          file_size?: number | null
          has_watermark?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          month: string
          scan_count: number
          page_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          scan_count?: number
          page_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          scan_count?: number
          page_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      frames: {
        Row: {
          id: string
          scan_id: string
          frame_index: number
          file_url: string
          quality_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          scan_id: string
          frame_index: number
          file_url: string
          quality_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          scan_id?: string
          frame_index?: number
          file_url?: string
          quality_score?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_scan_limit: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: {
          p_user_id: string
          p_page_count: number
        }
        Returns: void
      }
    }
    Enums: {
      subscription_status: 'free' | 'pro' | 'cancelled'
      scan_status: 'processing' | 'completed' | 'failed'
    }
  }
}