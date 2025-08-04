import { NextRequest, NextResponse } from 'next/server'
import { saveBulkTranslationTasks } from '@/lib/database'
import { CSVRow, BulkUploadResult } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const createdBy = formData.get('createdBy') as string || 'anonymous'

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'CSV 파일이 필요합니다.'
      }, { status: 400 })
    }

    // 파일 타입 검증
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'CSV 파일만 업로드 가능합니다.'
      }, { status: 400 })
    }

    // 파일 크기 검증 (100MB 제한)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: '파일 크기는 100MB를 초과할 수 없습니다.'
      }, { status: 400 })
    }

    // CSV 파일 읽기
    console.log('CSV 파일 읽기 시작...')
    const csvText = await file.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    console.log(`CSV 파일 읽기 완료: ${lines.length}줄`)

    if (lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: '빈 CSV 파일입니다.'
      }, { status: 400 })
    }

    // CSV 헤더 확인
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('CSV 헤더:', headers)
    const expectedHeaders = ['sentence_id', 'korean_text', 'human_translation']
    
    // 필수 헤더 확인 (human_translation은 선택사항)
    const requiredHeaders = ['sentence_id', 'korean_text']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({
        success: false,
        error: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`
      }, { status: 400 })
    }

    // CSV 데이터 파싱
    const csvRows: CSVRow[] = []
    const parseErrors: Array<{ row: number; error: string }> = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        // CSV 파싱 (간단한 구현)
        const values = parseCSVLine(line)
        
        if (values.length < requiredHeaders.length) {
          parseErrors.push({
            row: i + 1,
            error: '필수 컬럼 값이 부족합니다.'
          })
          continue
        }

        const sentenceId = values[headers.indexOf('sentence_id')]?.trim()
        const koreanText = values[headers.indexOf('korean_text')]?.trim()
        const humanTranslation = headers.includes('human_translation') 
          ? values[headers.indexOf('human_translation')]?.trim() 
          : undefined

        if (!sentenceId || !koreanText) {
          parseErrors.push({
            row: i + 1,
            error: 'sentence_id와 korean_text는 필수입니다.'
          })
          continue
        }

        csvRows.push({
          sentence_id: sentenceId,
          korean_text: koreanText,
          human_translation: humanTranslation || undefined
        })
      } catch (error) {
        parseErrors.push({
          row: i + 1,
          error: `CSV 파싱 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }

    if (csvRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 데이터가 없습니다.',
        parseErrors
      }, { status: 400 })
    }
    
    console.log(`CSV 파싱 완료: ${csvRows.length}개 유효 행, ${parseErrors.length}개 파싱 오류`)

    // 업로드 배치 ID 생성
    const uploadBatchId = crypto.randomUUID()
    
    console.log(`업로드 시작: ${csvRows.length}개 행, 배치 ID: ${uploadBatchId}`)

    // 대용량 업로드 실행
    const result: BulkUploadResult = await saveBulkTranslationTasks(
      csvRows,
      uploadBatchId,
      createdBy
    )
    
    console.log('업로드 완료:', result)

    // 파싱 에러도 결과에 포함
    if (parseErrors.length > 0) {
      result.errors = [...(result.errors || []), ...parseErrors.map(err => ({
        row: err.row,
        error: err.error
      }))]
      result.failed_records += parseErrors.length
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Bulk upload API error:', error)
    
    let errorMessage = '업로드 처리 중 오류가 발생했습니다.'
    
    if (error instanceof Error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        errorMessage = '데이터베이스 테이블이 존재하지 않습니다. Supabase에서 마이그레이션을 먼저 실행해주세요.'
      } else {
        errorMessage = `서버 오류: ${error.message}`
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 간단한 CSV 파싱 함수 (큰따옴표 처리 포함)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 이스케이프된 큰따옴표
        current += '"'
        i++ // 다음 문자 건너뛰기
      } else {
        // 큰따옴표 시작/끝
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 구분자
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current) // 마지막 값
  return result.map(val => val.trim())
}

// 업로드 진행 상황 조회를 위한 GET 엔드포인트
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const uploadBatchId = searchParams.get('batchId')

    if (!uploadBatchId) {
      return NextResponse.json({
        success: false,
        error: 'batchId 파라미터가 필요합니다.'
      }, { status: 400 })
    }

    // 배치 정보 및 통계 조회 (database.ts의 함수 사용)
    const { getUploadBatchInfo, getUploadBatchStats } = await import('@/lib/database')
    
    const [batchInfo, batchStats] = await Promise.all([
      getUploadBatchInfo(uploadBatchId),
      getUploadBatchStats(uploadBatchId)
    ])

    return NextResponse.json({
      success: true,
      batchInfo,
      stats: batchStats
    })

  } catch (error) {
    console.error('Get upload batch API error:', error)
    return NextResponse.json({
      success: false,
      error: '배치 정보 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 