import Link from 'next/link'
import { CheckSquare, BarChart3, Upload, Download, Languages, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 히어로 섹션 */}
      <div className="text-center py-12">
        <div className="flex justify-center mb-6">
          <Languages className="w-16 h-16 text-blue-400" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI 수어 번역 검수 도구
        </h1>
        <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
          AI 기반 수어 번역 모델이 생성한 번역 결과물을 빠르고 정확하게 검증하여 
          고품질의 데이터셋을 효율적으로 구축하세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/review"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <CheckSquare className="w-5 h-5 mr-2" />
            검수 시작하기
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link 
            href="/upload"
            className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <Upload className="w-5 h-5 mr-2" />
            파일 업로드
          </Link>
        </div>
      </div>

      {/* 주요 기능 */}
      <div className="py-12">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          주요 기능
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckSquare className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">번역 검수</h3>
            <p className="text-gray-600">
              AI 번역 결과를 빠르게 채택 또는 폐기하여 고품질 데이터를 선별하세요.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">실시간 통계</h3>
            <p className="text-gray-600">
              검수 진행 상황과 채택률을 실시간으로 모니터링하세요.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">배치 업로드</h3>
            <p className="text-gray-600">
              CSV 또는 TXT 파일로 한 번에 여러 문장을 업로드하고 번역하세요.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-yellow-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Download className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">결과 다운로드</h3>
            <p className="text-gray-600">
              검수 완료된 데이터를 CSV 형태로 다운로드하여 활용하세요.
            </p>
          </div>
        </div>
      </div>

      {/* 작업 흐름 */}
      <div className="py-12 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            작업 흐름
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">파일 업로드</h3>
              <p className="text-gray-600">
                번역할 한국어 문장들을 CSV 또는 TXT 파일로 업로드합니다.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">AI 번역</h3>
              <p className="text-gray-600">
                파인튜닝된 GPT 모델이 자동으로 한국어를 수어로 번역합니다.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">인간 검수</h3>
              <p className="text-gray-600">
                검수자가 번역 품질을 평가하여 채택 또는 폐기를 결정합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA 섹션 */}
      <div className="py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          지금 바로 시작해보세요
        </h2>
        <p className="text-gray-600 mb-8">
          효율적인 수어 번역 데이터 검수를 경험해보세요.
        </p>
        <Link 
          href="/review"
          className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
        >
          <CheckSquare className="w-6 h-6 mr-2" />
          검수 시작하기
        </Link>
      </div>
    </div>
  )
}
