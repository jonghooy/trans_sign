#!/usr/bin/env python3
"""
Validation 데이터를 사용한 Gemini 모델 테스트
"""

import json
import os
import sys
import google.generativeai as genai
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
import time
import random

# 환경 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gemini-service-key.json'

# Google AI Studio API 키 설정
genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))

# Vertex AI 설정
import vertexai
vertexai.init(project="geminisignkorean", location="us-central1")

def load_validation_data(file_path, num_samples=5):
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

def test_basic_gemini(samples):
    """기본 Gemini 모델 테스트"""
    print("🔍 기본 Gemini 2.5 Flash 모델 테스트")
    print("=" * 60)
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        for i, sample in enumerate(samples, 1):
            print(f"\n📝 테스트 {i}/5")
            print(f"한국어: {sample['input']}")
            print(f"정답: {sample['expected']}")
            
            # 간단한 프롬프트
            prompt = f"다음 한국어 문장을 수어로 번역해주세요: {sample['input']}"
            
            try:
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=100,
                        temperature=0.1,
                    )
                )
                
                if response.text:
                    print(f"AI 번역: {response.text.strip()}")
                    print("✅ 성공")
                else:
                    print("❌ 빈 응답")
            
            except Exception as e:
                print(f"❌ 오류: {e}")
            
            time.sleep(1)  # API 제한 방지
    
    except Exception as e:
        print(f"❌ 모델 초기화 오류: {e}")

def test_finetuned_gemini(samples):
    """파인튜닝된 Gemini 모델 테스트"""
    print("\n🎯 파인튜닝된 Gemini 모델 테스트")
    print("=" * 60)
    
    try:
        from vertexai.generative_models import GenerativeModel
        
        # 파인튜닝된 모델 ID
        model_id = "projects/530606339865/locations/us-central1/models/1203467153647337472@1"
        
        model = GenerativeModel(model_id)
        
        for i, sample in enumerate(samples, 1):
            print(f"\n📝 테스트 {i}/5")
            print(f"한국어: {sample['input']}")
            print(f"정답: {sample['expected']}")
            
            try:
                response = model.generate_content(
                    sample['input'],
                    generation_config={
                        "max_output_tokens": 100,
                        "temperature": 0.1,
                        "top_k": 40,
                        "top_p": 0.95,
                    }
                )
                
                if response.text:
                    print(f"AI 번역: {response.text.strip()}")
                    print("✅ 성공")
                else:
                    print("❌ 빈 응답")
            
            except Exception as e:
                print(f"❌ 오류: {e}")
            
            time.sleep(1)  # API 제한 방지
    
    except Exception as e:
        print(f"❌ 모델 초기화 오류: {e}")

def main():
    """메인 함수"""
    print("🚀 Validation 데이터를 사용한 Gemini 모델 테스트")
    print("=" * 60)
    
    # Validation 데이터 로드
    validation_file = 'data/validation_1pct.jsonl'
    
    if not os.path.exists(validation_file):
        print(f"❌ 파일을 찾을 수 없습니다: {validation_file}")
        return
    
    print(f"📂 로딩: {validation_file}")
    samples = load_validation_data(validation_file, num_samples=5)
    
    if not samples:
        print("❌ 샘플을 로드할 수 없습니다.")
        return
    
    print(f"✅ {len(samples)}개 샘플 로드 완료")
    
    # 기본 모델 테스트
    test_basic_gemini(samples)
    
    # 파인튜닝된 모델 테스트
    test_finetuned_gemini(samples)

if __name__ == "__main__":
    main() 