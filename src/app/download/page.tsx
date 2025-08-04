'use client'

import React, { useState } from 'react'
import { Calendar, Download, FileText, CheckCircle } from 'lucide-react'

export default function DownloadPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadHistory, setDownloadHistory] = useState<Array<{
    date: string
    timestamp: string
    count: number
  }>>([])

  const handleDownload = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 선택된 날짜의 모든 검수 결과 가져오기
      const response = await fetch(`/api/download?date=${selectedDate}`)
      
      if (!response.ok) {
        throw new Error('데이터를 가져오는데 실패했습니다.')
      }

      const data = await response.json()

      if (!data.success || data.data.length === 0) {
        setError('선택한 날짜에 다운로드할 데이터가 없습니다.')
        return
      }

      // CSV 데이터 생성
      const csvContent = generateCSV(data.data)
      
      // 파일 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `review_results_${selectedDate}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 다운로드 히스토리 추가
      setDownloadHistory(prev => [{
        date: selectedDate,
        timestamp: new Date().toLocaleString(),
        count: data.data.length
      }, ...prev.slice(0, 4)]) // 최근 5개까지만 저장

    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateCSV = (data: Array<{ 
    original_text: string; 
    translated_text: string; 
    created_at: string;
    status: 'accepted' | 'rejected';
    review_date: string;
  }>) => {
    // 채택된 항목과 폐기된 항목으로 분류하고 정렬
    const acceptedItems = data.filter(item => item.status === 'accepted')
    const rejectedItems = data.filter(item => item.status === 'rejected')
    
    // 채택된 항목을 먼저, 폐기된 항목을 나중에 배치
    const sortedData = [...acceptedItems, ...rejectedItems]
    
    const headers = ['검수상태', '원문', '번역문', '채택여부', '생성일시', '검수일시']
    
    // 구분선을 위한 빈 행과 섹션 헤더 추가
    const csvRows = []
    
    // 전체 헤더
    csvRows.push(headers.join(','))
    
    // 채택된 항목들
    if (acceptedItems.length > 0) {
      csvRows.push('') // 빈 행
      csvRows.push(`"=== 채택된 번역 (${acceptedItems.length}건) ===",,,,,"※ 고품질 번역으로 승인된 데이터"`)
      csvRows.push('') // 빈 행
      
      acceptedItems.forEach(row => {
        csvRows.push([
          `"✓ 채택"`,
          `"${row.original_text.replace(/"/g, '""')}"`,
          `"${row.translated_text.replace(/"/g, '""')}"`,
          `"Y"`,
          `"${new Date(row.created_at).toLocaleString()}"`,
          `"${new Date(row.review_date).toLocaleString()}"`
        ].join(','))
      })
    }
    
    // 폐기된 항목들
    if (rejectedItems.length > 0) {
      csvRows.push('') // 빈 행
      csvRows.push(`"=== 폐기된 번역 (${rejectedItems.length}건) ===",,,,,"※ 품질 부족으로 거부된 데이터"`)
      csvRows.push('') // 빈 행
      
      rejectedItems.forEach(row => {
        csvRows.push([
          `"✗ 폐기"`,
          `"${row.original_text.replace(/"/g, '""')}"`,
          `"${row.translated_text.replace(/"/g, '""')}"`,
          `"N"`,
          `"${new Date(row.created_at).toLocaleString()}"`,
          `"${new Date(row.review_date).toLocaleString()}"`
        ].join(','))
      })
    }
    
    return '\uFEFF' + csvRows.join('\n') // UTF-8 BOM 추가
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          검수 결과 다운로드
        </h1>
        
        <div className="space-y-6">
          {/* 날짜 선택 */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              다운로드할 날짜 선택
            </label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>
              
              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>{isLoading ? '다운로드 중...' : 'CSV 다운로드'}</span>
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* 안내 정보 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 mb-2">다운로드 안내</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 선택한 날짜에 검수된 모든 번역 데이터가 CSV 형식으로 다운로드됩니다.</li>
                  <li>• <strong>채택된 번역이 먼저, 폐기된 번역이 나중에</strong> 정렬되어 구분하기 쉽습니다.</li>
                  <li>• CSV 컬럼: 검수상태, 원문, 번역문, 채택여부(Y/N), 생성일시, 검수일시</li>
                  <li>• 각 섹션마다 구분선과 요약 정보가 포함됩니다.</li>
                  <li>• 파일명 형식: review_results_YYYY-MM-DD.csv</li>
                  <li>• UTF-8 인코딩으로 저장되어 한글이 올바르게 표시됩니다.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 다운로드 히스토리 */}
          {downloadHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                최근 다운로드 내역
              </h3>
              <div className="space-y-2">
                {downloadHistory.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.date} 데이터
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.count}개 항목 • {item.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 