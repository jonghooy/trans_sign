import OpenAI from 'openai'
import { TranslationResponse } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30초 타임아웃 (기본값보다 빠름)
})

const FINE_TUNED_MODEL = process.env.OPENAI_FINE_TUNED_MODEL_ID

if (!FINE_TUNED_MODEL) {
  throw new Error('OPENAI_FINE_TUNED_MODEL_ID environment variable is required')
}

/**
 * 번역 품질을 검증하는 함수
 * 특정 문제 패턴(날짜 관련 등)일 때만 필터링
 */
function validateTranslationQuality(originalText: string, translatedText: string): boolean {
  // 문제가 되는 특정 패턴들을 정의
  const problematicPatterns = [
    // 연도+년+월+월 패턴 (예: {2024}+년+{6}+월)
    /\{\d{4}\}\+년\+\{\d{1,2}\}\+월/,
    // 연도+년 패턴 (예: {2024}+년)
    /\{\d{4}\}\+년/,
    // 월+월+일+일 패턴 (예: {12}+월+{25}+일)
    /\{\d{1,2}\}\+월\+\{\d{1,2}\}\+일/,
  ]
  
  // 원본 텍스트에서 숫자 추출
  const originalNumbers = extractNumbers(originalText)
  
  // 문제 패턴이 발견되었는지 확인
  for (const pattern of problematicPatterns) {
    const matches = translatedText.match(pattern)
    if (matches) {
      // 패턴에서 숫자들을 추출하여 원본에 있는지 확인
      const patternNumbers = extractBracketNumbers(matches[0])
      
      // 패턴 내의 숫자가 원본에 없으면 필터링
      for (const num of patternNumbers) {
        if (!originalNumbers.includes(num)) {
          console.log(`⚠️ 번역 품질 검증 실패: 문제 패턴 발견 - ${matches[0]}`)
          console.log(`원본: "${originalText}"`)
          console.log(`번역: "${translatedText}"`)
          return false
        }
      }
    }
  }
  
  return true
}

/**
 * 텍스트에서 모든 숫자를 추출하는 함수
 */
function extractNumbers(text: string): string[] {
  const numbers = text.match(/\d+/g) || []
  return numbers
}

/**
 * 번역 텍스트에서 중괄호 안의 숫자를 추출하는 함수
 */
function extractBracketNumbers(text: string): string[] {
  const bracketNumbers = text.match(/\{(\d+)\}/g) || []
  return bracketNumbers.map(match => match.replace(/[{}]/g, ''))
}

/**
 * ⚡ 고속 한국어 텍스트를 수어로 번역하는 함수 (최적화됨)
 */
export async function translateKoreanToSignLanguage(koreanText: string): Promise<TranslationResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: FINE_TUNED_MODEL as string,
      messages: [
        {
          role: 'user',
          content: koreanText,
        },
      ],
      // 🚀 초고속 최적화 설정
      max_tokens: 150,        // 200 → 150 (더 짧은 응답으로 속도 향상)
      temperature: 0.05,      // 0.1 → 0.05 (최고 속도를 위한 최소값)
      top_p: 0.8,            // 0.9 → 0.8 (더 빠른 응답)
      frequency_penalty: 0,   // 기본값으로 빠른 응답
      presence_penalty: 0,    // 기본값으로 빠른 응답
      stream: false,          // 스트리밍 비활성화로 빠른 완료
    })

    const translatedText = response.choices[0]?.message?.content?.trim()

    if (!translatedText) {
      return {
        success: false,
        error: '번역 결과를 받을 수 없습니다.',
      }
    }

    // 번역 품질 검증
    if (!validateTranslationQuality(koreanText, translatedText)) {
      return {
        success: true,
        translated_text: '', // 품질 검증 실패시 빈 문자열 반환
      }
    }

    return {
      success: true,
      translated_text: translatedText,
    }
  } catch (error) {
    console.error('⚡ 고속 번역 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '번역 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 🔄 재시도용 번역 함수 - 품질 검증 실패 시 다른 파라미터로 재시도
 */
export async function translateKoreanToSignLanguageRetry(
  koreanText: string, 
  customTemperature?: number, 
  customTopP?: number,
  customMaxTokens?: number,
  modifyInput?: boolean
): Promise<TranslationResponse> {
  try {
    // 🔄 3차 시도 시 입력 패턴 변화: 마지막 "." 제거
    let modifiedText = koreanText
    if (modifyInput) {
      modifiedText = koreanText.endsWith('.') ? koreanText.slice(0, -1) : koreanText
      console.log(`🔧 입력 패턴 변화: "${koreanText}" → "${modifiedText}"`)
    }
    
    const response = await openai.chat.completions.create({
      model: FINE_TUNED_MODEL as string,
      messages: [
        {
          role: 'user',
          content: modifiedText,
        },
      ],
      // 🔄 재시도용 파라미터 (단계별로 더 보수적인 설정)
      max_tokens: customMaxTokens ?? 200,          // 커스텀 토큰 수 또는 기본값
      temperature: customTemperature ?? 0.3,       // 사용자 지정 또는 기본값
      top_p: customTopP ?? 0.95,                   // 사용자 지정 또는 기본값
      frequency_penalty: customTemperature && customTemperature <= 0.01 ? 0.2 : 0.1, // 극보수적일 때 더 강한 억제
      presence_penalty: customTemperature && customTemperature <= 0.01 ? 0.2 : 0.1,  // 극보수적일 때 더 강한 유도
      stream: false,
    })

    const translatedText = response.choices[0]?.message?.content?.trim()

    if (!translatedText) {
      return {
        success: false,
        error: '재시도 번역 결과를 받을 수 없습니다.',
      }
    }

    // 재시도에서도 품질 검증 수행 (원본 텍스트 기준)
    if (!validateTranslationQuality(koreanText, translatedText)) {
      return {
        success: true,
        translated_text: '', // 재시도에서도 품질 검증 실패시 빈 문자열 반환
      }
    }

    return {
      success: true,
      translated_text: translatedText,
    }
  } catch (error) {
    console.error('🔄 재시도 번역 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '재시도 번역 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 배치 번역 함수 - 여러 문장을 한 번에 번역 (사용하지 않음, 병렬 처리로 대체)
 */
export async function translateBatch(texts: string[]): Promise<{ 
  success: boolean; 
  results: Array<{ original: string; translated?: string; error?: string }> 
}> {
  
  try {
    const results = await Promise.all(
      texts.map(async (text) => {
        const result = await translateKoreanToSignLanguage(text)
        if (result.success) {
          return { original: text, translated: result.translated_text }
        } else {
          return { original: text, error: result.error }
        }
      })
    )

    return {
      success: true,
      results
    }
  } catch (error) {
    console.error('Batch translation error:', error)
    return {
      success: false,
      results: texts.map(text => ({ 
        original: text, 
        error: error instanceof Error ? error.message : '배치 번역 중 오류가 발생했습니다.' 
      }))
    }
  }
}
