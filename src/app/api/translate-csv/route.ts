import { NextRequest, NextResponse } from 'next/server'
import { translateKoreanToSignLanguage, translateKoreanToSignLanguageRetry } from '@/lib/openai'

interface CSVRow {
  sentence_id: string
  korean_text: string
  human_translation?: string
}

interface TranslationResult extends CSVRow {
  ai_translation: string
  check: string
  // 각 재시도 단계별 결과 추적
  attempt_1_result?: string  // 1차 시도 결과 (성공/실패 무관)
  attempt_2_result?: string  // 2차 재시도 결과 (있는 경우)
  attempt_3_result?: string  // 3차 재시도 결과 (있는 경우)
  final_status?: 'success_1st' | 'success_2nd' | 'success_3rd' | 'failed_all'  // 최종 상태
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

    // 필수 헤더 확인 (여러 가능한 컬럼명 지원)
    const sentenceIdColumns = ['sentence_id', '문장번호']
    const koreanTextColumns = ['korean_text', '정제 문장']
    const humanTranslationColumns = ['human_translation', '수어번역']
    
    // sentence_id 또는 문장번호 찾기
    const sentenceIdIndex = headers.findIndex(h => sentenceIdColumns.includes(h))
    if (sentenceIdIndex === -1) {
      return createErrorStream(`필수 컬럼이 없습니다: ${sentenceIdColumns.join(' 또는 ')}`)
    }
    
    // korean_text 또는 정제 문장 찾기  
    const koreanTextIndex = headers.findIndex(h => koreanTextColumns.includes(h))
    if (koreanTextIndex === -1) {
      return createErrorStream(`필수 컬럼이 없습니다: ${koreanTextColumns.join(' 또는 ')}`)
    }
    
    // human_translation 또는 수어번역 찾기 (선택적)
    const humanTranslationIndex = headers.findIndex(h => humanTranslationColumns.includes(h))
    
    console.log(`✅ 컬럼 매핑: ID=${headers[sentenceIdIndex]}, 텍스트=${headers[koreanTextIndex]}, 수어번역=${humanTranslationIndex >= 0 ? headers[humanTranslationIndex] : '없음'}`)

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
        // 🚀 고속 병렬 번역 수행
        const results: TranslationResult[] = new Array(dataRows.length)
        const total = dataRows.length
        const BATCH_SIZE = 10 // 동시에 처리할 최대 개수 (5→10으로 증가)
        const BATCH_DELAY = 100 // 배치 간 딜레이 (ms) (200→100으로 감소)
        
        let completed = 0
        const failedQualityCheck: { index: number, row: CSVRow }[] = [] // 품질 검증 실패한 문장들
        
