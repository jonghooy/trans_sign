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

    // CSV 파일을 다양한 인코딩으로 읽기 시도
    const csvText = await readFileWithEncoding(file)
    
    if (!csvText) {
      return createErrorStream('파일을 읽을 수 없습니다. UTF-8, EUC-KR, CP949 인코딩을 확인해주세요.')
    }

    const lines = csvText.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      return createErrorStream('빈 CSV 파일입니다.')
    }

    // 한글 깨짐 검사
    if (hasCorruptedText(csvText)) {
      return createErrorStream('파일 인코딩이 올바르지 않습니다. 파일을 UTF-8로 저장하거나 메모장에서 다른 이름으로 저장 시 UTF-8을 선택해주세요.')
    }

    // 헤더 파싱
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('CSV 헤더:', headers)

    // 필수 헤더 확인
    const requiredHeaders = ['sentence_id', 'korean_text']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    
    if (missingHeaders.length > 0) {
      return createErrorStream(`필수 컬럼이 없습니다: ${missingHeaders.join(', ')}`)
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
        // 각 행의 한글 텍스트도 검사
        if (hasCorruptedText(row.korean_text)) {
          return createErrorStream(`문장 ID ${row.sentence_id}의 한글 텍스트가 깨져있습니다. 파일을 UTF-8로 다시 저장해주세요.`)
        }
        dataRows.push(row)
      }
    }

    if (dataRows.length === 0) {
      return createErrorStream('유효한 데이터 행이 없습니다.')
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
            
            console.log(`⚡ 고속 번역 중 (${i + 1}/${total}): ${row.korean_text.substring(0, 50)}...`)
            
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
        
        console.log(`🎉 고속 번역 완료: ${results.length}개 문장`)
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
    return createErrorStream(error instanceof Error ? error.message : '번역 처리 중 오류가 발생했습니다.')
  }
}

// 다양한 인코딩으로 파일 읽기 시도
async function readFileWithEncoding(file: File): Promise<string | null> {
  const arrayBuffer = await file.arrayBuffer()
  
  // 시도할 인코딩들
  const encodings = ['utf-8', 'euc-kr', 'windows-949']
  
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true })
      const text = decoder.decode(arrayBuffer)
      
      // 한글이 포함된 텍스트인지 확인
      if (text && !hasCorruptedText(text)) {
        console.log(`✅ 성공적으로 ${encoding} 인코딩으로 읽음`)
        return text
      }
    } catch (error) {
      console.log(`❌ ${encoding} 인코딩으로 읽기 실패:`, error)
    }
  }
  
  // 모든 인코딩 실패 시 UTF-8로 강제 읽기 (오류 무시)
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const text = decoder.decode(arrayBuffer)
    console.log('⚠️ UTF-8 강제 읽기 (일부 문자가 깨질 수 있음)')
    return text
  } catch (error) {
    return null
  }
}

// 텍스트에 깨진 문자가 있는지 검사
function hasCorruptedText(text: string): boolean {
  // 연속된 물음표나 알 수 없는 문자 패턴 검사
  const corruptedPatterns = [
    /\?{3,}/,  // ??? 연속된 물음표
    /�+/,      // replacement character
    /[^\x00-\x7F\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF\s\d\p{P}]+/u, // 한글, ASCII, 숫자, 구두점 외의 문자
  ]
  
  return corruptedPatterns.some(pattern => pattern.test(text))
}

// 오류 스트림 생성
function createErrorStream(errorMessage: string): Response {
  const encoder = new TextEncoder()
  const errorData = {
    type: 'error',
    error: errorMessage
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
