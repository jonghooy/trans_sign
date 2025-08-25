// CSV 번역에 필요한 타입들만 유지

export interface TranslationResponse {
  success: boolean
  translated_text?: string
  error?: string
  raw_translation?: string  // 품질검증 실패 시에도 원본 번역 결과 보존
  quality_check_failed?: boolean  // 품질검증 실패 여부
}

export interface CSVRow {
  sentence_id: string
  korean_text: string
  human_translation?: string
}

export interface TranslationResult extends CSVRow {
  ai_translation: string
  check: string
}

export interface CSVTranslationResponse {
  success: boolean
  results?: TranslationResult[]
  statistics?: {
    total: number
    successful: number
    failed: number
    success_rate: number
  }
  error?: string
}

export interface ProgressData {
  type: 'progress'
  current: number
  total: number
  currentText?: string
}

export interface CompleteData {
  type: 'complete'
  results: TranslationResult[]
  statistics: {
    total: number
    successful: number
    failed: number
  }
}

export interface ErrorData {
  type: 'error'
  error: string
}

export type StreamData = ProgressData | CompleteData | ErrorData
