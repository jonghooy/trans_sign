import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AI 수어 번역 검수 도구',
  description: 'AI 기반 수어 번역 모델의 결과물을 효율적으로 검수하는 웹 도구',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" style={{ backgroundColor: '#ffffff !important' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white min-h-screen`}
        style={{ backgroundColor: '#ffffff !important' }}
      >
        <Navigation />
        <main className="py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
