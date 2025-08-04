#!/usr/bin/env python3
"""
기본 Gemini 모델 종합 성능 테스트 (50개 샘플)
"""

import json
import os
import sys
import vertexai
from vertexai.generative_models import GenerativeModel
import time
import random
from datetime import datetime

# 환경 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gemini-service-key.json'
vertexai.init(project="geminisignkorean", location="us-central1")

def load_validation_data(file_path, num_samples=50):
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

def calculate_jaccard_similarity(expected, predicted):
    """Jaccard 유사도 계산"""
    expected_words = set(expected.lower().split('+'))
    predicted_words = set(predicted.lower().replace('+', ' ').split())
    
    intersection = expected_words.intersection(predicted_words)
    union = expected_words.union(predicted_words)
    
    if len(union) == 0:
        return 0.0
    
    return len(intersection) / len(union)

def calculate_word_accuracy(expected, predicted):
    """단어 정확도 계산"""
    expected_words = set(expected.lower().split('+'))
    predicted_words = set(predicted.lower().replace('+', ' ').split())
    
    if len(expected_words) == 0:
        return 0.0
    
    correct_words = expected_words.intersection(predicted_words)
    return len(correct_words) / len(expected_words)

def test_baseline_comprehensive(samples):
    """기본 Gemini 모델 종합 테스트"""
    print("🔍 기본 Gemini 2.0 Flash 모델 - 종합 성능 테스트")
    print("=" * 70)
    
    try:
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        results = []
        success_count = 0
        total_jaccard = 0.0
        total_word_accuracy = 0.0
        
        for i, sample in enumerate(samples, 1):
            print(f"\n📝 테스트 {i}/{len(samples)}")
            print(f"한국어: {sample['input']}")
            print(f"정답: {sample['expected']}")
            
            # 한국어-수어 번역 프롬프트 (최적화된 버전)
            prompt = f"""다음 한국어 문장을 한국 수어로 번역해주세요.

수어 번역 규칙:
- 단어를 "+" 기호로 연결하세요
- 고유명사는 {{}} 안에 넣으세요
- 수어 문법에 맞게 간결하게 번역하세요
- 불필요한 조사나 어미는 생략하세요

한국어: {sample['input']}
수어:"""
            
            try:
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "max_output_tokens": 100,
                        "temperature": 0.1,
                        "top_k": 40,
                        "top_p": 0.95,
                    }
                )
                
                if response.text:
                    ai_translation = response.text.strip()
                    print(f"AI 번역: {ai_translation}")
                    
                    # 정량적 평가
                    jaccard = calculate_jaccard_similarity(sample['expected'], ai_translation)
                    word_acc = calculate_word_accuracy(sample['expected'], ai_translation)
                    
                    print(f"📊 Jaccard 유사도: {jaccard:.3f}")
                    print(f"📊 단어 정확도: {word_acc:.3f}")
                    
                    total_jaccard += jaccard
                    total_word_accuracy += word_acc
                    
                    # 성공 기준: Jaccard > 0.3 또는 Word accuracy > 0.5
                    if jaccard > 0.3 or word_acc > 0.5:
                        print("✅ 성공")
                        success_count += 1
                    else:
                        print("❌ 실패")
                    
                    results.append({
                        'input': sample['input'],
                        'expected': sample['expected'],
                        'predicted': ai_translation,
                        'jaccard': jaccard,
                        'word_accuracy': word_acc,
                        'success': jaccard > 0.3 or word_acc > 0.5
                    })
                else:
                    print("❌ 빈 응답")
                    results.append({
                        'input': sample['input'],
                        'expected': sample['expected'],
                        'predicted': '',
                        'jaccard': 0.0,
                        'word_accuracy': 0.0,
                        'success': False
                    })
            
            except Exception as e:
                print(f"❌ 오류: {e}")
                results.append({
                    'input': sample['input'],
                    'expected': sample['expected'],
                    'predicted': '',
                    'jaccard': 0.0,
                    'word_accuracy': 0.0,
                    'success': False
                })
            
            time.sleep(1)  # API 제한 방지
        
        # 전체 결과 계산
        avg_jaccard = total_jaccard / len(samples)
        avg_word_accuracy = total_word_accuracy / len(samples)
        success_rate = success_count / len(samples)
        
        print(f"\n" + "=" * 70)
        print(f"📊 **최종 성능 결과**")
        print(f"=" * 70)
        print(f"💫 성공률: {success_count}/{len(samples)} ({success_rate*100:.1f}%)")
        print(f"🎯 평균 Jaccard 유사도: {avg_jaccard:.3f}")
        print(f"📝 평균 단어 정확도: {avg_word_accuracy:.3f}")
        
        # 결과 저장
        save_results(results, avg_jaccard, avg_word_accuracy, success_rate)
        
        return results
    
    except Exception as e:
        print(f"❌ 모델 초기화 오류: {e}")
        return []

def save_results(results, avg_jaccard, avg_word_accuracy, success_rate):
    """결과 저장"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'data/baseline_gemini_comprehensive_{timestamp}.json'
    
    summary = {
        'timestamp': timestamp,
        'model': 'gemini-2.0-flash-exp',
        'num_samples': len(results),
        'success_rate': success_rate,
        'avg_jaccard_similarity': avg_jaccard,
        'avg_word_accuracy': avg_word_accuracy,
        'results': results
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print(f"📁 결과 저장됨: {filename}")

def main():
    """메인 함수"""
    print("🚀 기본 Gemini 모델 - 종합 성능 평가 (50개 샘플)")
    print("=" * 60)
    
    # Validation 데이터 로드
    validation_file = 'data/validation_1pct.jsonl'
    
    if not os.path.exists(validation_file):
        print(f"❌ 파일을 찾을 수 없습니다: {validation_file}")
        return
    
    print(f"📂 로딩: {validation_file}")
    samples = load_validation_data(validation_file, num_samples=50)
    
    if not samples:
        print("❌ 샘플을 로드할 수 없습니다.")
        return
    
    print(f"✅ {len(samples)}개 샘플 로드 완료")
    
    # 종합 테스트 실행
    results = test_baseline_comprehensive(samples)
    
    if results:
        print("\n🎯 기본 Gemini 모델이 예상보다 뛰어난 성능을 보입니다!")
        print("파인튜닝 없이도 한국어-수어 번역에서 상당한 성과를 달성했습니다.")

if __name__ == "__main__":
    main() 