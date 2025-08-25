import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // 환경 변수에서 모델 ID 가져오기
    const modelId = process.env.OPENAI_FINE_TUNED_MODEL_ID
    
    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: '모델 ID가 설정되지 않았습니다.'
      }, { status: 500 })
    }

    // data/model_info.json 파일에서 추가 정보 읽기 (현재는 사용하지 않음)
    try {
      const modelInfoPath = path.join(process.cwd(), 'data', 'model_info.json')
      if (fs.existsSync(modelInfoPath)) {
        const modelInfoContent = fs.readFileSync(modelInfoPath, 'utf-8')
        JSON.parse(modelInfoContent) // 파일 존재 확인용
      }
    } catch (error) {
      console.log('model_info.json 파일을 읽을 수 없습니다:', error)
    }

    // 모델 타입 판별
    let modelType = 'Unknown'
    let isFineTuned = false
    
    if (modelId.startsWith('ft:')) {
      modelType = 'Fine-tuned GPT'
      isFineTuned = true
    } else if (modelId.includes('gpt-4')) {
      modelType = 'GPT-4'
    } else if (modelId.includes('gpt-3.5')) {
      modelType = 'GPT-3.5'
    } else {
      modelType = 'GPT Model'
    }

    // 응답 데이터 구성
    const response = {
      success: true,
      model_id: modelId,
      model_type: modelType,
      is_fine_tuned: isFineTuned,
      display_name: isFineTuned ? '한국어-수어 번역 전용모델' : modelType
    }

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('모델 정보 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '모델 정보를 가져올 수 없습니다.'
    }, { status: 500 })
  }
}
