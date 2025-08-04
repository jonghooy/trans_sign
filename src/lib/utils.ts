/**
 * 번역 품질 검사 함수
 * 의미 없는 날짜 정보나 부적절한 내용이 포함된 번역을 감지
 */
export function isLowQualityTranslation(translatedText: string, originalText: string): boolean {
  if (!translatedText || !originalText) return true

  // 1. 날짜 패턴 감지
  const datePatterns = [
    /\{?20\d{2}\}?\+?년/g,  // 2020년, {2024}+년 등
    /\{?\d{1,2}\}?\+?월/g,  // 6월, {6}+월 등  
    /\{?\d{1,2}\}?\+?일/g,  // 15일, {15}+일 등
    /\{?20\d{2}\}?/g,       // {2024}, 2024 등
    /\d{4}년\d{1,2}월/g,    // 2024년6월
    /\d{1,2}월\d{1,2}일/g   // 6월15일
  ]

  // 날짜 패턴이 3개 이상 매칭되면 저품질로 판단
  let dateMatches = 0
  for (const pattern of datePatterns) {
    const matches = translatedText.match(pattern)
    if (matches) {
      dateMatches += matches.length
    }
  }

  if (dateMatches >= 3) {
    console.log(`Low quality detected - too many date patterns (${dateMatches}):`, translatedText)
    return true
  }

  // 2. 연도가 포함되어 있으면서 원문에는 날짜 관련 내용이 없는 경우
  const hasYearInTranslation = /20\d{2}|19\d{2}/.test(translatedText)
  const hasDateInOriginal = /\d{4}년|\d{1,2}월|\d{1,2}일|날짜|시간|년도|올해|작년|내년|오늘|어제|내일/.test(originalText)
  
  if (hasYearInTranslation && !hasDateInOriginal) {
    console.log('Low quality detected - year in translation but no date context in original:', translatedText)
    return true
  }

  // 3. 번역 길이가 원문 길이의 3배를 초과하는 경우 (과도한 정보 추가)
  if (translatedText.length > originalText.length * 3) {
    console.log('Low quality detected - translation too long:', translatedText)
    return true
  }

  // 4. 의미 없는 반복 패턴 감지
  const repetitivePatterns = [
    /(\+[^+]+)\1{3,}/g,  // 같은 패턴이 4번 이상 반복
    /\{[^}]*\}\+\{[^}]*\}\+\{[^}]*\}\+\{[^}]*\}\+\{[^}]*\}/g  // 연속된 5개 이상의 {} 패턴
  ]

  for (const pattern of repetitivePatterns) {
    if (pattern.test(translatedText)) {
      console.log('Low quality detected - repetitive patterns:', translatedText)
      return true
    }
  }

  // 5. 번역에 숫자가 과도하게 많은 경우 (원문 대비)
  const translationNumbers = (translatedText.match(/\d+/g) || []).length
  const originalNumbers = (originalText.match(/\d+/g) || []).length
  
  if (translationNumbers > originalNumbers + 3) {
    console.log('Low quality detected - too many numbers:', translatedText)
    return true
  }

  return false
}

/**
 * 번역이 자동 폐기되어야 하는지 확인
 */
export function shouldAutoReject(translatedText: string, originalText: string): boolean {
  return isLowQualityTranslation(translatedText, originalText)
} 