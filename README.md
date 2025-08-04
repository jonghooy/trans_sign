# AI 수어 번역 검수 도구

AI 기반 수어 번역 모델(Fine-tuned GPT-4.1)이 생성한 번역 결과물을 인간 검수자가 빠르고 정확하게 검증하기 위한 웹 기반 도구입니다.

## 기술 스택

- **프론트엔드**: Next.js 15, TypeScript, Tailwind CSS
- **백엔드**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI API (Fine-tuned GPT-4.1)
- **배포**: Vercel

## 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경변수를 설정해주세요:

```bash
# Supabase 설정 (NEXT_PUBLIC_ 접두사 필요)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI 설정 (서버 사이드에서만 사용)
OPENAI_API_KEY=your_openai_api_key_here

# 파인튜닝된 모델 ID
OPENAI_FINE_TUNED_MODEL_ID=your_fine_tuned_model_id_here
```

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 개발 서버 실행:
```bash
npm run dev
```

3. 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속

## 주요 기능

- 📝 **핵심 검수 인터페이스**: 원문과 번역문을 보고 채택/폐기 결정
- 📊 **실시간 대시보드**: 처리 현황 및 채택률 통계
- 📤 **파일 업로드**: CSV/TXT 파일로 일괄 번역 작업
- 🔗 **유사도 그룹핑**: 의미적 유사성을 기반으로 한 효율적인 검수
- 📥 **결과 다운로드**: 검수 완료된 데이터 CSV 다운로드
- ⌨️ **키보드 단축키**: 빠른 검수를 위한 단축키 지원

## 데이터베이스 구조

### 주요 테이블

- `translation_tasks`: 번역 작업 목록
- `accepted_data`: 채택된 번역 데이터
- `rejected_data`: 폐기된 번역 데이터

## 개발 진행 상황

현재 프로젝트 초기 설정이 완료되었습니다:

- ✅ Next.js 프로젝트 생성 및 TypeScript 설정
- ✅ Tailwind CSS 설정
- ✅ Supabase 클라이언트 설정
- ✅ 기본 폴더 구조 생성
- ✅ TypeScript 타입 정의

## 다음 단계

1. Supabase 데이터베이스 테이블 생성
2. OpenAI API 연동
3. 핵심 검수 인터페이스 구현
4. 파일 업로드 기능 구현

---

## 참고

- [Next.js 문서](https://nextjs.org/docs)
- [Supabase 문서](https://supabase.com/docs)
- [OpenAI API 문서](https://platform.openai.com/docs)
