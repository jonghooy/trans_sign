import { NextRequest, NextResponse } from 'next/server'
import { 
  updateTranslationTaskStatus, 
  saveAcceptedData, 
  saveRejectedData 
} from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { taskId, action, originalText, translatedText, reviewedBy } = await request.json()

    if (!taskId || !action || !originalText || !translatedText) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      )
    }

    // 번역 작업 상태 업데이트
    await updateTranslationTaskStatus(
      taskId,
      action === 'accept' ? 'accepted' : 'rejected'
    )

    // 채택/폐기 데이터 저장 (작업자 정보 포함)
    if (action === 'accept') {
      await saveAcceptedData(originalText, translatedText, taskId, reviewedBy)
    } else {
      await saveRejectedData(originalText, translatedText, taskId, reviewedBy)
    }

    return NextResponse.json({
      success: true,
      message: action === 'accept' ? '번역이 채택되었습니다.' : '번역이 폐기되었습니다.',
      action,
      task_id: taskId,
    })
  } catch (error) {
    console.error('Review submit API error:', error)
    return NextResponse.json(
      { error: '검수 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 