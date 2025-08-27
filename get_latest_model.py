#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
최신 완료된 파인튜닝 모델 정보 가져오기
"""

import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def get_latest_model():
    """최신 완료된 파인튜닝 모델 정보 가져오기"""
    print("🔍 최신 파인튜닝 모델 정보 조회...")
    
    try:
        # 최신 성공한 작업 찾기
        job_id = "ftjob-lmRen0p85BeJFWJ9rbBB1tGI"  # 최신 성공 작업
        
        job = openai.fine_tuning.jobs.retrieve(job_id)
        
        print(f"📋 작업 정보:")
        print(f"   - 작업 ID: {job.id}")
        print(f"   - 상태: {job.status}")
        print(f"   - 모델 ID: {job.fine_tuned_model}")
        print(f"   - 베이스 모델: {job.model}")
        print(f"   - 생성 시간: {job.created_at}")
        
        if hasattr(job, 'trained_tokens'):
            print(f"   - 훈련된 토큰: {job.trained_tokens:,}")
            
        if hasattr(job, 'hyperparameters'):
            print(f"   - Epochs: {job.hyperparameters.n_epochs}")
            print(f"   - Learning Rate: {job.hyperparameters.learning_rate_multiplier}")
        
        return job.fine_tuned_model, job.id
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        return None, None

def update_model_info(model_id: str, job_id: str):
    """model_info.json 업데이트"""
    print(f"💾 모델 정보 업데이트 중...")
    
    model_info = {
        "fine_tuned_model_id": model_id,
        "job_id": job_id,
        "base_model": "gpt-4.1-2025-04-14",
        "status": "succeeded",
        "created_at": int(__import__('time').time()),
        "training_data": "sign_to_korean_filtered_train.jsonl (89,993개)",
        "validation_data": "sign_to_korean_filtered_validation.jsonl (10,000개)",
        "version": "4.0",
        "improvements": "gpt-4.1-2025-04-14 베이스로 완전히 새로운 파인튜닝 - {2024}년 등 엉터리 번역 완전 제거 목표 (epoch=2, 90K train + 10K validation)"
    }
    
    os.makedirs("data", exist_ok=True)
    
    with open("data/model_info.json", "w", encoding="utf-8") as f:
        json.dump(model_info, f, ensure_ascii=False, indent=2)
    
    print(f"✅ model_info.json 업데이트 완료")

if __name__ == "__main__":
    model_id, job_id = get_latest_model()
    if model_id:
        update_model_info(model_id, job_id)
        print(f"\n🎯 새로운 모델 준비 완료!")
        print(f"📋 모델 ID: {model_id}")
        print(f"\n다음 단계:")
        print(f"1. .env 파일에 OPENAI_FINE_TUNED_MODEL_ID={model_id} 설정")
        print(f"2. 서버 재시작")
