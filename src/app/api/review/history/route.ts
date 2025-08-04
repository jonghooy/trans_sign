import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const customOffset = searchParams.get('offset')
    const offset = customOffset ? parseInt(customOffset) : (page - 1) * limit

    // 채택된 데이터와 폐기된 데이터를 전체 조회 (작업자 정보 포함)
    const { data: acceptedData, error: acceptedError } = await supabase
      .from('accepted_data')
      .select('id, original_text, translated_text, created_at, task_id, reviewed_by, reviewed_at')
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const { data: rejectedData, error: rejectedError } = await supabase
      .from('rejected_data')
      .select('id, original_text, translated_text, created_at, task_id, reviewed_by, reviewed_at')
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (acceptedError) throw acceptedError
    if (rejectedError) throw rejectedError

    // 데이터 통합 및 정렬 (검수 시간 기준)
    const allData = [
      ...acceptedData.map(item => ({ ...item, status: 'accepted' as const })),
      ...rejectedData.map(item => ({ ...item, status: 'rejected' as const }))
    ].sort((a, b) => {
      // 검수 시간이 있으면 검수 시간 기준, 없으면 생성 시간 기준
      const dateA = new Date(a.reviewed_at || a.created_at).getTime()
      const dateB = new Date(b.reviewed_at || b.created_at).getTime()
      return dateB - dateA
    })

    const totalCount = allData.length

    // 페이지네이션 적용
    const paginatedData = allData.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        offset,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + limit < totalCount,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Review history API error:', error)
    return NextResponse.json(
      { error: '검수 이력을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 