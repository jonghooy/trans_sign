import { NextRequest, NextResponse } from 'next/server'
import { getAllReviewResultsByDate } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({
        success: false,
        error: '날짜 파라미터가 필요합니다.'
      }, { status: 400 })
    }

    // 날짜 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({
        success: false,
        error: '올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'
      }, { status: 400 })
    }

    // 해당 날짜의 모든 검수 결과 가져오기 (채택 + 폐기)
    const reviewResults = await getAllReviewResultsByDate(date)

    return NextResponse.json({
      success: true,
      data: reviewResults,
      count: reviewResults.length
    })

  } catch (error) {
    console.error('Download API error:', error)
    return NextResponse.json({
      success: false,
      error: '데이터를 가져오는 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 