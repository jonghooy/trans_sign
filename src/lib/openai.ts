import OpenAI from 'openai'
import { TranslationResponse } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const FINE_TUNED_MODEL = process.env.OPENAI_FINE_TUNED_MODEL_ID

if (!FINE_TUNED_MODEL) {
  throw new Error('OPENAI_FINE_TUNED_MODEL_ID environment variable is required')
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
      // 🚀 속도 최적화 설정
      max_tokens: 200,        // 1000 → 200 (수어 번역은 일반적으로 짧음)
      temperature: 0.1,       // 0.3 → 0.1 (더 빠른 응답, 일관성 높임)
      top_p: 0.9,            // 응답 속도 향상
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
