'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  CheckSquare, 
  BarChart3, 
  Upload, 
  Download,
  Languages 
} from 'lucide-react'

const navigationItems = [
  {
    name: '홈',
    href: '/',
    icon: Home,
  },
  {
    name: '번역 검수',
    href: '/review',
    icon: CheckSquare,
  },
  {
    name: '대시보드',
    href: '/dashboard',
    icon: BarChart3,
  },
  {
    name: '파일 업로드',
    href: '/upload',
    icon: Upload,
  },
  {
    name: '결과 다운로드',
    href: '/download',
    icon: Download,
  },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Languages className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">
                수어 번역 검수 도구
              </span>
            </Link>
          </div>

          {/* 네비게이션 메뉴 */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* 모바일 메뉴 (간단한 버전) */}
          <div className="md:hidden flex items-center">
            <div className="text-sm text-gray-600">
              메뉴
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 (전체 화면) */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
} 