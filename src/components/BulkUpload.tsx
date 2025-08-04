'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Download, Info, Trash2, Database } from 'lucide-react'
import { BulkUploadResult } from '@/types'

interface BulkUploadProps {
  onUploadComplete?: (result: BulkUploadResult) => void
}

interface DatabaseStats {
  translation_tasks: {
    total: number
    by_type: { [key: string]: number }
    by_status: { [key: string]: number }
  }
  accepted_data: { total: number }
  rejected_data: { total: number }
}

interface ClearConfirmModal {
  isOpen: boolean
  type: 'all' | 'csv_upload' | 'manual' | null
  stats?: DatabaseStats
}

export default function BulkUpload({ onUploadComplete }: BulkUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('system')
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isClearingData, setIsClearingData] = useState(false)
  const [clearConfirm, setClearConfirm] = useState<ClearConfirmModal>({
    isOpen: false,
    type: null
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // DB 통계 로드
  const loadDatabaseStats = async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch('/api/database/clear')
      const result = await response.json()
      
      if (result.success) {
        setDatabaseStats(result.stats)
      } else {
        console.error('Failed to load database stats:', result.error)
      }
    } catch (err) {
      console.error('Error loading database stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // 컴포넌트 마운트 시 DB 통계 로드
  useEffect(() => {
    loadDatabaseStats()
  }, [])

  // 데이터 클리어 확인 다이얼로그 열기
  const openClearConfirm = async (type: 'all' | 'csv_upload' | 'manual') => {
    await loadDatabaseStats() // 최신 통계 로드
    setClearConfirm({
      isOpen: true,
      type,
      stats: databaseStats || undefined
    })
  }

  // 데이터 클리어 실행
  const executeClear = async () => {
    if (!clearConfirm.type) return

    setIsClearingData(true)
    try {
      const response = await fetch(`/api/database/clear?type=${clearConfirm.type}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // 성공 시 통계 다시 로드
        await loadDatabaseStats()
        setClearConfirm({ isOpen: false, type: null })
        setError(null)
      } else {
        setError(result.error || '데이터 삭제에 실패했습니다.')
      }
    } catch (err) {
      setError('데이터 삭제 중 오류가 발생했습니다.')
      console.error('Clear data error:', err)
    } finally {
      setIsClearingData(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      console.log('업로드 시작:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        createdBy
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('createdBy', createdBy)

      const response = await fetch('/api/upload/bulk', {
        method: 'POST',
        body: formData,
      })

      console.log('응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('서버 응답 오류:', errorText)
        setError(`서버 오류 (${response.status}): ${errorText}`)
        return
      }

      const result: BulkUploadResult = await response.json()
      console.log('업로드 결과:', result)

      if (result.success) {
        setUploadResult(result)
        onUploadComplete?.(result)
        // 업로드 완료 후 DB 통계 새로고침
        await loadDatabaseStats()
      } else {
        setError(result.message || '업로드에 실패했습니다.')
      }

    } catch (err) {
      console.error('Upload error:', err)
      if (err instanceof Error) {
        setError(`업로드 오류: ${err.message}`)
      } else {
        setError('업로드 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setIsUploading(false)
    }
  }

  const downloadSampleCSV = () => {
    const csvContent = `sentence_id,korean_text,human_translation
SENT_000001,"안녕하세요","{안녕}+{하다}"
SENT_000002,"오늘 날씨가 좋네요",""
SENT_000003,"감사합니다","{감사}+{하다}"
SENT_000004,"수어를 배우고 있어요","{수어}+{배우다}+{진행형}"
SENT_000005,"도움이 필요해요","{도움}+{필요}+{하다}"`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', 'sample_upload.csv')
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadTestCSV = () => {
    const csvContent = `sentence_id,korean_text,human_translation
TEST_001,"테스트 문장입니다","{테스트}+{문장}"
TEST_002,"업로드 테스트",""
TEST_003,"정상 작동 확인","{정상}+{작동}+{확인}"`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', 'test_upload.csv')
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          대용량 CSV 업로드
        </h1>
        <p className="text-gray-600">
          21만 문장까지 지원하는 배치 업로드 시스템
        </p>
      </div>

      {/* CSV 형식 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Info className="w-6 h-6 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-800 mb-2">CSV 파일 형식</h3>
            <div className="space-y-2 text-sm text-blue-700">
              <p><strong>필수 컬럼:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><code>sentence_id</code>: 고유 문장 번호 (예: SENT_000001)</li>
                <li><code>korean_text</code>: 한국어 원문</li>
              </ul>
              <p><strong>선택 컬럼:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><code>human_translation</code>: 사람이 번역한 수어 번역문 (있으면 표시)</li>
              </ul>
            </div>
            <div className="mt-4 space-x-3">
              <button
                onClick={downloadSampleCSV}
                className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                샘플 CSV 다운로드
              </button>
              <button
                onClick={downloadTestCSV}
                className="inline-flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                테스트 CSV (3줄)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 현재 데이터베이스 상태 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            현재 데이터베이스 상태
          </h3>
          <button
            onClick={loadDatabaseStats}
            disabled={isLoadingStats}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            {isLoadingStats ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        {databaseStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {databaseStats.translation_tasks.total}
              </div>
              <div className="text-sm text-blue-700">번역 작업</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {databaseStats.accepted_data.total}
              </div>
              <div className="text-sm text-green-700">채택된 번역</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">
                {databaseStats.rejected_data.total}
              </div>
              <div className="text-sm text-red-700">폐기된 번역</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {databaseStats.translation_tasks.by_type?.csv_upload || 0}
              </div>
              <div className="text-sm text-purple-700">CSV 업로드</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {isLoadingStats ? '데이터 로딩 중...' : '데이터를 불러올 수 없습니다.'}
          </div>
        )}

        {/* 데이터 클리어 옵션 */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Trash2 className="w-4 h-4 mr-2" />
            업로드 전 데이터 정리
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => openClearConfirm('csv_upload')}
              disabled={isClearingData || isUploading}
              className="flex items-center justify-center px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              CSV 업로드 데이터만
            </button>
            <button
              onClick={() => openClearConfirm('manual')}
              disabled={isClearingData || isUploading}
              className="flex items-center justify-center px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              수동 입력 데이터만
            </button>
            <button
              onClick={() => openClearConfirm('all')}
              disabled={isClearingData || isUploading}
              className="flex items-center justify-center px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              전체 데이터
            </button>
          </div>
        </div>
      </div>

      {/* 업로드 사용자 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label htmlFor="createdBy" className="block text-sm font-medium text-gray-700 mb-2">
          업로드 담당자
        </label>
        <input
          type="text"
          id="createdBy"
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          placeholder="업로드 담당자 이름"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isUploading}
        />
      </div>

      {/* 파일 업로드 영역 */}
      <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8">
        <div className="text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">업로드 처리 중...</h3>
                <p className="text-gray-600">
                  대용량 파일을 배치로 처리하고 있습니다. 잠시만 기다려주세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileText className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CSV 파일 선택</h3>
                <p className="text-gray-600">
                  최대 100MB, 21만 문장까지 업로드 가능
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Upload className="w-5 h-5 mr-2" />
                CSV 파일 선택
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800">업로드 실패</h4>
              <p className="text-red-700 mb-2">{error}</p>
              <div className="text-sm text-red-600">
                <p>• 브라우저 개발자 도구(F12) → 콘솔에서 더 자세한 오류 정보를 확인하세요.</p>
                <p>• CSV 파일 형식: sentence_id, korean_text, human_translation</p>
                <p>• 파일 크기 제한: 100MB 이하</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 결과 */}
      {uploadResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">업로드 완료</h3>
              <p className="text-gray-600">{uploadResult.message}</p>
            </div>
          </div>

          {/* 통계 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {uploadResult.total_records}
              </div>
              <div className="text-sm text-blue-700">총 레코드</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {uploadResult.processed_records}
              </div>
              <div className="text-sm text-green-700">성공</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {uploadResult.failed_records}
              </div>
              <div className="text-sm text-red-700">실패</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((uploadResult.processed_records / uploadResult.total_records) * 100)}%
              </div>
              <div className="text-sm text-purple-700">성공률</div>
            </div>
          </div>

          {/* 에러 목록 */}
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">처리 실패 항목</h4>
              <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                {uploadResult.errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm text-red-600 mb-1">
                    Row {error.row}: {error.error}
                  </div>
                ))}
                {uploadResult.errors.length > 10 && (
                  <div className="text-sm text-gray-500 mt-2">
                    ... 그 외 {uploadResult.errors.length - 10}개 더
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 배치 ID */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>업로드 배치 ID:</strong> {uploadResult.upload_batch_id}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              이 ID로 업로드된 데이터를 추적할 수 있습니다.
            </div>
          </div>
        </div>
      )}

      {/* 데이터 클리어 확인 모달 */}
      {clearConfirm.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">
                데이터 삭제 확인
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                정말로 {clearConfirm.type === 'all' ? '모든 데이터' 
                : clearConfirm.type === 'csv_upload' ? 'CSV 업로드 데이터' 
                : '수동 입력 데이터'}를 삭제하시겠습니까?
              </p>

              {clearConfirm.stats && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">삭제될 데이터:</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    {clearConfirm.type === 'all' && (
                      <>
                        <div>• 번역 작업: {clearConfirm.stats.translation_tasks.total}개</div>
                        <div>• 채택된 번역: {clearConfirm.stats.accepted_data.total}개</div>
                        <div>• 폐기된 번역: {clearConfirm.stats.rejected_data.total}개</div>
                      </>
                    )}
                    {clearConfirm.type === 'csv_upload' && (
                      <div>• CSV 업로드 데이터: {clearConfirm.stats.translation_tasks.by_type?.csv_upload || 0}개</div>
                    )}
                    {clearConfirm.type === 'manual' && (
                      <div>• 수동 입력 데이터: {clearConfirm.stats.translation_tasks.by_type?.manual || 0}개</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  ⚠️ <strong>주의:</strong> 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setClearConfirm({ isOpen: false, type: null })}
                disabled={isClearingData}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeClear}
                disabled={isClearingData}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {isClearingData ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  '삭제 확인'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 