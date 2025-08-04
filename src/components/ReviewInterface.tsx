'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { TranslationTask } from '@/types'
import { CheckCircle, XCircle, Loader2, Send, Play, BarChart3, Settings } from 'lucide-react'

interface ReviewInterfaceProps {
  onReviewComplete?: (taskId: string, action: 'accept' | 'reject') => void
  onStatsUpdate?: () => void
}

interface ReviewSelection {
  taskId: string
  action: 'pending' | 'accept' | 'reject'
}

interface WorkSessionStats {
  totalReviewed: number
  accepted: number
  rejected: number
  startedAt: string
  completedAt?: string
  startIndex: number
}

type WorkflowState = 'setup' | 'working' | 'completed'

export default function ReviewInterface({ onReviewComplete, onStatsUpdate }: ReviewInterfaceProps) {
  const [currentBatch, setCurrentBatch] = useState<TranslationTask[]>([])
  const [selections, setSelections] = useState<ReviewSelection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewCount, setReviewCount] = useState(0)
  const [hasNoMoreTasks, setHasNoMoreTasks] = useState(false)
  
  // 새로운 상태 변수들
  const [workflowState, setWorkflowState] = useState<WorkflowState>('setup')
  const [currentOffset, setCurrentOffset] = useState(0)
  const [startIndex, setStartIndex] = useState(1)
  const [reviewerName, setReviewerName] = useState('')
  const [sessionStats, setSessionStats] = useState<WorkSessionStats>({
    totalReviewed: 0,
    accepted: 0,
    rejected: 0,
    startedAt: '',
    startIndex: 1
  })
  const [showStatsModal, setShowStatsModal] = useState(false)

  // 작업 세션 시작
  const startWorkSession = async () => {
    setWorkflowState('working')
    setCurrentOffset(startIndex - 1) // 1-based to 0-based
    setSessionStats({
      totalReviewed: 0,
      accepted: 0,
      rejected: 0,
      startedAt: new Date().toISOString(),
      startIndex
    })
    await loadNextBatch(startIndex - 1)
  }

  // 다음 배치 로드
  const loadNextBatch = async (offset?: number) => {
    setIsLoading(true)
    setError(null)
    
    const actualOffset = offset !== undefined ? offset : currentOffset
    
    try {
      const response = await fetch(`/api/review/pending?limit=5&offset=${actualOffset}`)
      const data = await response.json()
      
      if (data.success && data.tasks.length > 0) {
        setCurrentBatch(data.tasks)
        // 모든 항목을 pending 상태로 초기화
        setSelections(data.tasks.map((task: TranslationTask) => ({
          taskId: task.id,
          action: 'pending' as const
        })))
        setHasNoMoreTasks(false)
      } else {
        setCurrentBatch([])
        setSelections([])
        setHasNoMoreTasks(true)
        // 더 이상 작업이 없으면 세션 완료
        if (workflowState === 'working') {
          completeWorkSession()
        }
      }
    } catch (err) {
      setError('검수 작업을 불러오는데 실패했습니다.')
      console.error('Error loading batch:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 작업 세션 완료
  const completeWorkSession = () => {
    setSessionStats(prev => ({
      ...prev,
      completedAt: new Date().toISOString()
    }))
    setWorkflowState('completed')
    setShowStatsModal(true)
  }

  // 새로운 세션 시작
  const resetSession = () => {
    setWorkflowState('setup')
    setCurrentBatch([])
    setSelections([])
    setCurrentOffset(0)
    setStartIndex(1)
    setReviewerName('')
    setReviewCount(0)
    setHasNoMoreTasks(false)
    setError(null)
  }

  // 개별 항목의 선택 변경
  const handleSelectionChange = (taskId: string, action: 'accept' | 'reject') => {
    setSelections(prev => 
      prev.map(selection => 
        selection.taskId === taskId 
          ? { ...selection, action }
          : selection
      )
    )
  }

  // 모든 선택이 완료되었는지 확인
  const isAllSelected = selections.length > 0 && selections.every(s => s.action !== 'pending')

  // 배치 제출
  const submitBatch = async () => {
    if (!isAllSelected || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
             // 각 항목을 개별적으로 제출
       const submitPromises = selections.map(async (selection) => {
         const task = currentBatch.find(t => t.id === selection.taskId)
         if (!task || selection.action === 'pending') return

         const response = await fetch('/api/review/submit', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             taskId: task.id,
             action: selection.action,
             originalText: task.original_text,
             translatedText: task.translated_text,
             reviewedBy: reviewerName,
           }),
         })

         const data = await response.json()
         if (data.success) {
           onReviewComplete?.(task.id, selection.action)
         }
         return data
       })

      await Promise.all(submitPromises)
      
      // 세션 통계 업데이트
      const acceptedCount = selections.filter(s => s.action === 'accept').length
      const rejectedCount = selections.filter(s => s.action === 'reject').length
      
      setSessionStats(prev => ({
        ...prev,
        totalReviewed: prev.totalReviewed + selections.length,
        accepted: prev.accepted + acceptedCount,
        rejected: prev.rejected + rejectedCount
      }))
      
      setReviewCount(prev => prev + selections.length)
      setCurrentOffset(prev => prev + selections.length)
      onStatsUpdate?.()
      
      // 다음 배치 로드 (현재 offset 사용)
      await loadNextBatch(currentOffset + selections.length)

    } catch (err) {
      setError('검수 제출 중 오류가 발생했습니다.')
      console.error('Error submitting batch:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 키보드 단축키 처리 (숫자 키로 선택)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isSubmitting || currentBatch.length === 0) return

      const key = event.key
      const index = parseInt(key) - 1

      if (index >= 0 && index < currentBatch.length) {
        const task = currentBatch[index]
        const currentSelection = selections.find(s => s.taskId === task.id)
        
        if (currentSelection) {
          // 순환: pending -> accept -> reject -> accept...
          let nextAction: 'accept' | 'reject'
          if (currentSelection.action === 'pending' || currentSelection.action === 'reject') {
            nextAction = 'accept'
          } else {
            nextAction = 'reject'
          }
          handleSelectionChange(task.id, nextAction)
        }
      }

      // Enter 키로 일괄 제출
      if (event.key === 'Enter' && isAllSelected) {
        event.preventDefault()
        submitBatch()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentBatch, selections, isSubmitting, isAllSelected])

  // 작업 설정 화면
  if (workflowState === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            번역 검수 작업 시작
          </h1>
          <p className="text-gray-600">
            검수할 작업의 시작 번호를 설정하고 작업을 시작하세요
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          {/* 작업자 이름 입력 */}
          <div>
            <label htmlFor="reviewerName" className="block text-sm font-medium text-gray-700 mb-2">
              작업자 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="reviewerName"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value.trim())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="검수자 이름을 입력하세요"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              검수 기록에 저장될 작업자 이름입니다
            </p>
          </div>

          {/* 시작 번호 설정 */}
          <div>
            <label htmlFor="startIndex" className="block text-sm font-medium text-gray-700 mb-2">
              시작 번호
            </label>
            <input
              type="number"
              id="startIndex"
              min="1"
              value={startIndex}
              onChange={(e) => setStartIndex(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1번부터 시작"
            />
            <p className="text-sm text-gray-500 mt-1">
              {startIndex}번째 작업부터 검수를 시작합니다
            </p>
          </div>

          {/* 안내사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Settings className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">작업 안내</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 작업은 ID 순서대로 진행됩니다</li>
                  <li>• 5개씩 배치로 처리됩니다</li>
                  <li>• 키보드 단축키: 1-5(선택), Enter(제출)</li>
                  <li>• 품질이 낮은 번역은 자동으로 제외됩니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 시작 버튼 */}
          <button
            onClick={startWorkSession}
            disabled={isLoading || !reviewerName.trim()}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            <span>
              {isLoading 
                ? '로딩 중...' 
                : !reviewerName.trim() 
                  ? '작업자 이름을 입력하세요'
                  : '검수 작업 시작'
              }
            </span>
          </button>
        </div>
      </div>
    )
  }

  // 로딩 화면
  if (isLoading && currentBatch.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">검수 작업을 준비하는 중...</p>
        <p className="text-sm text-gray-500">
          {startIndex}번부터 5개 작업을 로드하고 번역 처리 중입니다
        </p>
      </div>
    )
  }

  // 작업 완료된 경우 (작업 중일 때 더 이상 작업이 없는 경우)
  if (currentBatch.length === 0 && !isLoading && workflowState === 'working') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            모든 검수 작업이 완료되었습니다!
          </h3>
          <p className="text-gray-600 mb-4">
            현재 검수 대기 중인 번역 작업이 없습니다.
          </p>
          <button
            onClick={resetSession}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            새로운 세션 시작
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 진행 상태 표시 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <div className="flex space-x-6">
            <div className="text-sm text-gray-600">
              작업자: <span className="font-semibold text-indigo-600">{reviewerName}</span>
            </div>
            <div className="text-sm text-gray-600">
              시작번호: <span className="font-semibold text-purple-600">{sessionStats.startIndex}</span>
            </div>
            <div className="text-sm text-gray-600">
              세션 총계: <span className="font-semibold text-blue-600">{sessionStats.totalReviewed}</span>개
            </div>
            <div className="text-sm text-gray-600">
              채택: <span className="font-semibold text-green-600">{sessionStats.accepted}</span>
            </div>
            <div className="text-sm text-gray-600">
              폐기: <span className="font-semibold text-red-600">{sessionStats.rejected}</span>
            </div>
          </div>
          <button
            onClick={completeWorkSession}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            작업 완료
          </button>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="text-sm text-gray-600">
              현재 배치: <span className="font-semibold text-green-600">{currentBatch.length}</span>개
            </div>
            <div className="text-sm text-gray-600">
              현재 위치: <span className="font-semibold text-indigo-600">
                {sessionStats.startIndex + sessionStats.totalReviewed}~{sessionStats.startIndex + sessionStats.totalReviewed + currentBatch.length - 1}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              배치 선택: <span className="font-semibold text-purple-600">
                {selections.filter(s => s.action !== 'pending').length}
              </span>/{currentBatch.length}개
            </div>
          </div>
          <div className="text-sm text-gray-500">
            단축키: 1-5(선택) | Enter(제출)
          </div>
        </div>
      </div>

      {/* 자동 품질 검사 안내 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">자동 품질 검사</h4>
            <p className="text-sm text-blue-700">
              의미 없는 날짜 정보나 부적절한 내용이 포함된 번역은 자동으로 폐기 처리되어 검수 대상에서 제외됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 번역 항목들 */}
      <div className="space-y-4">
        {currentBatch.map((task, index) => {
          const selection = selections.find(s => s.taskId === task.id)
          const isSelected = selection?.action !== 'pending'
          
          return (
            <div 
              key={task.id} 
              className={`bg-white p-6 rounded-lg shadow-sm border-2 transition-colors ${
                isSelected 
                  ? selection?.action === 'accept' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-red-500 bg-red-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
                  {/* 상단 메타 정보 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-500">키: {index + 1}</span>
                      {task.sentence_id && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">|</span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            ID: {task.sentence_id}
                          </span>
                        </div>
                      )}
                    </div>
                    {task.source_type === 'csv_upload' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        CSV 업로드
                      </span>
                    )}
                  </div>
                  
                  <div className={`grid grid-cols-1 gap-6 ${task.human_translated_text ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                    {/* 한국어 원문 */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        한국어 원문
                      </h4>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800 leading-relaxed">
                          {task.original_text}
                        </p>
                      </div>
                    </div>

                    {/* AI 수어 번역 결과 */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        <span className="flex items-center space-x-2">
                          <span>AI 수어 번역</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                            자동
                          </span>
                        </span>
                      </h4>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-gray-800 leading-relaxed">
                          {task.translated_text}
                        </p>
                      </div>
                    </div>

                    {/* 사람이 번역한 수어 (있는 경우만) */}
                    {task.human_translated_text && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          <span className="flex items-center space-x-2">
                            <span>사람 수어 번역</span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                              검증됨
                            </span>
                          </span>
                        </h4>
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-gray-800 leading-relaxed">
                            {task.human_translated_text}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 선택 버튼 */}
                <div className="ml-6 flex flex-col space-y-2">
                  <button
                    onClick={() => handleSelectionChange(task.id, 'accept')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      selection?.action === 'accept'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>채택</span>
                  </button>
                  
                  <button
                    onClick={() => handleSelectionChange(task.id, 'reject')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      selection?.action === 'reject'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>폐기</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 일괄 제출 버튼 */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={submitBatch}
          disabled={!isAllSelected || isSubmitting}
          className={`flex items-center space-x-2 px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
            isAllSelected && !isSubmitting
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-6 h-6" />
          <span>
            {isSubmitting 
              ? '제출 중...' 
              : isAllSelected 
                ? `${selections.length}개 항목 일괄 제출` 
                : '모든 항목을 선택하세요'
            }
          </span>
        </button>
      </div>

      {/* 로딩 오버레이 */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-gray-700">검수 처리 중...</span>
          </div>
        </div>
      )}

      {/* 작업 완료 통계 모달 */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center mb-6">
              <BarChart3 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                작업 완료!
              </h3>
              <p className="text-gray-600">
                검수 세션이 완료되었습니다
              </p>
            </div>

            {/* 통계 정보 */}
            <div className="space-y-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {sessionStats.totalReviewed}
                  </div>
                  <div className="text-sm text-blue-700">총 검수 완료</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {sessionStats.accepted}
                  </div>
                  <div className="text-sm text-green-700">채택</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600 mb-1">
                    {sessionStats.rejected}
                  </div>
                  <div className="text-sm text-red-700">폐기</div>
                </div>
              </div>

              {/* 작업 시간 */}
              {sessionStats.startedAt && sessionStats.completedAt && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>시작 시간: {new Date(sessionStats.startedAt).toLocaleString()}</div>
                    <div>완료 시간: {new Date(sessionStats.completedAt).toLocaleString()}</div>
                    <div>소요 시간: {Math.round((new Date(sessionStats.completedAt).getTime() - new Date(sessionStats.startedAt).getTime()) / 1000 / 60)}분</div>
                  </div>
                </div>
              )}

              {/* 작업 범위 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-700 text-center">
                  <div className="font-medium">작업 범위</div>
                  <div>{sessionStats.startIndex}번 ~ {sessionStats.startIndex + sessionStats.totalReviewed - 1}번</div>
                </div>
              </div>

              {/* 작업자 정보 */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="text-sm text-indigo-700 text-center">
                  <div className="font-medium">검수자</div>
                  <div>{reviewerName}</div>
                </div>
              </div>
            </div>

            {/* 버튼들 */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowStatsModal(false)
                  resetSession()
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                새로운 세션 시작
              </button>
              <button
                onClick={() => setShowStatsModal(false)}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                모달 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 