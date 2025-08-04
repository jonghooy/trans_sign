'use client'

import React, { useState } from 'react'
import ReviewInterface from '@/components/ReviewInterface'
import Dashboard from '@/components/Dashboard'

export default function ReviewPage() {
  const [refreshStats, setRefreshStats] = useState(0)

  const handleReviewComplete = (taskId: string, action: 'accept' | 'reject') => {
    console.log(`Task ${taskId} ${action}ed`)
    // 통계 새로고침 트리거
    setRefreshStats(prev => prev + 1)
  }

  const handleStatsUpdate = () => {
    setRefreshStats(prev => prev + 1)
  }

  return (
    <div className="space-y-8">
      {/* 실시간 통계 (간단 버전) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Dashboard key={refreshStats} showHistory={false} />
      </div>

      {/* 검수 인터페이스 */}
      <ReviewInterface
        onReviewComplete={handleReviewComplete}
        onStatsUpdate={handleStatsUpdate}
      />
    </div>
  )
} 