import { NextRequest, NextResponse } from 'next/server'
import { 
  clearAllData, 
  clearCSVUploadData, 
  clearManualData, 
  clearUploadBatchData,
  getDatabaseStats 
} from '@/lib/database'

// DB 클리어 API
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clearType = searchParams.get('type')
    const batchId = searchParams.get('batchId')

    if (!clearType) {
      return NextResponse.json({
        success: false,
        error: 'type 파라미터가 필요합니다. (all, csv_upload, manual, batch)'
      }, { status: 400 })
    }

    let result

    switch (clearType) {
      case 'all':
        result = await clearAllData()
        break
      
      case 'csv_upload':
        result = await clearCSVUploadData()
        break
      
      case 'manual':
        result = await clearManualData()
        break
      
      case 'batch':
        if (!batchId) {
          return NextResponse.json({
            success: false,
            error: 'batch 타입에는 batchId 파라미터가 필요합니다.'
          }, { status: 400 })
        }
        result = await clearUploadBatchData(batchId)
        break
      
      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 타입입니다. (all, csv_upload, manual, batch)'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      result,
      message: `${clearType} 데이터가 성공적으로 삭제되었습니다.`
    })

  } catch (error) {
    console.error('Database clear API error:', error)
    return NextResponse.json({
      success: false,
      error: '데이터 삭제 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// DB 통계 조회 API
export async function GET(request: NextRequest) {
  try {
    const stats = await getDatabaseStats()
    
    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Database stats API error:', error)
    return NextResponse.json({
      success: false,
      error: '데이터베이스 통계 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 