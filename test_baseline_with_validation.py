#!/usr/bin/env python3
"""
기본 Gemini 모델로 validation 데이터 테스트
"""

import json
import os
import sys
import vertexai
from vertexai.generative_models import GenerativeModel
import time
import random

# 환경 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gemini-service-key.json'
vertexai.init(project="geminisignkorean", location="us-central1")

def load_validation_data(file_path, num_samples=10):
    """Validation 데이터 로드"""
    samples = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # 랜덤하게 샘플 선택
    selected_lines = random.sample(lines, min(num_samples, len(lines)))
    
    for line in selected_lines:
        try:
            data = json.loads(line.strip())
            messages = data.get('messages', [])
            
            # user와 assistant 메시지 찾기
            user_msg = None
            assistant_msg = None
            
            for msg in messages:
                if msg['role'] == 'user':
                    user_msg = msg['content']
                elif msg['role'] == 'assistant':
                    assistant_msg = msg['content']
            
            if user_msg and assistant_msg:
                samples.append({
                    'input': user_msg,
                    'expected': assistant_msg
                })
        except json.JSONDecodeError:
            continue
    
    return samples

def test_baseline_gemini(samples):
    """기본 Gemini 모델로 한국어-수어 번역 테스트"""
    print("🔍 기본 Gemini 2.0 Flash 모델 - 한국어-수어 번역 테스트")
    print("=" * 70)
    
    try:
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        success_count = 0
        
        for i, sample in enumerate(samples, 1):
            print(f"\n📝 테스트 {i}/{len(samples)}")
            print(f"한국어: {sample['input']}")
            print(f"정답: {sample['expected']}")
            
            # 한국어-수어 번역 프롬프트
            prompt = f"""다음 한국어 문장을 한국 수어로 번역해주세요.
            
수어 번역 규칙:
- 단어들을 "+" 기호로 연결
- 고유명사는 {{}} 안에 표시
- 한국어 문법보다는 수어 문법을 따름
- 간결하고 명확하게 표현

한국어 문장: {sample['input']}
수어 번역:"""
            
            try:
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "max_output_tokens": 150,
                        "temperature": 0.1,
                        "top_k": 40,
                        "top_p": 0.95,
                    }
                )
                
                if response.text:
                    ai_translation = response.text.strip()
                    print(f"AI 번역: {ai_translation}")
                    
                    # 간단한 유사도 체크
                    expected_words = set(sample['expected'].split('+'))
                    ai_words = set(ai_translation.replace('+', ' ').split())
                    
                    if expected_words.intersection(ai_words):
                        print("✅ 성공 (일부 단어 일치)")
                        success_count += 1
                    else:
                        print("❌ 실패 (단어 불일치)")
                else:
                    print("❌ 빈 응답")
            
            except Exception as e:
                print(f"❌ 오류: {e}")
            
            time.sleep(2)  # API 제한 방지
        
        print(f"\n📊 전체 결과: {success_count}/{len(samples)} 성공 ({success_count/len(samples)*100:.1f}%)")
    
    except Exception as e:
        print(f"❌ 모델 초기화 오류: {e}")

def main():
    """메인 함수"""
    print("🚀 기본 Gemini 모델 - Validation 데이터 테스트")
    print("=" * 60)
    
    # Validation 데이터 로드
    validation_file = 'data/validation_1pct.jsonl'
    
    if not os.path.exists(validation_file):
        print(f"❌ 파일을 찾을 수 없습니다: {validation_file}")
        return
    
    print(f"📂 로딩: {validation_file}")
    samples = load_validation_data(validation_file, num_samples=10)
    
    if not samples:
        print("❌ 샘플을 로드할 수 없습니다.")
        return
    
    print(f"✅ {len(samples)}개 샘플 로드 완료")
    
    # 기본 모델 테스트
    test_baseline_gemini(samples)

if __name__ == "__main__":
    main() 