# CSV 수어 번역기 🤟

OpenAI 파인튜닝된 GPT 모델을 사용하여 CSV 파일의 한국어 문장을 수어로 번역하는 웹 애플리케이션입니다.

## ✨ 주요 기능

- 📄 **CSV 파일 업로드**: `sentence_id`, `korean_text`, `human_translation` (선택) 컬럼 지원
- 🤖 **AI 번역**: OpenAI 파인튜닝된 GPT 모델로 한국어 → 수어 번역
- 📊 **실시간 진행률**: 번역 진행 상황을 프로그래스 바로 실시간 표시
- 💾 **결과 다운로드**: `ai_translation`과 `check` 컬럼이 추가된 CSV 파일 다운로드
- 🌐 **웹 기반**: 브라우저에서 바로 사용 가능 (설치 불필요)

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에 OpenAI API 키와 모델 ID 설정
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`에 접속하세요.

### 3. 사용 방법

1. **CSV 파일 선택**: 번역할 CSV 파일을 업로드
2. **번역 시작**: 실시간 진행률을 확인하며 번역 진행
3. **결과 다운로드**: `check` 컬럼이 추가된 번역 결과 다운로드

## 📋 CSV 파일 형식

### 입력 파일
```csv
sentence_id,korean_text,human_translation
1,"안녕하세요","안녕하다"
2,"오늘 날씨가 좋네요","오늘+날씨+좋다"
```

**필수 컬럼:**
- `sentence_id`: 문장 고유 번호
- `korean_text`: 번역할 한국어 문장

**선택적 컬럼:**
- `human_translation`: 인간이 번역한 수어 (있으면 유지)

### 출력 파일
```csv
sentence_id,korean_text,human_translation,ai_translation,check
1,"안녕하세요","안녕하다","안녕하다",""
2,"오늘 날씨가 좋네요","오늘+날씨+좋다","오늘+날씨+좋다+느낌",""
```

**추가되는 컬럼:**
- `ai_translation`: AI가 번역한 수어
- `check`: 검토용 빈 컬럼

## ⚙️ 환경 변수

`.env.local` 파일에 다음 변수들을 설정하세요:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_FINE_TUNED_MODEL_ID=your_fine_tuned_model_id_here
```

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT (Fine-tuned)
- **Icons**: Lucide React

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 메인 페이지 (업로드+번역+다운로드)
│   ├── layout.tsx            # 레이아웃
│   └── api/
│       └── translate-csv/    # CSV 번역 API (스트리밍)
├── components/
│   └── Navigation.tsx        # 헤더 컴포넌트
├── lib/
│   ├── openai.ts            # OpenAI 모델 연동
│   └── utils.ts             # 유틸리티 함수
└── types/
    └── index.ts             # TypeScript 타입 정의

data/
├── model_info.json          # 파인튜닝된 모델 정보
└── sample_input.csv         # 샘플 입력 파일
```

## 🎯 특징

### 실시간 진행률 표시
- 번역 진행 상황을 프로그래스 바로 시각화
- 현재 번역 중인 문장 실시간 표시
- 완료율과 남은 시간 정보 제공

### 스트리밍 응답
- Server-Sent Events를 사용한 실시간 업데이트
- 네트워크 중단 시 복구 가능
- 부드러운 사용자 경험

### 간단한 워크플로우
1. 파일 선택 → 2. 번역 실행 → 3. 결과 다운로드

## 🧪 샘플 테스트

프로젝트에 포함된 `data/sample_input.csv` 파일로 테스트해보세요:

```csv
sentence_id,korean_text,human_translation
1,"1, 2단 발사체가 차례로 분리된 뒤 초음속에 도달하고 LSAM은 곧 표적을 산산조각 냅니다.",{LASM}+이것+2 발사체...
2,"1:0으로 승리한 우루과이는 미국과 8강전을 치릅니다.",우르과이+{1}+:+{0}+승리...
3,"1000명 가까운 사람들이 다쳤고 중상자들도 많은 것으로 파악되고 있습니다.",다치다+사람+세다...
```

## 📦 배포

### 개발 환경
```bash
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
npm start
```

## 🤝 기여

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🆘 문제 해결

### 모델 로드 실패
- `data/model_info.json` 파일 확인
- OpenAI API 키가 올바른지 확인
- 파인튜닝된 모델 ID가 정확한지 확인

### 번역 실패
- 인터넷 연결 상태 확인
- OpenAI API 사용량 한도 확인
- 입력 텍스트 형식이 올바른지 확인

### CSV 파싱 오류
- 파일 인코딩이 UTF-8인지 확인
- 필수 컬럼(`sentence_id`, `korean_text`)이 있는지 확인
- CSV 형식이 올바른지 확인

---

💡 **Tip**: 윈도우 사용자들도 웹 브라우저에서 바로 사용할 수 있어서 별도 설치가 필요없습니다!
