'use client'

import React, { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import BulkUpload from '@/components/BulkUpload'
import { FileUploadResult, BulkUploadResult } from '@/types'
import { Upload, Database } from 'lucide-react'

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<'simple' | 'bulk'>('bulk')

  const handleSimpleUploadComplete = (result: FileUploadResult) => {
    console.log('Simple upload completed:', result)
  }

  const handleBulkUploadComplete = (result: BulkUploadResult) => {
    console.log('Bulk upload completed:', result)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 탭 헤더 */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bulk'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Database className="w-5 h-5 mr-2" />
              대용량 업로드 (21만 문장)
            </button>
            <button
              onClick={() => setActiveTab('simple')}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'simple'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="w-5 h-5 mr-2" />
              간단 업로드 (소량)
            </button>
          </nav>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === 'bulk' && (
          <BulkUpload onUploadComplete={handleBulkUploadComplete} />
        )}
        {activeTab === 'simple' && (
          <FileUpload onUploadComplete={handleSimpleUploadComplete} />
        )}
      </div>
    </div>
  )
} 