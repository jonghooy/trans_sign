#!/usr/bin/env python3
import os
import json
import time
import random
from datetime import datetime
from openai import OpenAI
from tqdm import tqdm
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import numpy as np
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def load_validation_data(file_path, sample_size=100):
    """Validation 데이터 로드 및 샘플링"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = [json.loads(line) for line in f]
    
    # 무작위로 100개 샘플링
    if len(data) > sample_size:
        data = random.sample(data, sample_size)
    
    return data

def load_model_info():
    """파인튜닝된 모델 정보 로드"""
    with open('data/model_info.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def evaluate_translation(model_id, test_sample):
    """단일 번역 평가"""
    try:
        korean_text = test_sample['messages'][0]['content']
        expected_sign = test_sample['messages'][1]['content']
        
        # 모델로 번역
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "user", "content": korean_text}
            ],
            max_tokens=200,
            temperature=0.1
        )
        
        predicted_sign = response.choices[0].message.content.strip()
        
        return {
            'korean': korean_text,
            'expected': expected_sign,
            'predicted': predicted_sign,
            'exact_match': predicted_sign == expected_sign
        }
        
    except Exception as e:
        print(f"오류 발생: {e}")
        return None

def calculate_token_overlap(expected, predicted):
    """토큰 단위 일치율 계산"""
    expected_tokens = set(expected.split('+'))
    predicted_tokens = set(predicted.split('+'))
    
    if not expected_tokens:
        return 0.0
        
    intersection = expected_tokens.intersection(predicted_tokens)
    return len(intersection) / len(expected_tokens)

def evaluate_model(model_id, validation_data):
    """모델 전체 평가"""
    results = []
    exact_matches = 0
    token_overlaps = []
    
    print(f"\n🔄 모델 평가 시작: {model_id}")
    print(f"📊 평가할 문장 수: {len(validation_data)}")
    
    # 진행률 표시
    for sample in tqdm(validation_data, desc="평가 진행"):
        result = evaluate_translation(model_id, sample)
        
        if result:
            results.append(result)
            
            if result['exact_match']:
                exact_matches += 1
            
            # 토큰 오버랩 계산
            overlap = calculate_token_overlap(result['expected'], result['predicted'])
            token_overlaps.append(overlap)
        
        # API 제한 방지를 위한 대기
        time.sleep(0.1)
    
    # 평가 지표 계산
    accuracy = exact_matches / len(results) if results else 0
    avg_token_overlap = np.mean(token_overlaps) if token_overlaps else 0
    
    return {
        'model_id': model_id,
        'total_samples': len(validation_data),
        'evaluated_samples': len(results),
        'exact_match_accuracy': accuracy,
        'avg_token_overlap': avg_token_overlap,
        'results': results
    }

def print_evaluation_summary(evaluation):
    """평가 결과 요약 출력"""
    print("\n" + "="*60)
    print("📊 평가 결과 요약")
    print("="*60)
    print(f"모델 ID: {evaluation['model_id']}")
    print(f"평가 문장 수: {evaluation['evaluated_samples']}/{evaluation['total_samples']}")
    print(f"정확한 일치율: {evaluation['exact_match_accuracy']:.2%}")
    print(f"평균 토큰 일치율: {evaluation['avg_token_overlap']:.2%}")
    
    # 샘플 결과 출력
    print("\n📝 샘플 결과 (처음 5개):")
    print("-"*60)
    
    for i, result in enumerate(evaluation['results'][:5], 1):
        print(f"\n예시 {i}:")
        print(f"한국어: {result['korean']}")
        print(f"정답: {result['expected']}")
        print(f"예측: {result['predicted']}")
        print(f"일치: {'✅' if result['exact_match'] else '❌'}")
        print(f"토큰 일치율: {calculate_token_overlap(result['expected'], result['predicted']):.2%}")

def save_evaluation_results(evaluation):
    """평가 결과 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"gpt4_validation_results_{timestamp}.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(evaluation, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 평가 결과 저장됨: {output_file}")
    
    # 간단한 요약 CSV 파일도 생성
    summary_file = f"gpt4_validation_summary_{timestamp}.csv"
    with open(summary_file, 'w', encoding='utf-8') as f:
        f.write("모델ID,평가문장수,정확일치율,평균토큰일치율\n")
        f.write(f"{evaluation['model_id']},{evaluation['evaluated_samples']},")
        f.write(f"{evaluation['exact_match_accuracy']:.4f},{evaluation['avg_token_overlap']:.4f}\n")
    
    print(f"📊 요약 파일 저장됨: {summary_file}")

def main():
    # API 키 확인
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ OPENAI_API_KEY 환경변수를 설정해주세요!")
        return
    
    # 모델 정보 로드
    try:
        model_info = load_model_info()
        model_id = model_info['fine_tuned_model_id']
        print(f"✅ 파인튜닝 모델 로드됨: {model_id}")
    except Exception as e:
        print(f"❌ 모델 정보 로드 실패: {e}")
        return
    
    # Validation 데이터 로드 (100개 샘플)
    try:
        validation_data = load_validation_data('data/validation_1pct.jsonl', sample_size=100)
        print(f"✅ Validation 데이터 로드됨: {len(validation_data)}개 문장")
    except Exception as e:
        print(f"❌ Validation 데이터 로드 실패: {e}")
        return
    
    # 모델 평가
    evaluation = evaluate_model(model_id, validation_data)
    
    # 결과 출력 및 저장
    print_evaluation_summary(evaluation)
    save_evaluation_results(evaluation)
    
    print("\n✅ 평가 완료!")

if __name__ == "__main__":
    main() 