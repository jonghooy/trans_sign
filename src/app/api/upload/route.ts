import { NextRequest, NextResponse } from 'next/server'
import { saveUntranslatedTask } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '파일을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 파일 타입 확인
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'CSV 또는 TXT 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일 내용 읽기
    const fileContent = await file.text()
    let texts: string[] = []

    if (fileName.endsWith('.csv')) {
      // CSV 파일 처리
      const lines = fileContent.split('\n').filter(line => line.trim())
      // 첫 줄이 헤더인지 확인하고 제거
      if (lines.length > 0 && lines[0].includes(',')) {
        texts = lines.slice(1).map(line => {
          // 간단한 CSV 파싱 (첫 번째 컬럼만 사용)
          const match = line.match(/^"([^"]+)"|^([^,]+)/)
          return match ? (match[1] || match[2]).trim() : line.trim()
        })
      } else {
        texts = lines.map(line => line.trim())
      }
    } else {
      // TXT 파일 처리
      texts = fileContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
    }

    if (texts.length === 0) {
      return NextResponse.json(
        { error: '처리할 텍스트가 없습니다.' },
        { status: 400 }
      )
    }

    // 최대 처리 개수 제한
    const maxTexts = 50
    if (texts.length > maxTexts) {
      texts = texts.slice(0, maxTexts)
    }

    // 원문만 데이터베이스에 저장 (번역은 검수 시 실시간 처리)
    let successCount = 0
    let failedCount = 0

    for (const text of texts) {
      try {
        // 원문만 저장 (번역되지 않은 상태로)
        await saveUntranslatedTask(text)
        successCount++
      } catch (error) {
        console.error('Error saving original text:', error)
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `총 ${texts.length}개 문장 업로드 완료 (번역은 검수 시 실시간 처리됩니다)`,
      total_records: texts.length,
      success_count: successCount,
      failed_count: failedCount,
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: '파일 업로드 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 