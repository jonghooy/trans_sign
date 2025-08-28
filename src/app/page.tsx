'use client'

import React, { useState, useEffect } from 'react'
import { Upload, Download, Languages, FileText, Loader2, CheckCircle, XCircle, Activity, Cpu } from 'lucide-react'

interface TranslationResult {
  sentence_id: string
  korean_text: string
  human_translation?: string
  ai_translation: string
  check: string
  // 각 재시도 단계별 결과 추적
  attempt_1_result?: string  // 1차 시도 결과 (성공/실패 무관)
  attempt_2_result?: string  // 2차 재시도 결과 (있는 경우)
  attempt_3_result?: string  // 3차 재시도 결과 (있는 경우)
  final_status?: 'success_1st' | 'success_2nd' | 'success_3rd' | 'failed_all'  // 최종 상태
}

interface ModelInfo {
  success: boolean
  model_id: string
  model_type: string
  is_fine_tuned: boolean
  display_name: string
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationResults, setTranslationResults] = useState<TranslationResult[] | null>(null)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [currentTranslation, setCurrentTranslation] = useState<string>('')
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryStage, setRetryStage] = useState<{
    attempt: number
    currentCompleted: number
    totalForThisStage: number
    isRetry: boolean
  } | null>(null)

  // 모델 정보 가져오기
  const fetchModelInfo = async () => {
    try {
      const response = await fetch('/api/model-info')
      const data = await response.json()
      if (data.success) {
        setModelInfo(data)
      }
    } catch (error) {
      console.error('모델 정보 가져오기 실패:', error)
    }
  }

  // 컴포넌트 마운트 시 모델 정보 가져오기
  useEffect(() => {
    fetchModelInfo()
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTranslationResults(null)
      setError(null)
      setProgress({ current: 0, total: 0 })
      setCurrentTranslation('')
      setIsRetrying(false)
    }
  }

  const handleTranslate = async () => {
    if (!selectedFile) return

    setIsTranslating(true)
    setError(null)
    setProgress({ current: 0, total: 0 })
    setCurrentTranslation('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('/api/translate-csv', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('번역 요청 실패')
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 마지막 불완전한 줄 보관

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                
                if (data.type === 'progress') {
                  setProgress({ current: data.current, total: data.total })
                  setCurrentTranslation(data.currentText || '')
                  // 재시도 단계 정보 업데이트
                  if (data.retryStage) {
                    setRetryStage(data.retryStage)
                  }
                } else if (data.type === 'complete') {
                  setTranslationResults(data.results)
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                }
              } catch {
                console.warn('JSON 파싱 오류:', line)
              }
            }
          }
        }
      } else {
        // fallback: 일반 JSON 응답
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || '번역 처리 중 오류 발생')
        }
        setTranslationResults(data.results)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '번역 중 오류가 발생했습니다'
      setError(errorMessage)
    } finally {
      setIsTranslating(false)
      setCurrentTranslation('')
      setIsRetrying(false)
      setRetryStage(null)
    }
  }

  const handleRetryFailed = async () => {
    if (!translationResults || !selectedFile) return

    // 실패한 문장들만 추출 (final_status가 failed_all인 경우)
    const failedRows = translationResults.filter(r => r.final_status === 'failed_all')
    if (failedRows.length === 0) return

    setIsRetrying(true)
    setError(null)
    setProgress({ current: 0, total: failedRows.length })
    setCurrentTranslation('')
    setRetryStage(null)

    // 실패한 문장들을 CSV 형태로 변환
    const retryData = failedRows.map(row => ({
      sentence_id: row.sentence_id,
      korean_text: row.korean_text,
      human_translation: row.human_translation
    }))

    // CSV 문자열 생성
    const headers = ['sentence_id', 'korean_text', 'human_translation']
    const csvContent = [
      headers.join(','),
      ...retryData.map(row => [
        row.sentence_id,
        `"${row.korean_text.replace(/"/g, '""')}"`,
        `"${(row.human_translation || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    // FormData로 변환
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', blob, 'retry.csv')

    try {
      const response = await fetch('/api/translate-csv', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('재시도 요청 실패')
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                
                if (data.type === 'progress') {
                  setProgress({ current: data.current, total: data.total })
                  setCurrentTranslation(data.currentText || '')
                  // 재시도 단계 정보 업데이트
                  if (data.retryStage) {
                    setRetryStage(data.retryStage)
                  }
                } else if (data.type === 'complete') {
                  // 재시도 결과를 기존 결과에 병합
                  const retryResults = data.results
                  const updatedResults = [...translationResults]
                  
                  // 재시도 결과로 기존 실패 항목들 업데이트
                  retryResults.forEach((retryResult: TranslationResult) => {
                    const originalIndex = updatedResults.findIndex(r => r.sentence_id === retryResult.sentence_id)
                    if (originalIndex >= 0) {
                      updatedResults[originalIndex] = retryResult
                    }
                  })
                  
                  setTranslationResults(updatedResults)
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                }
              } catch {
                console.warn('JSON 파싱 오류:', line)
              }
            }
          }
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재시도 중 오류가 발생했습니다'
      setError(errorMessage)
    } finally {
      setIsRetrying(false)
      setCurrentTranslation('')
      setRetryStage(null)
    }
  }

  const handleDownload = () => {
    if (!translationResults) return

    // CSV 생성 (check 열 포함) - 통일된 형태로 출력
    const headers = [
      'sentence_id', // 원본이 문장번호더라도 통일된 형태로 출력
      'korean_text', // 원본이 정제 문장이더라도 통일된 형태로 출력  
      'human_translation',
      'ai_translation', 
      'check'
    ]
    const csvContent = [
      headers.join(','),
      ...translationResults.map(row => [
        row.sentence_id,
        `"${row.korean_text.replace(/"/g, '""')}"`,
        `"${(row.human_translation || '').replace(/"/g, '""')}"`,
        `"${row.ai_translation.replace(/"/g, '""')}"`,
        `"${row.check}"`
      ].join(','))
    ].join('\n')

    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${selectedFile?.name.replace('.csv', '')}_translated.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadFailed = () => {
    if (!translationResults) return

    // 1차, 2차, 3차 중 한 번이라도 시도한 문장들 필터링 (재시도 이력이 있는 문장들)
    const resultsWithRetryHistory = translationResults.filter(r => 
      r.attempt_1_result ||  // 1차 결과가 있거나
      r.attempt_2_result ||  // 2차 결과가 있거나  
      r.attempt_3_result ||  // 3차 결과가 있거나
      r.ai_translation.trim() === '' ||  // 최종 실패거나
      r.ai_translation.startsWith('[번역 실패') ||  // API 오류거나
      r.ai_translation.startsWith('[품질검증실패]') ||  // 품질검증 실패거나
      r.ai_translation.includes('차재시도실패]')  // 재시도 실패
    )

    if (resultsWithRetryHistory.length === 0) {
      alert('재시도 이력이 있는 문장이 없습니다.')
      return
    }

    // CSV 생성 (모든 재시도 결과 포함)
    const headers = [
      'sentence_id',
      'korean_text',
      'human_translation',
      'final_result',
      'final_status',
      'attempt_1_result',
      'attempt_2_result',
      'attempt_3_result',
      'analysis_notes'
    ]
    
    const csvContent = [
      headers.join(','),
      ...resultsWithRetryHistory.map(row => {
        // 재시도 이력 분석
        let analysisNotes = ''
        const finalStatus = row.final_status || 'unknown'
        
        // 각 단계별 시도 여부 확인
        const hasAttempt1 = !!row.attempt_1_result
        const hasAttempt2 = !!row.attempt_2_result  
        const hasAttempt3 = !!row.attempt_3_result
        
        if (finalStatus === 'success_1st') {
          if (hasAttempt1) {
            analysisNotes = '1차 시도에서 성공 (재시도 없음)'
          } else {
            analysisNotes = '1차 시도에서 성공'
          }
        } else if (finalStatus === 'success_2nd') {
          analysisNotes = `1차 실패 → 2차 성공${hasAttempt1 ? ' (1차 결과 분석 가능)' : ''}`
        } else if (finalStatus === 'success_3rd') {
          analysisNotes = `1,2차 실패 → 3차 성공${hasAttempt1 && hasAttempt2 ? ' (1,2차 결과 분석 가능)' : ''}`
        } else if (finalStatus === 'failed_all') {
          if (hasAttempt1 && hasAttempt2 && hasAttempt3) {
            analysisNotes = '1,2,3차 모든 시도 실패 (전체 과정 분석 가능)'
          } else if (hasAttempt1 && hasAttempt2) {
            analysisNotes = '1,2차 시도 실패, 3차 미시도'
          } else if (hasAttempt1) {
            analysisNotes = '1차 시도 실패, 재시도 미진행'
          } else {
            analysisNotes = 'API 오류로 번역 불가'
          }
        } else {
          analysisNotes = `상태: ${finalStatus}, 재시도 이력 있음`
        }
        
        return [
          row.sentence_id,
          `"${row.korean_text.replace(/"/g, '""')}"`,
          `"${(row.human_translation || '').replace(/"/g, '""')}"`,
          `"${(row.ai_translation || '').replace(/"/g, '""')}"`,
          `"${finalStatus}"`,
          `"${(row.attempt_1_result || '').replace(/"/g, '""')}"`,
          `"${(row.attempt_2_result || '').replace(/"/g, '""')}"`,
          `"${(row.attempt_3_result || '').replace(/"/g, '""')}"`,
          `"${analysisNotes.replace(/"/g, '""')}"`
        ].join(',')
      })
    ].join('\n')

    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${selectedFile?.name.replace('.csv', '')}_all_attempts_analysis.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <Languages className="w-16 h-16 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          CSV 수어 번역기
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          CSV 파일을 업로드하고 OpenAI 파인튜닝된 모델로 한국어를 수어로 번역하세요
        </p>
        
        {/* 모델 정보 */}
        {modelInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center mb-2">
              <Cpu className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">현재 사용 모델</span>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-900 mb-1">
                {modelInfo.display_name}
              </div>
              <div className="text-sm text-blue-700">
                {modelInfo.is_fine_tuned ? (
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    파인튜닝 모델 (ID: {modelInfo.model_id.slice(-10)}...)
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                    베이스 모델 ({modelInfo.model_type})
                  </span>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* 메인 카드 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
        {/* 단계 1: 파일 업로드 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">1</span>
            CSV 파일 선택
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isTranslating}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                isTranslating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <Upload className="w-4 h-4 mr-2" />
              CSV 파일 선택
            </label>
            {selectedFile && (
              <div className="mt-4 text-sm text-gray-600">
                선택된 파일: <span className="font-medium">{selectedFile.name}</span>
              </div>
            )}
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <p><strong>필수 컬럼:</strong> sentence_id (또는 문장번호), korean_text (또는 정제 문장)</p>
            <p><strong>선택적 컬럼:</strong> human_translation (또는 수어번역)</p>
            <p><strong>결과 컬럼:</strong> ai_translation, check (빈 값으로 생성됨)</p>
          </div>
        </div>

        {/* 단계 2: 번역 실행 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">2</span>
            번역 실행
          </h2>
          
          {/* 프로그래스 바 */}
          {isTranslating && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center mb-2">
                <Activity className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-blue-700 font-medium">번역 진행 중...</span>
                <span className="ml-auto text-blue-600 text-sm">
                  {progress.current}/{progress.total} ({Math.round(progressPercentage)}%)
                </span>
              </div>
              
              {/* 프로그래스 바 */}
              <div className="w-full bg-blue-200 rounded-full h-3 mb-3">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              
              {/* 현재 번역 중인 문장 */}
              {currentTranslation && (
                <div className="text-sm text-blue-600">
                  <span className="font-medium">
                    {retryStage?.isRetry ? `${retryStage.attempt}차 시도:` : '현재 번역 중:'}
                  </span> {currentTranslation.substring(0, 100)}...
                </div>
              )}
              
              {/* 재시도 단계별 프로그래스 */}
              {retryStage?.isRetry && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-orange-700">
                      {retryStage.attempt}차 재시도 진행 중
                    </span>
                    <span className="text-orange-600">
                      {retryStage.currentCompleted}/{retryStage.totalForThisStage}
                      ({Math.round((retryStage.currentCompleted / retryStage.totalForThisStage) * 100)}%)
                    </span>
                  </div>
                  {/* 재시도 단계 프로그래스 바 */}
                  <div className="w-full bg-orange-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ 
                        width: `${Math.round((retryStage.currentCompleted / retryStage.totalForThisStage) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleTranslate}
            disabled={!selectedFile || isTranslating || isRetrying}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
              !selectedFile || isTranslating || isRetrying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isTranslating || isRetrying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isRetrying ? 
                  (retryStage?.isRetry ? 
                    `${retryStage.attempt}차 재시도 중... (${retryStage.currentCompleted}/${retryStage.totalForThisStage})` :
                    `재시도 중... (${progress.current}/${progress.total})`
                  ) : 
                  `번역 중... (${progress.current}/${progress.total})`
                }
              </>
            ) : (
              <>
                <Languages className="w-5 h-5 mr-2" />
                번역 시작
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-red-700">
                  <span className="font-medium">오류:</span> {error}
                </div>
              </div>
            </div>
          )}

          {translationResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-2">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700 font-medium">
                  번역 완료! {translationResults.length}개 문장 처리
                </span>
              </div>
              <div className="text-sm text-green-600 space-y-1">
                <div className="flex justify-between">
                  <span>✅ 번역 성공 (1~3차 시도):</span>
                  <span className="font-medium">{translationResults.filter(r => r.final_status && ['success_1st', 'success_2nd', 'success_3rd'].includes(r.final_status)).length}개</span>
                </div>
                <div className="flex justify-between">
                  <span>🔄 3차 시도 후에도 품질검증 실패:</span>
                  <span className="font-medium text-orange-600">{translationResults.filter(r => r.final_status === 'failed_all').length}개</span>
                </div>
                {translationResults.filter(r => r.final_status === 'failed_all').length > 0 && (
                  <div className="text-xs text-gray-500 ml-4">
                    * 3차 시도 시 입력 패턴 변화(마침표 제거) 적용됨
                  </div>
                )}
                <div className="flex justify-between">
                  <span>❌ API 연결 오류:</span>
                  <span className="font-medium text-red-600">{translationResults.filter(r => r.ai_translation.startsWith('[번역 실패')).length}개</span>
                </div>
                <div className="mt-2 pt-2 border-t border-green-200">
                  <div className="flex justify-between text-xs text-green-500">
                    <span>성공률:</span>
                    <span className="font-medium">
                      {Math.round((translationResults.filter(r => !r.ai_translation.startsWith('[번역 실패') && r.ai_translation.trim() !== '').length / translationResults.length) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 재시도 버튼 및 분석 다운로드 */}
          {translationResults && (
            // 재시도 이력이 있는 문장이나 실패한 문장이 있으면 섹션 표시
            translationResults.filter(r => 
              r.attempt_1_result || r.attempt_2_result || r.attempt_3_result ||
              r.ai_translation.trim() === '' || 
              r.ai_translation.startsWith('[번역 실패') ||
              r.ai_translation.startsWith('[품질검증실패]') ||
              r.ai_translation.includes('차재시도실패]')
            ).length > 0
          ) && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-orange-800">
                    🔍 재시도 이력 및 분석
                  </h4>
                  <p className="text-sm text-orange-600 mt-1">
                    {translationResults.filter(r => 
                      r.attempt_1_result || r.attempt_2_result || r.attempt_3_result
                    ).length}개 문장에서 재시도가 수행되었습니다.
                    {translationResults.filter(r => r.final_status === 'failed_all').length > 0 && 
                      ` 그 중 ${translationResults.filter(r => r.final_status === 'failed_all').length}개는 여전히 실패 상태입니다.`
                    }
                  </p>
                </div>
              </div>
              
              {/* 재시도 버튼 (실패한 문장이 있을 때만) */}
              {translationResults.filter(r => r.final_status === 'failed_all').length > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={isTranslating || isRetrying}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors mb-3 ${
                    isTranslating || isRetrying
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {retryStage?.isRetry ? 
                        `${retryStage.attempt}차 시도 중... (${retryStage.currentCompleted}/${retryStage.totalForThisStage})` :
                        '실패 문장 재시도 중...'
                      }
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4 mr-2" />
                      실패한 {translationResults.filter(r => r.final_status === 'failed_all').length}개 문장 재시도
                    </>
                  )}
                </button>
              )}
              
              {/* 재시도 이력 분석 다운로드 버튼 */}
              <button
                onClick={handleDownloadFailed}
                disabled={isTranslating || isRetrying}
                className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isTranslating || isRetrying
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                재시도 이력 분석 다운로드 ({translationResults.filter(r => 
                  r.attempt_1_result ||  // 1차 결과가 있거나
                  r.attempt_2_result ||  // 2차 결과가 있거나  
                  r.attempt_3_result ||  // 3차 결과가 있거나
                  r.ai_translation.trim() === '' ||  // 최종 실패거나
                  r.ai_translation.startsWith('[번역 실패') ||  // API 오류거나
                  r.ai_translation.startsWith('[품질검증실패]') ||  // 품질검증 실패거나
                  r.ai_translation.includes('차재시도실패]')  // 재시도 실패
                ).length}개)
              </button>
            </div>
          )}
        </div>

        {/* 단계 3: 결과 다운로드 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">3</span>
            결과 다운로드
          </h2>
          <button
            onClick={handleDownload}
            disabled={!translationResults || isRetrying}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
              !translationResults || isRetrying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            <Download className="w-5 h-5 mr-2" />
            번역된 CSV 다운로드 (check 열 포함)
          </button>
          
          {translationResults && (
            <div className="mt-4 text-sm text-gray-600">
              <p><strong>다운로드 파일 형식:</strong></p>
              <p className="font-mono bg-gray-100 p-2 rounded text-xs">
                sentence_id(문장번호), korean_text(정제 문장), human_translation(수어번역), ai_translation, check
              </p>
              <p className="mt-2 text-green-600">✅ 다운로드 파일은 Excel에서도 한글이 깨지지 않습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 작업 흐름 설명 */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">사용법</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-blue-600">1단계:</span> sentence_id(문장번호), korean_text(정제 문장) 컬럼이 포함된 CSV 파일을 선택하세요.
          </div>
          <div>
            <span className="font-medium text-green-600">2단계:</span> 번역 시작 버튼을 클릭하여 OpenAI 모델로 번역하세요. 자동으로 1~3차 시도를 수행합니다.
          </div>
          <div>
            <span className="font-medium text-orange-600">재시도:</span> 3차 시도 후에도 실패한 문장이 있으면 재시도 버튼이 나타납니다. 선택적으로 추가 시도 가능합니다.
          </div>
          <div>
            <span className="font-medium text-red-600">이력분석:</span> 재시도가 수행된 문장들의 1차, 2차, 3차 결과를 모두 포함한 상세 분석 CSV를 다운로드할 수 있습니다. 3차 시도 후 모든 문장이 성공해도 1,2차 실패 결과 분석이 가능합니다.
          </div>
          <div>
            <span className="font-medium text-purple-600">3단계:</span> ai_translation과 check 컬럼이 추가된 CSV 파일을 다운로드하세요.
          </div>
        </div>
      </div>
    </div>
  )
}
