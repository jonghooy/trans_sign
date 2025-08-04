export interface TranslationTask {
  id: string
  original_text: string
  translated_text: string | null
  sentence_id?: string | null
  human_translated_text?: string | null
  source_type?: 'manual' | 'csv_upload'
  upload_batch_id?: string | null
  created_by?: string | null
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
  group_id: string | null
  embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface AcceptedData {
  id: string
  original_text: string
  translated_text: string
  created_at: string
}

export interface RejectedData {
  id: string
  original_text: string
  translated_text: string
  created_at: string
}

export interface ReviewStats {
  total_processed: number
  accepted_count: number
  rejected_count: number
  acceptance_rate: number
}

export interface FileUploadResult {
  success: boolean
  message: string
  total_records: number
  failed_records: number
}

export interface TranslationResponse {
  success: boolean
  translated_text?: string
  error?: string
}

export interface BulkUploadResult {
  success: boolean
  message: string
  total_records: number
  processed_records: number
  failed_records: number
  upload_batch_id: string
  errors?: Array<{
    row: number
    error: string
    data?: any
  }>
}

export interface BulkUploadProgress {
  total: number
  processed: number
  failed: number
  current_batch: number
  total_batches: number
  status: 'preparing' | 'uploading' | 'completed' | 'failed'
  errors: Array<{
    row: number
    error: string
  }>
}

export interface CSVRow {
  sentence_id: string
  korean_text: string
  human_translation?: string
} 