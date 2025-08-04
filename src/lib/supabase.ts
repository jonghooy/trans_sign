import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// 데이터베이스 타입 정의
export type Database = {
  public: {
    Tables: {
      translation_tasks: {
        Row: {
          id: string
          original_text: string
          translated_text: string | null
          sentence_id: string | null
          human_translated_text: string | null
          source_type: 'manual' | 'csv_upload' | null
          upload_batch_id: string | null
          created_by: string | null
          status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
          group_id: string | null
          embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          original_text: string
          translated_text?: string | null
          sentence_id?: string | null
          human_translated_text?: string | null
          source_type?: 'manual' | 'csv_upload' | null
          upload_batch_id?: string | null
          created_by?: string | null
          status?: 'pending' | 'reviewed' | 'accepted' | 'rejected'
          group_id?: string | null
          embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          original_text?: string
          translated_text?: string | null
          sentence_id?: string | null
          human_translated_text?: string | null
          source_type?: 'manual' | 'csv_upload' | null
          upload_batch_id?: string | null
          created_by?: string | null
          status?: 'pending' | 'reviewed' | 'accepted' | 'rejected'
          group_id?: string | null
          embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
      }
      accepted_data: {
        Row: {
          id: string
          original_text: string
          translated_text: string
          task_id: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          original_text: string
          translated_text: string
          task_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          original_text?: string
          translated_text?: string
          task_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
      }
      rejected_data: {
        Row: {
          id: string
          original_text: string
          translated_text: string
          task_id: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          original_text: string
          translated_text: string
          task_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          original_text?: string
          translated_text?: string
          task_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
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
  }
} 