import { NextRequest, NextResponse } from 'next/server'
import { getPendingTasks, updateTaskWithTranslation, saveRejectedData, updateTranslationTaskStatus } from '@/lib/database'
import { translateKoreanToSignLanguage, generateEmbedding } from '@/lib/openai'
import { shouldAutoReject } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const tasks = await getPendingTasks(limit, offset)

    // 번역되지 않은 작업들을 병렬로 처리
    const untranslatedTasks = tasks.filter(task => task.translated_text === null)
    
    if (untranslatedTasks.length > 0) {
      // 병렬 처리를 위한 Promise 배열
      const translationPromises = untranslatedTasks.map(async (task) => {
        try {
          // 번역과 임베딩을 병렬로 처리
          const [translationResult, embedding] = await Promise.all([
            translateKoreanToSignLanguage(task.original_text),
            generateEmbedding(task.original_text)
          ])
          
          if (translationResult.success && translationResult.translated_text && embedding) {
            // 번역 품질 검사
            if (shouldAutoReject(translationResult.translated_text, task.original_text)) {
              console.log(`Auto-rejecting low quality translation for task ${task.id}:`, {
                original: task.original_text,
                translated: translationResult.translated_text
              })
              
              // 저품질 번역을 자동으로 폐기 처리 (시스템 자동 처리로 기록)
              await Promise.all([
                saveRejectedData(task.original_text, translationResult.translated_text, task.id, 'system-auto'),
                updateTranslationTaskStatus(task.id, 'rejected')
              ])
              
              // 검수 대상에서 제외하기 위해 null 반환
              return null
            }
            
            // 품질 검사를 통과한 경우에만 번역 결과로 작업 업데이트
            await updateTaskWithTranslation(task.id, translationResult.translated_text, embedding)
            
            // 메모리상의 작업도 업데이트
            task.translated_text = translationResult.translated_text
            task.embedding = embedding
            task.status = 'pending'
            
            return task
          }
        } catch (error) {
          console.error(`Error translating task ${task.id}:`, error)
          // 번역 실패 시 null 반환
          return null
        }
        
        return null
      })
      
      // 모든 번역 작업이 완료될 때까지 대기
      const completedTasks = await Promise.allSettled(translationPromises)
      
      // 자동 폐기되지 않은 성공적인 번역만 필터링
      const validResults = completedTasks
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<any>).value)
    }

    // 번역이 완료되고 품질 검사를 통과한 작업만 반환
    const translatedTasks = tasks.filter(task => 
      task.translated_text && task.status !== 'rejected'
    )

    return NextResponse.json({
      success: true,
      tasks: translatedTasks,
      count: translatedTasks.length,
    })
  } catch (error) {
    console.error('Get pending tasks API error:', error)
    return NextResponse.json(
      { error: '검수 대기 작업을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 