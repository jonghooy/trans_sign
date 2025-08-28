import OpenAI from 'openai'
import { TranslationResponse } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30초 타임아웃 (기본값보다 빠름)
})

const FINE_TUNED_MODEL = process.env.OPENAI_FINE_TUNED_MODEL_ID

if (!FINE_TUNED_MODEL) {
  throw new Error('OPENAI_FINE_TUNED_MODEL_ID environment variable is required')
}

/**
 * 번역 품질을 검증하는 함수
 * 특정 문제 패턴(날짜 관련 등)일 때만 필터링
 */
function validateTranslationQuality(originalText: string, translatedText: string): boolean {
  // 1. 지식 컷오프 관련 절대 금지 패턴들
  const absoluteBannedPatterns = [
    /지식\+한계/, /지식\+마지막/, /알다\+한계/, /까지\+알다/,
    /\{2024\}\+년\+\{6\}\+월/, /\{2024\}\+년\+\{5\}\+월/,
    /지식\+마지막\+\{2024\}/, /\{2024\}\+년\+까지/,
  ]
  
  // 절대 금지 패턴 확인
  for (const pattern of absoluteBannedPatterns) {
    if (pattern.test(translatedText)) {
      console.log(`⚠️ 번역 품질 검증 실패: 절대 금지 패턴 발견 - ${pattern}`)
      console.log(`원본: "${originalText}"`)
      console.log(`번역: "${translatedText}"`)
      return false
    }
  }
  
  // 2. 🚨 강화된 연도 검증: 2020년대 연도가 원본에 없는데 추가되는 경우 차단
  const yearPattern = /\{(20[12]\d)\}\+년/g
  const yearMatches = [...translatedText.matchAll(yearPattern)]
  
  if (yearMatches.length > 0) {
    for (const match of yearMatches) {
      const year = match[1]
      // 원본에 해당 연도가 명시적으로 있는지 확인 (4자리 또는 2자리)
      const hasExactYearInOriginal = new RegExp(`${year}년|${year.slice(2)}년`).test(originalText)
      
      if (!hasExactYearInOriginal) {
        console.log(`⚠️ 번역 품질 검증 실패: 원본에 없는 연도 정보 추가됨 - ${match[0]}`)
        console.log(`원본: "${originalText}"`)
        console.log(`번역: "${translatedText}"`)
        return false
      }
    }
  }
  
  // 3. 🚨 강화된 월 검증: 원본에 월이 없는데 번역에 특정 월이 나타나는 경우 차단
  const monthPattern = /\{(\d{1,2})\}\+월/g
  const monthMatches = [...translatedText.matchAll(monthPattern)]
  
  if (monthMatches.length > 0) {
    for (const match of monthMatches) {
      const month = parseInt(match[1])
      
      // 원본에 해당 월이 명시적으로 있는지 확인
      const koreanMonthNames = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십', '십일', '십이']
      
      const hasExactMonthInOriginal = 
        new RegExp(`${month}월`).test(originalText) ||
        new RegExp(`${koreanMonthNames[month]}월`).test(originalText)
      
      if (!hasExactMonthInOriginal) {
        // "지난 5월", "5월" 같은 명시적 표현이 없으면 차단
        console.log(`⚠️ 번역 품질 검증 실패: 원본에 없는 월 정보 추가됨 - ${match[0]}`)
        console.log(`원본: "${originalText}"`)
        console.log(`번역: "${translatedText}"`)
        return false
      }
    }
  }
  
  // 4. 🚨 스마트 문제 패턴 검증 (원본과 비교하여 차단)
  const smartBlockPatterns = [
    {
      // 2020년대 연도가 원본에 없는데 추가되는 경우만 차단
      pattern: /\{(202[3-5])\}\+년/g,
      check: (match: RegExpMatchArray, original: string) => {
        const year = match[1]
        return !new RegExp(`${year}년|${year.slice(2)}년`).test(original)
      },
      description: "원본에 없는 2020년대 연도 추가"
    },
    {
      // 월+일 조합에서 월이 원본에 없는 경우만 차단 
      pattern: /\{(\d{1,2})\}\+월\+\{\d{1,2}\}\+일/g,
      check: (match: RegExpMatchArray, original: string) => {
        const month = parseInt(match[1])
        const koreanMonthNames = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십', '십일', '십이']
        
        // 원본에 해당 월이 명시적으로 있는지 확인
        const hasMonth = new RegExp(`${month}월`).test(original) ||
                        new RegExp(`${koreanMonthNames[month]}월`).test(original)
        
        return !hasMonth // 월이 없으면 차단
      },
      description: "원본에 없는 월 정보가 포함된 월+일 조합"
    }
  ]
  
  for (const smartPattern of smartBlockPatterns) {
    const matches = [...translatedText.matchAll(smartPattern.pattern)]
    for (const match of matches) {
      if (smartPattern.check(match, originalText)) {
        console.log(`⚠️ 번역 품질 검증 실패: ${smartPattern.description} - ${match[0]}`)
        console.log(`원본: "${originalText}"`)
        console.log(`번역: "${translatedText}"`)
        return false
      }
    }
  }
  
  return true
}



