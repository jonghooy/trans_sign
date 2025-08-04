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
 * 한국어 텍스트를 수어로 번역하는 함수
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
      max_tokens: 1000,
      temperature: 0.3,
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
    console.error('Translation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '번역 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 배치 번역 함수 - 여러 문장을 한 번에 번역
 */
export async function translateBatch(texts: string[]): Promise<{ 
  success: boolean; 
  results: Array<{ original: string; translated?: string; error?: string }> 
}> {
  const results = []
  
  for (const text of texts) {
    const result = await translateKoreanToSignLanguage(text)
    
    if (result.success) {
      results.push({
        original: text,
        translated: result.translated_text!,
      })
    } else {
      results.push({
        original: text,
        error: result.error,
      })
    }
    
    // API 호출 제한을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return {
    success: true,
    results,
  }
}

/**
 * 텍스트 임베딩 생성 함수
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Embedding error:', error)
    return null
  }
}

/**
 * 유사도 계산 함수 (코사인 유사도)
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  
  return dotProduct / (magnitudeA * magnitudeB)
} 