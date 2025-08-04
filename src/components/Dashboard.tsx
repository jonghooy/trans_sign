'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ReviewStats } from '@/types'
import { BarChart3, CheckCircle, XCircle, TrendingUp, RefreshCw, ChevronLeft, ChevronRight, Calendar, FileText } from 'lucide-react'

interface ReviewHistoryItem {
  id: number
  original_text: string
  translated_text: string
  created_at: string
  task_id: number
  status: 'accepted' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
}

interface ReviewHistoryData {
  success: boolean
  data: ReviewHistoryItem[]
  pagination: {
    page: number
    limit: number
    offset: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface DashboardProps {
  onStatsUpdate?: (stats: ReviewStats) => void
}

export default function Dashboard({ onStatsUpdate }: DashboardProps) {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  
  // 검수 이력 관련 상태
  const [historyData, setHistoryData] = useState<ReviewHistoryData | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setLastUpdated(new Date())
        onStatsUpdate?.(data.stats)
      } else {
        setError('통계를 불러오는데 실패했습니다.')
      }
    } catch (err) {
      setError('통계를 불러오는 중 오류가 발생했습니다.')
      console.error('Error fetching stats:', err)
    } finally {
      setIsLoading(false)
    }
  }, [onStatsUpdate])

  const fetchHistory = useCallback(async (page: number = 1, offset?: number) => {
    if (!showHistory) return
    
    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const actualOffset = offset !== undefined ? offset : (page - 1) * pageSize
      const response = await fetch(`/api/review/history?page=${page}&limit=${pageSize}&offset=${actualOffset}`)
      const data = await response.json()

      if (data.success) {
        setHistoryData(data)
      } else {
        setHistoryError('검수 이력을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      setHistoryError('검수 이력을 불러오는 중 오류가 발생했습니다.')
      console.error('Error fetching history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [pageSize, showHistory])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    fetchHistory(page)
  }, [fetchHistory])

  const toggleHistory = useCallback(() => {
    const newShowHistory = !showHistory
    setShowHistory(newShowHistory)
    
    if (newShowHistory && !historyData) {
      setCurrentPage(1)
      fetchHistory(1)
    }
  }, [showHistory, historyData, fetchHistory])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (showHistory) {
      fetchHistory(currentPage)
    }
  }, [showHistory, currentPage, fetchHistory])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchStats}
              className="ml-auto text-red-600 hover:text-red-700 underline"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">전체 처리</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_processed || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-gray-500">처리 완료: </span>
            <span className="font-medium text-gray-900">{((stats?.accepted_count || 0) + (stats?.rejected_count || 0))}건</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">채택된 번역</p>
              <p className="text-2xl font-bold text-green-600">{stats?.accepted_count || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-gray-500">채택률: </span>
            <span className="font-medium text-green-600">
              {stats ? `${stats.acceptance_rate}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">폐기된 번역</p>
              <p className="text-2xl font-bold text-red-600">{stats?.rejected_count || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-gray-500">폐기율: </span>
            <span className="font-medium text-red-600">
              {stats ? `${100 - stats.acceptance_rate}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
                          <p className="text-sm font-medium text-gray-600">검수 완료</p>
            <p className="text-2xl font-bold text-purple-600">{((stats?.accepted_count || 0) + (stats?.rejected_count || 0))}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-gray-500">진행률: </span>
            <span className="font-medium text-purple-600">
              {stats?.total_processed && stats.total_processed > 0 
                ? `${Math.round(((stats.accepted_count + stats.rejected_count) / stats.total_processed) * 100)}%`
                : '0%'
              }
            </span>
          </div>
        </div>
      </div>

      {/* 업데이트 정보 및 새로고침 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>
            마지막 업데이트: {lastUpdated ? formatTime(lastUpdated.toISOString()) : '없음'}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleHistory}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              showHistory 
                ? 'bg-blue-600 text-white' 
                : 'text-blue-600 border border-blue-600 hover:bg-blue-50'
            }`}
          >
            {showHistory ? '검수 이력 숨기기' : '검수 이력 보기'}
          </button>
          
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-600">{error}</p>
          </div>
        </div>
      )}

      {/* 검수 이력 */}
      {showHistory && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                검수 이력
              </h3>
              <div className="flex items-center space-x-3">
                {historyData?.pagination && (
                  <span className="text-sm text-gray-500">
                    총 {historyData.pagination.total}건
                  </span>
                )}
                <button
                  onClick={() => fetchHistory(currentPage)}
                  disabled={historyLoading}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                  <span>새로고침</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {historyLoading && !historyData && (
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            )}

            {historyError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-600">{historyError}</p>
                </div>
              </div>
            )}

            {historyData && historyData.data.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                검수 이력이 없습니다.
              </div>
            )}

            {historyData && historyData.data.length > 0 && (
              <div className="space-y-3">
                {historyData.data.map((item, index) => {
                  const isAccepted = item.status === 'accepted'
                  const currentNumber = (currentPage - 1) * pageSize + index + 1
                  
                  return (
                    <div 
                      key={`${item.status}-${item.id}`} 
                      className={`border rounded-lg p-4 ${
                        isAccepted 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="bg-gray-100 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                              {currentNumber}
                            </span>
                            <div className="flex items-center space-x-2">
                              {isAccepted ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className={`text-sm font-medium ${
                                isAccepted ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {isAccepted ? '채택됨' : '폐기됨'}
                              </span>
                              {item.reviewed_by && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isAccepted 
                                    ? 'bg-green-200 text-green-800' 
                                    : 'bg-red-200 text-red-800'
                                }`}>
                                  {item.reviewed_by === 'system-auto' ? '자동' : item.reviewed_by}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 text-right">
                            {item.reviewed_at && (
                              <div>검수: {formatTime(item.reviewed_at)}</div>
                            )}
                            <div>생성: {formatTime(item.created_at)}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-sm">원문</p>
                            <p className="text-gray-600 bg-white p-3 rounded border text-sm leading-relaxed">
                              {item.original_text}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-sm">번역문</p>
                            <p className="text-gray-600 bg-white p-3 rounded border text-sm leading-relaxed">
                              {item.translated_text}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            {historyData && historyData.pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  페이지 {historyData.pagination.page} / {historyData.pagination.totalPages}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!historyData.pagination.hasPrev}
                    className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>이전</span>
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {/* 페이지 번호들 */}
                    {Array.from({ length: Math.min(5, historyData.pagination.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, currentPage - 2) + i
                      if (pageNum > historyData.pagination.totalPages) return null
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm rounded ${
                            pageNum === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!historyData.pagination.hasNext}
                    className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>다음</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 