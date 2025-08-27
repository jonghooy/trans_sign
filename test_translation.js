// 번역 테스트 스크립트
const test_sentences = [
  "문체부에서는 단장인 도종환 당시 장관과 장관 비서진 1명 등 2명만 탄 것으로 파악됐습니다.",
  "지난 5월 해외 에너지 전문매체가 보도한 기사입니다.",
  "현지 시각 2일 멕시코에서 치러진 대통령 선거에서 좌파 여당 소속 후보 셰인바움이 당선됐습니다."
];

async function testTranslation() {
  console.log("🧪 번역 테스트 시작...");
  
  for (let i = 0; i < test_sentences.length; i++) {
    const sentence = test_sentences[i];
    console.log(`\n📝 테스트 ${i + 1}: ${sentence}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/translate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          korean_text: sentence
        })
      });
      
      const result = await response.text();
      console.log(`📖 결과: ${result}`);
      
      // 2024년 6월 패턴 체크
      if (result.includes('{2024}') || result.includes('{6}+월') || result.includes('지식+한계')) {
        console.log("❌ 여전히 문제 패턴 발견!");
      } else {
        console.log("✅ 정상 번역");
      }
      
    } catch (error) {
      console.log(`❌ 오류: ${error.message}`);
    }
  }
}

testTranslation();
