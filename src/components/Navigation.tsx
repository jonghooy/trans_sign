'use client'

import React from 'react'
import Link from 'next/link'
import { Languages } from 'lucide-react'

export default function Navigation() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center h-16">
          {/* 로고 */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <Languages className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">
                CSV 수어 번역기
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
