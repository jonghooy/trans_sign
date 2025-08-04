'use client'

import React, { useState, useRef } from 'react'
import { Upload, File, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { FileUploadResult } from '@/types'

interface FileUploadProps {
  onUploadComplete?: (result: FileUploadResult) => void
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
      setError('CSV 또는 TXT 파일만 업로드 가능합니다.')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB 제한
      setError('파일 크기는 5MB를 초과할 수 없습니다.')
      return
    }

    setSelectedFile(file)
    setError(null)
    setUploadResult(null)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setUploadResult(data)
        onUploadComplete?.(data)
      } else {
        setError(data.error || '파일 업로드에 실패했습니다.')
      }
    } catch (err) {
      setError('파일 업로드 중 오류가 발생했습니다.')
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setUploadResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">파일 업로드</h2>
        
        {!uploadResult && (
          <div className="space-y-6">
            {/* 파일 드롭 영역 */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <File className="w-5 h-5 text-blue-500" />
                      <span className="text-lg font-medium text-gray-700">
                        {selectedFile.name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      크기: {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-lg text-gray-600">
                      CSV 또는 TXT 파일을 드래그하거나 클릭하여 선택하세요
                    </p>
                    <p className="text-sm text-gray-500">
                      최대 파일 크기: 5MB | 지원 형식: .csv, .txt
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}

            {/* 업로드 버튼 */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span>{isUploading ? '업로드 중...' : '번역 시작'}</span>
              </button>
              
              {selectedFile && (
                <button
                  onClick={resetUpload}
                  disabled={isUploading}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
              )}
            </div>

            {/* 안내 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-800">파일 업로드 안내</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• CSV 파일: 첫 번째 열에 번역할 한국어 문장을 입력하세요</li>
                    <li>• TXT 파일: 한 줄에 하나씩 한국어 문장을 입력하세요</li>
                    <li>• 최대 50개 문장까지 한 번에 처리 가능합니다</li>
                    <li>• 업로드된 문장들은 검수 시작 시 실시간으로 AI 번역됩니다</li>
                    <li>• 빠른 업로드: 번역은 검수할 때만 진행되므로 업로드가 즉시 완료됩니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 업로드 결과 */}
        {uploadResult && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                업로드 완료!
              </h3>
              <p className="text-gray-600">
                {uploadResult.message}
              </p>
            </div>

            {/* 결과 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{uploadResult.total_records}</p>
                <p className="text-sm text-blue-700">총 처리 문장</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{uploadResult.success_count}</p>
                <p className="text-sm text-green-700">성공</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{uploadResult.failed_count}</p>
                <p className="text-sm text-red-700">실패</p>
              </div>
            </div>

            {/* 새 파일 업로드 버튼 */}
            <div className="text-center">
              <button
                onClick={resetUpload}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                새 파일 업로드
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 