// 특정 문제 문장 테스트
const problemSentence = "현지 시각 2일 멕시코에서 치러진 대통령 선거에서 좌파 여당 소속 후보 셰인바움이 당선됐습니다.";

async function testProblemSentence() {
  console.log("🧪 문제 문장 테스트 시작...");
  console.log(`📝 입력: ${problemSentence}`);
  
  try {
    // 몇 번 시도해서 일관성 확인
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🔄 시도 ${i}:`);
      
      const response = await fetch('http://localhost:3000/api/translate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          korean_text: problemSentence
        })
      });
      
      const result = await response.text();
      console.log(`📖 결과: ${result}`);
      
      // 문제 패턴 체크
      if (result.includes('{6}+월') || result.includes('{5}+월') || result.includes('{2024}')) {
        console.log("❌ 여전히 문제 패턴 발견!");
      } else {
        console.log("✅ 정상 번역 - 임의 월 추가 없음");
      }
    }
    
  } catch (error) {
    console.log(`❌ 오류: ${error.message}`);
  }
}

// 3초 후 테스트 시작 (서버 시작 대기)
setTimeout(testProblemSentence, 3000);
