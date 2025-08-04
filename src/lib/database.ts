import { supabase } from './supabase'
import { TranslationTask, AcceptedData, RejectedData, ReviewStats, BulkUploadResult, CSVRow } from '@/types'

// 번역 작업 저장
export async function saveTranslationTask(
  originalText: string,
  translatedText: string,
  embedding: number[]
) {
  try {
    const { data, error } = await supabase
      .from('translation_tasks')
      .insert([
        {
          original_text: originalText,
          translated_text: translatedText,
          embedding: embedding,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving translation task:', error)
    throw error
  }
}

// 번역되지 않은 원문만 저장
export async function saveUntranslatedTask(originalText: string) {
  try {
    const { data, error } = await supabase
      .from('translation_tasks')
      .insert([
        {
          original_text: originalText,
          translated_text: null,
          embedding: null,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving untranslated task:', error)
    throw error
  }
}

// 검수 대기 중인 작업 조회 (번역된 것과 번역되지 않은 것 모두)
export async function getPendingTasks(limit: number = 10, offset: number = 0) {
  try {
    // 더 많은 데이터를 가져와서 클라이언트에서 정렬 후 슬라이싱
    const { data, error } = await supabase
      .from('translation_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    
    const allData = data || []
    
    // 클라이언트 사이드에서 sentence_id 기준으로 정렬
    const sortedData = allData.sort((a, b) => {
      // sentence_id가 있는 경우 숫자 부분 추출해서 비교
      if (a.sentence_id && b.sentence_id) {
        const numA = extractNumber(a.sentence_id)
        const numB = extractNumber(b.sentence_id)
        if (numA !== numB) {
          return numA - numB
        }
      }
      
      // sentence_id가 없거나 같은 경우 created_at으로 정렬
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    
    // offset과 limit 적용
    return sortedData.slice(offset, offset + limit)
  } catch (error) {
    console.error('Error fetching pending tasks:', error)
    throw error
  }
}

// sentence_id에서 숫자 부분 추출하는 헬퍼 함수
function extractNumber(sentenceId: string): number {
  const match = sentenceId.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

// 전체 pending 작업 개수 조회
export async function getPendingTasksCount() {
  try {
    const { count, error } = await supabase
      .from('translation_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error fetching pending tasks count:', error)
    throw error
  }
}

// 번역되지 않은 작업을 번역 완료 상태로 업데이트
export async function updateTaskWithTranslation(
  taskId: string,
  translatedText: string,
  embedding: number[]
) {
  try {
    const { error } = await supabase
      .from('translation_tasks')
      .update({ 
        translated_text: translatedText,
        embedding: embedding,
        status: 'pending'
      })
      .eq('id', taskId)

    if (error) throw error
  } catch (error) {
    console.error('Error updating task with translation:', error)
    throw error
  }
}

// 채택된 데이터 저장
export async function saveAcceptedData(
  originalText: string,
  translatedText: string,
  taskId: string,
  reviewedBy?: string
) {
  try {
    const { data, error } = await supabase
      .from('accepted_data')
      .insert([
        {
          original_text: originalText,
          translated_text: translatedText,
          task_id: taskId,
          reviewed_by: reviewedBy || null,
          reviewed_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving accepted data:', error)
    throw error
  }
}

// 폐기된 데이터 저장
export async function saveRejectedData(
  originalText: string,
  translatedText: string,
  taskId: string,
  reviewedBy?: string
) {
  try {
    const { data, error } = await supabase
      .from('rejected_data')
      .insert([
        {
          original_text: originalText,
          translated_text: translatedText,
          task_id: taskId,
          reviewed_by: reviewedBy || null,
          reviewed_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving rejected data:', error)
    throw error
  }
}

// 번역 작업 상태 업데이트
export async function updateTranslationTaskStatus(
  taskId: string,
  status: 'accepted' | 'rejected'
) {
  try {
    const { error } = await supabase
      .from('translation_tasks')
      .update({ status })
      .eq('id', taskId)

    if (error) throw error
  } catch (error) {
    console.error('Error updating task status:', error)
    throw error
  }
}

// 통계 데이터 조회
export async function getReviewStats(): Promise<ReviewStats> {
  try {
    const [acceptedResult, rejectedResult] = await Promise.all([
      supabase
        .from('accepted_data')
        .select('*', { count: 'exact' }),
      supabase
        .from('rejected_data')
        .select('*', { count: 'exact' })
    ])

    const acceptedCount = acceptedResult.count || 0
    const rejectedCount = rejectedResult.count || 0
    const totalProcessed = acceptedCount + rejectedCount
    const acceptanceRate = totalProcessed > 0 
      ? Math.round((acceptedCount / totalProcessed) * 100)
      : 0

    return {
      total_processed: totalProcessed,
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
      acceptance_rate: acceptanceRate
    }
  } catch (error) {
    console.error('Error fetching review stats:', error)
    throw error
  }
}

// 유사도 기반 번역 작업 검색
export async function findSimilarTranslations(
  embedding: number[],
  threshold: number = 0.8,
  limit: number = 5
) {
  try {
    const { data, error } = await supabase
      .rpc('match_translation_tasks', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit
      })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error finding similar translations:', error)
    throw error
  }
}

// 배치 번역 작업 저장
export async function saveBatchTranslationTasks(
  tasks: Array<{
    original_text: string
    translated_text: string
    embedding: number[]
  }>
) {
  try {
    const { data, error } = await supabase
      .from('translation_tasks')
      .insert(
        tasks.map(task => ({
          ...task,
          status: 'pending'
        }))
      )
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving batch translation tasks:', error)
    throw error
  }
}

// 날짜별 채택 데이터 조회
export async function getAcceptedDataByDate(date: string) {
  try {
    const startDate = new Date(date)
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 1)

    const { data, error } = await supabase
      .from('accepted_data')
      .select('original_text, translated_text, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching accepted data by date:', error)
    throw error
  }
}

// 채택과 폐기된 모든 검수 결과를 날짜별로 가져오는 함수
export async function getAllReviewResultsByDate(date: string) {
  try {
    const startDate = new Date(date)
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 1)

    // 채택된 데이터 가져오기
    const { data: acceptedData, error: acceptedError } = await supabase
      .from('accepted_data')
      .select('original_text, translated_text, created_at, accepted_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (acceptedError) throw acceptedError

    // 폐기된 데이터 가져오기
    const { data: rejectedData, error: rejectedError } = await supabase
      .from('rejected_data')
      .select('original_text, translated_text, created_at, rejected_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (rejectedError) throw rejectedError

    // 데이터 통합 및 정렬
    const allResults = [
      ...(acceptedData || []).map(item => ({
        ...item,
        status: 'accepted' as const,
        review_date: item.accepted_at
      })),
      ...(rejectedData || []).map(item => ({
        ...item,
        status: 'rejected' as const,
        review_date: item.rejected_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return allResults
  } catch (error) {
    console.error('Error fetching all review results by date:', error)
    throw error
  }
}

// === 대용량 업로드 관련 함수들 ===

// 문장 ID 중복 체크 (배치 처리)
export async function checkExistingSentences(sentenceIds: string[]): Promise<string[]> {
  try {
    const batchSize = 100 // 한 번에 100개씩 처리
    const existingSentenceIds: string[] = []
    
    // 배치별로 처리
    for (let i = 0; i < sentenceIds.length; i += batchSize) {
      const batch = sentenceIds.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('translation_tasks')
        .select('sentence_id')
        .in('sentence_id', batch)

      if (error) {
        console.error(`Error checking batch ${Math.floor(i / batchSize) + 1}:`, error)
        throw error
      }
      
      if (data) {
        const batchExisting = data.map(item => item.sentence_id).filter(Boolean)
        existingSentenceIds.push(...batchExisting)
      }
    }
    
    console.log(`중복 검사 완료: 총 ${sentenceIds.length}개 중 ${existingSentenceIds.length}개 중복 발견`)
    return existingSentenceIds
  } catch (error) {
    console.error('Error checking existing sentences:', error)
    throw error
  }
}

// 배치 업로드 (1000개씩 처리)
export async function saveBulkTranslationTasks(
  csvRows: CSVRow[],
  uploadBatchId: string,
  createdBy: string = 'system'
): Promise<BulkUploadResult> {
  const batchSize = 1000
  const totalRecords = csvRows.length
  let processedRecords = 0
  let failedRecords = 0
  const errors: Array<{ row: number; error: string; data?: any }> = []

  try {
    console.log(`중복 검사 시작: ${csvRows.length}개 문장 ID 확인`)
    
    // 중복 문장 ID 체크
    const existingSentenceIds = await checkExistingSentences(
      csvRows.map(row => row.sentence_id)
    )
    
    // 중복되지 않은 데이터만 필터링
    const newRows = csvRows.filter(row => !existingSentenceIds.includes(row.sentence_id))
    
    if (newRows.length === 0) {
      return {
        success: true,
        message: '모든 문장이 이미 존재합니다.',
        total_records: totalRecords,
        processed_records: 0,
        failed_records: 0,
        upload_batch_id: uploadBatchId
      }
    }

    // 배치별로 처리
    console.log(`데이터베이스 업로드 시작: ${newRows.length}개 행을 ${Math.ceil(newRows.length / batchSize)}개 배치로 처리`)
    
    for (let i = 0; i < newRows.length; i += batchSize) {
      const batch = newRows.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(newRows.length / batchSize)
      
      console.log(`배치 ${batchNumber}/${totalBatches} 처리 중 (${batch.length}개 행)`)
      
      try {
        const insertData = batch.map((row, index) => ({
          sentence_id: row.sentence_id,
          original_text: row.korean_text,
          translated_text: null, // AI 번역은 나중에 실시간으로
          human_translated_text: row.human_translation || null,
          source_type: 'csv_upload',
          upload_batch_id: uploadBatchId,
          created_by: createdBy,
          status: 'pending',
          embedding: null
        }))

        const { data, error } = await supabase
          .from('translation_tasks')
          .insert(insertData)

        if (error) {
          console.error(`배치 ${batchNumber} 실패:`, error)
          // 배치 전체 실패 시 개별 처리 시도
          for (let j = 0; j < batch.length; j++) {
            try {
              await supabase
                .from('translation_tasks')
                .insert([insertData[j]])
              processedRecords++
            } catch (individualError) {
              failedRecords++
              errors.push({
                row: i + j + 1,
                error: individualError instanceof Error ? individualError.message : 'Unknown error',
                data: batch[j]
              })
            }
          }
        } else {
          processedRecords += batch.length
          console.log(`배치 ${batchNumber} 성공: ${batch.length}개 행 업로드 완료`)
        }
              } catch (batchError) {
          console.error(`배치 ${batchNumber} 오류:`, batchError)
        failedRecords += batch.length
        batch.forEach((row, index) => {
          errors.push({
            row: i + index + 1,
            error: `배치 ${batchNumber} 처리 실패: ${batchError instanceof Error ? batchError.message : 'Unknown batch error'}`,
            data: row
          })
        })
      }
    }

    const result: BulkUploadResult = {
      success: failedRecords === 0,
      message: `총 ${totalRecords}개 중 ${processedRecords}개 성공, ${failedRecords}개 실패. 중복 제외: ${existingSentenceIds.length}개`,
      total_records: totalRecords,
      processed_records: processedRecords,
      failed_records: failedRecords,
      upload_batch_id: uploadBatchId,
      errors: errors.length > 0 ? errors : undefined
    }

    return result
  } catch (error) {
    console.error('Error in bulk upload:', error)
    throw error
  }
}

// 업로드 배치 정보 조회
export async function getUploadBatchInfo(uploadBatchId: string) {
  try {
    const { data, error } = await supabase
      .from('translation_tasks')
      .select('id, sentence_id, original_text, human_translated_text, created_at, status')
      .eq('upload_batch_id', uploadBatchId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching upload batch info:', error)
    throw error
  }
}

// 업로드 배치 통계
export async function getUploadBatchStats(uploadBatchId: string) {
  try {
    const { data, error } = await supabase
      .from('translation_tasks')
      .select('status, human_translated_text')
      .eq('upload_batch_id', uploadBatchId)

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      with_human_translation: data?.filter(item => item.human_translated_text).length || 0,
      pending: data?.filter(item => item.status === 'pending').length || 0,
      reviewed: data?.filter(item => item.status === 'reviewed').length || 0,
      accepted: data?.filter(item => item.status === 'accepted').length || 0,
      rejected: data?.filter(item => item.status === 'rejected').length || 0
    }

    return stats
  } catch (error) {
    console.error('Error fetching upload batch stats:', error)
    throw error
  }
}

// === DB 클리어 관련 함수들 ===

// 전체 데이터 클리어
export async function clearAllData() {
  try {
    // Foreign Key 제약 조건 때문에 자식 테이블부터 삭제
    const tables = ['accepted_data', 'rejected_data', 'translation_tasks']
    const results = []

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .gte('created_at', '1900-01-01') // 모든 행 삭제 (created_at은 모든 테이블에 있음)

      if (error) {
        console.error(`Error clearing ${table}:`, error)
        results.push({ table, success: false, error: error.message })
      } else {
        console.log(`Successfully cleared ${table}`)
        results.push({ table, success: true })
      }
    }

    return results
  } catch (error) {
    console.error('Error clearing all data:', error)
    throw error
  }
}

// 특정 업로드 배치 데이터만 클리어
export async function clearUploadBatchData(uploadBatchId: string) {
  try {
    // 먼저 해당 배치의 task_id들을 조회
    const { data: tasks, error: selectError } = await supabase
      .from('translation_tasks')
      .select('id')
      .eq('upload_batch_id', uploadBatchId)

    if (selectError) throw selectError

    const taskIds = tasks?.map(task => task.id) || []

    if (taskIds.length > 0) {
      // 1. 자식 테이블들에서 해당 task_id 참조 데이터 삭제
      await Promise.all([
        supabase.from('accepted_data').delete().in('task_id', taskIds),
        supabase.from('rejected_data').delete().in('task_id', taskIds)
      ])
    }

    // 2. 부모 테이블에서 배치 데이터 삭제
    const { error } = await supabase
      .from('translation_tasks')
      .delete()
      .eq('upload_batch_id', uploadBatchId)

    if (error) throw error

    return { success: true, message: `배치 ID ${uploadBatchId} 데이터가 삭제되었습니다.` }
  } catch (error) {
    console.error('Error clearing upload batch data:', error)
    throw error
  }
}

// CSV 업로드로 추가된 데이터만 클리어
export async function clearCSVUploadData() {
  try {
    // 먼저 CSV 업로드 데이터의 task_id들을 조회
    const { data: tasks, error: selectError } = await supabase
      .from('translation_tasks')
      .select('id')
      .eq('source_type', 'csv_upload')

    if (selectError) throw selectError

    const taskIds = tasks?.map(task => task.id) || []

    if (taskIds.length > 0) {
      // 1. 자식 테이블들에서 해당 task_id 참조 데이터 삭제
      await Promise.all([
        supabase.from('accepted_data').delete().in('task_id', taskIds),
        supabase.from('rejected_data').delete().in('task_id', taskIds)
      ])
    }

    // 2. 부모 테이블에서 CSV 업로드 데이터 삭제
    const { error } = await supabase
      .from('translation_tasks')
      .delete()
      .eq('source_type', 'csv_upload')

    if (error) throw error

    return { success: true, message: 'CSV 업로드 데이터가 모두 삭제되었습니다.' }
  } catch (error) {
    console.error('Error clearing CSV upload data:', error)
    throw error
  }
}

// 수동 입력 데이터만 클리어
export async function clearManualData() {
  try {
    // 먼저 수동 입력 데이터의 task_id들을 조회
    const { data: tasks, error: selectError } = await supabase
      .from('translation_tasks')
      .select('id')
      .eq('source_type', 'manual')

    if (selectError) throw selectError

    const taskIds = tasks?.map(task => task.id) || []

    if (taskIds.length > 0) {
      // 1. 자식 테이블들에서 해당 task_id 참조 데이터 삭제
      await Promise.all([
        supabase.from('accepted_data').delete().in('task_id', taskIds),
        supabase.from('rejected_data').delete().in('task_id', taskIds)
      ])
    }

    // 2. 부모 테이블에서 수동 입력 데이터 삭제
    const { error } = await supabase
      .from('translation_tasks')
      .delete()
      .eq('source_type', 'manual')

    if (error) throw error

    return { success: true, message: '수동 입력 데이터가 모두 삭제되었습니다.' }
  } catch (error) {
    console.error('Error clearing manual data:', error)
    throw error
  }
}

// DB 통계 조회 (클리어 전 확인용)
export async function getDatabaseStats() {
  try {
    const results = await Promise.all([
      // translation_tasks 통계
      supabase
        .from('translation_tasks')
        .select('source_type, status', { count: 'exact' }),
      
      // accepted_data 통계
      supabase
        .from('accepted_data')
        .select('*', { count: 'exact', head: true }),
      
      // rejected_data 통계
      supabase
        .from('rejected_data')
        .select('*', { count: 'exact', head: true })
    ])

    const [tasksResult, acceptedResult, rejectedResult] = results

    // translation_tasks 세부 통계
    const tasksByType: { [key: string]: number } = {}
    const tasksByStatus: { [key: string]: number } = {}
    
    if (tasksResult.data) {
      tasksResult.data.forEach(item => {
        const type = item.source_type || 'unknown'
        const status = item.status || 'unknown'
        
        tasksByType[type] = (tasksByType[type] || 0) + 1
        tasksByStatus[status] = (tasksByStatus[status] || 0) + 1
      })
    }

    return {
      translation_tasks: {
        total: tasksResult.count || 0,
        by_type: tasksByType,
        by_status: tasksByStatus
      },
      accepted_data: {
        total: acceptedResult.count || 0
      },
      rejected_data: {
        total: rejectedResult.count || 0
      }
    }
  } catch (error) {
    console.error('Error fetching database stats:', error)
    throw error
  }
} 