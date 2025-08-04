import { NextRequest, NextResponse } from 'next/server'
import { getReviewStats } from '@/lib/database'

export async function GET(request: NextRequest) {
    try {
    const stats = await getReviewStats()
    
    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: '통계 데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 