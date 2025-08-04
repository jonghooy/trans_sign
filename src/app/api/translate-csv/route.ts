import { NextRequest, NextResponse } from 'next/server'
import { translateKoreanToSignLanguage } from '@/lib/openai'

interface CSVRow {
  sentence_id: string
  korean_text: string
  human_translation?: string
}

interface TranslationResult extends CSVRow {
  ai_translation: string
  check: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

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

    // CSV 파일 읽기
    const csvText = await file.text()
    const lines = csvText.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: '빈 CSV 파일입니다.'
      }, { status: 400 })
    }

    // 헤더 파싱
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('CSV 헤더:', headers)

    // 필수 헤더 확인
    const requiredHeaders = ['sentence_id', 'korean_text']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({
        success: false,
        error: `필수 컬럼이 없습니다: ${missingHeaders.join(', ')}`
      }, { status: 400 })
    }

    // 인덱스 찾기
    const sentenceIdIndex = headers.indexOf('sentence_id')
    const koreanTextIndex = headers.indexOf('korean_text')
    const humanTranslationIndex = headers.indexOf('human_translation')

    // 데이터 행 파싱
    const dataRows: CSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // 간단한 CSV 파싱 (따옴표 처리)
      const values = parseCSVLine(line)
      
      if (values.length <= Math.max(sentenceIdIndex, koreanTextIndex)) {
        console.warn(`행 ${i}: 컬럼이 부족합니다:`, line)
        continue
      }

      const row: CSVRow = {
        sentence_id: values[sentenceIdIndex]?.replace(/"/g, '').trim() || '',
        korean_text: values[koreanTextIndex]?.replace(/"/g, '').trim() || '',
        human_translation: humanTranslationIndex >= 0 && values[humanTranslationIndex] 
          ? values[humanTranslationIndex].replace(/"/g, '').trim() 
          : ''
      }

      if (row.sentence_id && row.korean_text) {
        dataRows.push(row)
      }
    }

    if (dataRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 데이터 행이 없습니다.'
      }, { status: 400 })
    }

    console.log(`파싱된 데이터: ${dataRows.length}개 행`)

    // 스트리밍 응답 설정
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // 번역 수행
        const results: TranslationResult[] = []
        const total = dataRows.length
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          
          try {
            // 진행 상황 전송
            const progressData = {
              type: 'progress',
              current: i + 1,
              total: total,
              currentText: row.korean_text
            }
            controller.enqueue(encoder.encode(JSON.stringify(progressData) + '\n'))
            
            console.log(`번역 중 (${i + 1}/${total}): ${row.korean_text.substring(0, 50)}...`)
            
            const translationResponse = await translateKoreanToSignLanguage(row.korean_text)
            
            const result: TranslationResult = {
              ...row,
              ai_translation: translationResponse.success 
                ? translationResponse.translated_text || '[번역 실패: 결과 없음]'
                : `[번역 실패: ${translationResponse.error}]`,
              check: '' // 빈 값으로 초기화
            }
            
            results.push(result)
            
            // API 제한을 위한 지연
            if (i < dataRows.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
            
          } catch (error) {
            console.error(`번역 오류 (${row.sentence_id}):`, error)
            const result: TranslationResult = {
              ...row,
              ai_translation: `[번역 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}]`,
              check: ''
            }
            results.push(result)
          }
        }

        // 완료 데이터 전송
        const completeData = {
          type: 'complete',
          results: results,
          statistics: {
            total: results.length,
            successful: results.filter(r => !r.ai_translation.startsWith('[번역 실패')).length,
            failed: results.filter(r => r.ai_translation.startsWith('[번역 실패')).length
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify(completeData) + '\n'))
        
        console.log(`번역 완료: ${results.length}개 문장`)
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('CSV 번역 API 오류:', error)
    
    // 오류 응답도 스트리밍 형태로
    const encoder = new TextEncoder()
    const errorData = {
      type: 'error',
      error: error instanceof Error ? error.message : '번역 처리 중 오류가 발생했습니다.'
    }
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(errorData) + '\n'))
        controller.close()
      }
    })

    return new Response(stream, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}

// 간단한 CSV 파싱 함수 (따옴표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 이스케이프된 따옴표
        current += '"'
        i++ // 다음 따옴표 건너뛰기
      } else {
        // 따옴표 토글
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 컬럼 구분자
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current) // 마지막 컬럼
  return result
}
