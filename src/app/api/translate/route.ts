import { NextRequest, NextResponse } from 'next/server'
import { translateKoreanToSignLanguage, generateEmbedding } from '@/lib/openai'
import { saveTranslationTask } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { text, saveToDb = false } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '번역할 텍스트가 필요합니다.' },
        { status: 400 }
      )
    }

    // 번역 수행
    const translationResult = await translateKoreanToSignLanguage(text)

    if (!translationResult.success) {
      return NextResponse.json(
        { error: translationResult.error },
        { status: 500 }
      )
    }

    let taskId: string | null = null

    // 데이터베이스에 저장이 요청된 경우
    if (saveToDb) {
      // 임베딩 생성
      const embedding = await generateEmbedding(text)
      
      // 번역 작업 저장
      taskId = await saveTranslationTask(
        text,
        translationResult.translated_text!,
        embedding
      )
    }

    return NextResponse.json({
      success: true,
      original_text: text,
      translated_text: translationResult.translated_text,
      task_id: taskId,
    })
  } catch (error) {
    console.error('Translation API error:', error)
    return NextResponse.json(
      { error: '번역 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 