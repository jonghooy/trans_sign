'use client'

import React, { useState } from 'react'
import { Upload, Download, Languages, FileText, Loader2, CheckCircle, XCircle, Activity } from 'lucide-react'

interface TranslationResult {
  sentence_id: string
  korean_text: string
  human_translation?: string
  ai_translation: string
  check: string
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationResults, setTranslationResults] = useState<TranslationResult[] | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [currentTranslation, setCurrentTranslation] = useState<string>('')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTranslationResults(null)
      setError(null)
      setProgress({ current: 0, total: 0 })
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
                } else if (data.type === 'complete') {
                  setTranslationResults(data.results)
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                }
              } catch (e) {
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
      setError(error instanceof Error ? error.message : '번역 중 오류가 발생했습니다')
    } finally {
      setIsTranslating(false)
      setCurrentTranslation('')
    }
  }

  const handleDownload = () => {
    if (!translationResults) return

    // CSV 생성 (check 열 포함)
    const headers = ['sentence_id', 'korean_text', 'human_translation', 'ai_translation', 'check']
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

    // 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${selectedFile?.name.replace('.csv', '')}_translated.csv`)
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
            <p><strong>필수 컬럼:</strong> sentence_id, korean_text</p>
            <p><strong>선택적 컬럼:</strong> human_translation</p>
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
                  <span className="font-medium">현재 번역 중:</span> {currentTranslation.substring(0, 100)}...
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleTranslate}
            disabled={!selectedFile || isTranslating}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
              !selectedFile || isTranslating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                번역 중... ({progress.current}/{progress.total})
              </>
            ) : (
              <>
                <Languages className="w-5 h-5 mr-2" />
                번역 시작
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {translationResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-green-700">
                번역 완료! {translationResults.length}개 문장이 번역되었습니다.
              </span>
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
            disabled={!translationResults}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
              !translationResults
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
                sentence_id, korean_text, human_translation, ai_translation, check
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 작업 흐름 설명 */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">사용법</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-blue-600">1단계:</span> sentence_id, korean_text 컬럼이 포함된 CSV 파일을 선택하세요.
          </div>
          <div>
            <span className="font-medium text-green-600">2단계:</span> 번역 시작 버튼을 클릭하여 OpenAI 모델로 번역하세요. 실시간 진행률을 확인할 수 있습니다.
          </div>
          <div>
            <span className="font-medium text-purple-600">3단계:</span> ai_translation과 check 컬럼이 추가된 CSV 파일을 다운로드하세요.
          </div>
        </div>
      </div>
    </div>
  )
}