/**
 * ⚡ 고속 한국어 텍스트를 수어로 번역하는 함수 (최적화됨)
 */
export async function translateKoreanToSignLanguage(koreanText: string): Promise<TranslationResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: FINE_TUNED_MODEL as string,
      messages: [
        {
          role: 'system',
          content: `당신은 한국어를 한국 수어로 번역하는 전문가입니다. 
주어진 한국어 문장을 정확한 한국 수어 표현으로 번역해주세요.

🚨 【절대 금지 - 즉시 번역 중단하세요】:
- {2023}+년, {2024}+년, {2025}+년 등 2020년대 연도 표현 절대 금지
- {5}+월, {6}+월, {7}+월, {8}+월 등 임의 월 표현 절대 금지
- {월}+{일} 조합 (예: {6}+월+{2}+일) 절대 금지
- 지식+한계, 지식+마지막, 알다+한계, 까지+알다 등 지식컷오프 표현 절대 금지

⚠️ 엄격한 날짜/시간 규칙:
- 원본에 "2024년"이 없으면 {2024}+년 절대 사용 금지
- 원본에 "6월"이 없으면 {6}+월 절대 사용 금지  
- 원본에 "2일"만 있으면 {2}+일만 사용, {6}+월 추가 금지
- "이달", "지난해" 등 애매한 표현에서 구체적 숫자 추가 금지
- 모르거나 확실하지 않으면 날짜/시간 정보를 아예 생략하세요

✅ 허용되는 경우:
- 원본에 "2024년 6월"이 있으면 → {2024}+년+{6}+월 (정확히 일치하는 경우만)
- 원본에 "5월"이 있으면 → {5}+월 (명시적으로 언급된 경우만)

수어 번역 규칙:
1. 단어는 '+'로 연결합니다
2. 고유명사나 외래어는 {}로 감쌉니다
3. 문법적으로 자연스러운 수어 어순을 사용합니다
4. 불필요한 조사나 어미는 생략합니다
5. 의심스러운 날짜/시간 정보는 번역에서 제외합니다`
        },
        {
          role: 'user',
          content: koreanText,
        },
      ],
      // 🚀 초고속 최적화 설정
      max_tokens: 150,        // 200 → 150 (더 짧은 응답으로 속도 향상)
      temperature: 0.05,      // 0.1 → 0.05 (최고 속도를 위한 최소값)
      top_p: 0.8,            // 0.9 → 0.8 (더 빠른 응답)
      frequency_penalty: 0,   // 기본값으로 빠른 응답
      presence_penalty: 0,    // 기본값으로 빠른 응답
      stream: false,          // 스트리밍 비활성화로 빠른 완료
    })

    const translatedText = response.choices[0]?.message?.content?.trim()

    if (!translatedText) {
      return {
        success: false,
        error: '번역 결과를 받을 수 없습니다.',
      }
    }

    // 번역 품질 검증
    if (!validateTranslationQuality(koreanText, translatedText)) {
      return {
        success: true,
        translated_text: '', // 품질 검증 실패시 빈 문자열 반환
        raw_translation: translatedText, // 원본 번역 결과는 보존
        quality_check_failed: true
      }
    }

    return {
      success: true,
      translated_text: translatedText,
    }
  } catch (error) {
    console.error('⚡ 고속 번역 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '번역 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 🔄 재시도용 번역 함수 - 품질 검증 실패 시 다른 파라미터로 재시도
 */
export async function translateKoreanToSignLanguageRetry(
  koreanText: string, 
  customTemperature?: number, 
  customTopP?: number,
  customMaxTokens?: number,
  modifyInput?: boolean
): Promise<TranslationResponse> {
  try {
    // 🔄 3차 시도 시 입력 패턴 변화: 마지막 "." 제거
    let modifiedText = koreanText
    if (modifyInput) {
      modifiedText = koreanText.endsWith('.') ? koreanText.slice(0, -1) : koreanText
      console.log(`🔧 입력 패턴 변화: "${koreanText}" → "${modifiedText}"`)
    }
    
    const response = await openai.chat.completions.create({
      model: FINE_TUNED_MODEL as string,
      messages: [
        {
          role: 'system',
          content: `당신은 한국어를 한국 수어로 번역하는 전문가입니다. 
주어진 한국어 문장을 정확한 한국 수어 표현으로 번역해주세요.

🚨 【절대 금지 - 즉시 번역 중단하세요】:
- {2023}+년, {2024}+년, {2025}+년 등 2020년대 연도 표현 절대 금지
- {5}+월, {6}+월, {7}+월, {8}+월 등 임의 월 표현 절대 금지
- {월}+{일} 조합 (예: {6}+월+{2}+일) 절대 금지
- 지식+한계, 지식+마지막, 알다+한계, 까지+알다 등 지식컷오프 표현 절대 금지

⚠️ 엄격한 날짜/시간 규칙:
- 원본에 "2024년"이 없으면 {2024}+년 절대 사용 금지
- 원본에 "6월"이 없으면 {6}+월 절대 사용 금지  
- 원본에 "2일"만 있으면 {2}+일만 사용, {6}+월 추가 금지
- "이달", "지난해" 등 애매한 표현에서 구체적 숫자 추가 금지
- 모르거나 확실하지 않으면 날짜/시간 정보를 아예 생략하세요

✅ 허용되는 경우:
- 원본에 "2024년 6월"이 있으면 → {2024}+년+{6}+월 (정확히 일치하는 경우만)
- 원본에 "5월"이 있으면 → {5}+월 (명시적으로 언급된 경우만)

수어 번역 규칙:
1. 단어는 '+'로 연결합니다
2. 고유명사나 외래어는 {}로 감쌉니다
3. 문법적으로 자연스러운 수어 어순을 사용합니다
4. 불필요한 조사나 어미는 생략합니다
5. 의심스러운 날짜/시간 정보는 번역에서 제외합니다`
        },
        {
          role: 'user',
          content: modifiedText,
        },
      ],
      // 🔄 재시도용 파라미터 (단계별로 더 보수적인 설정)
      max_tokens: customMaxTokens ?? 200,          // 커스텀 토큰 수 또는 기본값
      temperature: customTemperature ?? 0.3,       // 사용자 지정 또는 기본값
      top_p: customTopP ?? 0.95,                   // 사용자 지정 또는 기본값
      frequency_penalty: customTemperature && customTemperature <= 0.01 ? 0.2 : 0.1, // 극보수적일 때 더 강한 억제
      presence_penalty: customTemperature && customTemperature <= 0.01 ? 0.2 : 0.1,  // 극보수적일 때 더 강한 유도
      stream: false,
    })

    const translatedText = response.choices[0]?.message?.content?.trim()

    if (!translatedText) {
      return {
        success: false,
        error: '재시도 번역 결과를 받을 수 없습니다.',
      }
    }

    // 재시도에서도 품질 검증 수행 (원본 텍스트 기준)
    if (!validateTranslationQuality(koreanText, translatedText)) {
      return {
        success: true,
        translated_text: '', // 재시도에서도 품질 검증 실패시 빈 문자열 반환
        raw_translation: translatedText, // 원본 번역 결과는 보존
        quality_check_failed: true
      }
    }

    return {
      success: true,
      translated_text: translatedText,
    }
  } catch (error) {
    console.error('🔄 재시도 번역 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '재시도 번역 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 배치 번역 함수 - 여러 문장을 한 번에 번역 (사용하지 않음, 병렬 처리로 대체)
 */
export async function translateBatch(texts: string[]): Promise<{ 
  success: boolean; 
  results: Array<{ original: string; translated?: string; error?: string }> 
}> {
  
  try {
    const results = await Promise.all(
      texts.map(async (text) => {
        const result = await translateKoreanToSignLanguage(text)
        if (result.success) {
          return { original: text, translated: result.translated_text }
        } else {
          return { original: text, error: result.error }
        }
      })
    )

    return {
      success: true,
      results
    }
  } catch (error) {
    console.error('Batch translation error:', error)
    return {
      success: false,
      results: texts.map(text => ({ 
        original: text, 
        error: error instanceof Error ? error.message : '배치 번역 중 오류가 발생했습니다.' 
      }))
    }
  }
}