        // 배치별로 병렬 처리
        for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, dataRows.length)
          const batch = dataRows.slice(batchStart, batchEnd)
          
          console.log(`🔥 배치 ${Math.floor(batchStart / BATCH_SIZE) + 1} 시작: ${batchStart + 1}-${batchEnd}번 문장 (${batch.length}개)`)
          
          // 현재 배치를 병렬로 처리
          const batchPromises = batch.map(async (row, localIndex) => {
            const globalIndex = batchStart + localIndex
            
            try {
              const translationResponse = await translateKoreanToSignLanguage(row.korean_text)
              
              let aiTranslation: string
              let isQualityCheckFailed = false
              
              // 1차 시도 결과를 저장 (성공/실패 무관하게 실제 번역 결과 저장)
              let attempt1Result = ''
              if (!translationResponse.success) {
                aiTranslation = `[번역 실패: ${translationResponse.error}]`
                attempt1Result = aiTranslation
              } else if (!translationResponse.translated_text || translationResponse.translated_text.trim() === '') {
                // 품질 검증 실패 시 실제 번역 결과가 있으면 표시
                if (translationResponse.raw_translation) {
                  aiTranslation = `[품질검증실패] ${translationResponse.raw_translation}`
                  attempt1Result = translationResponse.raw_translation  // 실제 번역 결과 저장
                } else {
                  aiTranslation = '[품질검증실패: 실제 AI 번역 결과 확인 불가]'
                  attempt1Result = aiTranslation
                }
                isQualityCheckFailed = true
              } else {
                aiTranslation = translationResponse.translated_text
                attempt1Result = translationResponse.translated_text
              }
              
              const result: TranslationResult = {
                ...row,
                ai_translation: aiTranslation,
                check: '', // 빈 값으로 초기화
                attempt_1_result: attempt1Result,
                final_status: isQualityCheckFailed || !translationResponse.success ? undefined : 'success_1st'
              }
              
              // 품질 검증 실패한 경우 재시도 목록에 추가
              if (isQualityCheckFailed) {
                failedQualityCheck.push({ index: globalIndex, row })
              }
              
              return { index: globalIndex, result }
              
            } catch (error) {
              console.error(`번역 오류 (${row.sentence_id}):`, error)
              const result: TranslationResult = {
                ...row,
                ai_translation: `[번역 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}]`,
                check: ''
              }
              return { index: globalIndex, result }
            }
          })
          
          // 배치 내 모든 번역 완료 대기
          const batchResults = await Promise.all(batchPromises)
          
          // 결과를 순서대로 저장
          batchResults.forEach(({ index, result }) => {
            results[index] = result
            completed++
            
            // 실시간 진행 상황 전송
            const progressData = {
              type: 'progress',
              current: completed,
              total: total,
              currentText: result.korean_text.substring(0, 30) + '...'
            }
            controller.enqueue(encoder.encode(JSON.stringify(progressData) + '\n'))
          })
          
          console.log(`✅ 배치 완료: ${completed}/${total} (${Math.round(completed / total * 100)}%)`)
          
          // 배치 간 짧은 딜레이 (API 제한 고려)
          if (batchEnd < dataRows.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
          }
        }

        // 🔄 품질 검증 실패한 문장들 다차 재시도 (2차, 3차)
        if (failedQualityCheck.length > 0) {
          const RETRY_BATCH_SIZE = 3
          const RETRY_BATCH_DELAY = 200 // 재시도는 더 신중하게
          
          // 재시도 파라미터 설정 (단계별로 더 보수적)
          const retrySettings: Array<{
            attempt: number
            temperature: number
            top_p: number
            max_tokens: number
            description: string
          }> = [
            { 
              attempt: 2, 
              temperature: 0.1, 
              top_p: 0.8, 
              max_tokens: 200,
              description: "2차 시도 (보수적)" 
            },
            { 
              attempt: 3, 
              temperature: 0.005, 
              top_p: 0.6, 
              max_tokens: 250,
              description: "3차 시도 (극보수적 + 입력패턴 변화)" 
            }
          ]
          
          let currentFailedList = [...failedQualityCheck] // 현재 실패 목록
          
          for (const { attempt, temperature, top_p, max_tokens, description } of retrySettings) {
            if (currentFailedList.length === 0) break // 더 이상 실패한 것이 없으면 중단
            
            console.log(`🔄 ${description}: ${currentFailedList.length}개 문장`)
            
            let retryCompleted = 0
            const nextFailedList: { index: number, row: CSVRow }[] = []
            
            for (let i = 0; i < currentFailedList.length; i += RETRY_BATCH_SIZE) {
              const retryBatch = currentFailedList.slice(i, i + RETRY_BATCH_SIZE)
              
              console.log(`🔄 ${attempt}차 재시도 배치 ${Math.floor(i / RETRY_BATCH_SIZE) + 1}: ${retryBatch.length}개 문장 (temp=${temperature}, top_p=${top_p}, max_tokens=${max_tokens}${attempt === 3 ? ', 입력패턴변화' : ''})`)
              
              const retryPromises = retryBatch.map(async ({ index, row }) => {
                try {
                  const retryResponse = await translateKoreanToSignLanguageRetry(
                    row.korean_text,
                    temperature,
                    top_p,
                    max_tokens,
                    attempt === 3 // 3차 시도일 때만 입력 패턴 변화
                  )
                  
                  // 재시도 결과 저장 (성공/실패 무관)
                  let attemptResult = ''
                  let wasSuccessful = false
                  
                  if (!retryResponse.success) {
                    attemptResult = `[번역 실패: ${retryResponse.error}]`
                  } else if (retryResponse.raw_translation) {
                    attemptResult = retryResponse.raw_translation
                  } else if (retryResponse.translated_text) {
                    attemptResult = retryResponse.translated_text
                  }
                  
                  if (retryResponse.success && retryResponse.translated_text && retryResponse.translated_text.trim() !== '') {
                    // 재시도 성공
                    wasSuccessful = true
                    const updatedResult: TranslationResult = {
                      ...results[index],  // 기존 결과 유지
                      ai_translation: retryResponse.translated_text,
                      final_status: attempt === 2 ? 'success_2nd' : 'success_3rd'
                    }
                    
                    // 동적으로 재시도 결과 할당
                    if (attempt === 2) {
                      updatedResult.attempt_2_result = attemptResult
                    } else if (attempt === 3) {
                      updatedResult.attempt_3_result = attemptResult
                    }
                    
                    results[index] = updatedResult
                    console.log(`✅ ${attempt}차 재시도 성공 (${row.sentence_id}): ${retryResponse.translated_text.substring(0, 50)}...`)
                    return { index, row, success: true }
                  } else {
                    // 재시도 실패 - 결과 저장 후 계속 진행
                    const failedResult: TranslationResult = {
                      ...results[index]  // 기존 결과 유지
                    }
                    
                    // 동적으로 재시도 결과 할당
                    if (attempt === 2) {
                      failedResult.attempt_2_result = attemptResult
                    } else if (attempt === 3) {
                      failedResult.attempt_3_result = attemptResult
                    }
                    
                    results[index] = failedResult
                    console.log(`❌ ${attempt}차 재시도도 실패 (${row.sentence_id})`)
                    return { index, row, success: false }
                  }
                } catch (error) {
                  console.error(`${attempt}차 재시도 오류 (${row.sentence_id}):`, error)
                  return { index, row, success: false }
                }
              })
              
              const retryResults = await Promise.all(retryPromises)
              retryCompleted += retryResults.length
              
              // 실패한 것들은 다음 차수 재시도 목록에 추가
              retryResults.forEach(({ index, row, success }) => {
                if (!success) {
                  nextFailedList.push({ index, row })
                }
              })
              
              // 📊 재시도 진행 상황 전송 (단계별 정보 포함)
              const retryProgressData = {
                type: 'progress',
                current: total,
                total: total,
                currentText: `${attempt}차 시도 진행 중... (${retryCompleted}/${currentFailedList.length})`,
                retryStage: {
                  attempt: attempt,
                  currentCompleted: retryCompleted,
                  totalForThisStage: currentFailedList.length,
                  isRetry: true
                }
              }
              controller.enqueue(encoder.encode(JSON.stringify(retryProgressData) + '\n'))
              
              // 재시도 배치 간 딜레이
              if (i + RETRY_BATCH_SIZE < currentFailedList.length) {
                await new Promise(resolve => setTimeout(resolve, RETRY_BATCH_DELAY))
              }
            }
            
            console.log(`🎯 ${attempt}차 재시도 완료: ${currentFailedList.length - nextFailedList.length}개 성공, ${nextFailedList.length}개 여전히 실패`)
            currentFailedList = nextFailedList // 다음 차수를 위해 실패 목록 업데이트
          }
          
          console.log(`🏁 모든 재시도 완료`)
        }

        // 최종 상태 설정 (아직 설정되지 않은 결과들)
        results.forEach(result => {
          if (!result.final_status) {
            // ai_translation이 비어있거나 실패 메시지면 failed_all
            if (!result.ai_translation || 
                result.ai_translation.trim() === '' || 
                result.ai_translation.startsWith('[번역 실패') ||
                result.ai_translation.startsWith('[품질검증실패]')) {
              result.final_status = 'failed_all'
            }
          }
        })

        // 완료 데이터 전송
        const successfulCount = results.filter(r => !r.ai_translation.startsWith('[번역 실패') && r.ai_translation.trim() !== '').length
        const failedCount = results.filter(r => r.ai_translation.startsWith('[번역 실패')).length
        const qualityFailedCount = results.filter(r => r.ai_translation.trim() === '').length
        
        const completeData = {
          type: 'complete',
          results: results,
          statistics: {
            total: results.length,
            successful: successfulCount,
            failed: failedCount,
            qualityCheckFailed: qualityFailedCount,
            retryAttempted: failedQualityCheck.length,
            retrySuccessful: failedQualityCheck.length - qualityFailedCount
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
  } catch {
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
