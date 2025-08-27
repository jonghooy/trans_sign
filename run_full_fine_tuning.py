#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
10만 문장 전체 데이터로 새로운 파인튜닝 모델 생성
기존 모델의 편향을 완전히 극복하기 위한 새 모델 학습
"""

import openai
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def upload_training_file(file_path: str) -> str:
    """훈련 파일을 OpenAI에 업로드"""
    print(f"📤 훈련 파일 업로드 중: {file_path}")
    
    with open(file_path, 'rb') as f:
        response = openai.files.create(
            file=f,
            purpose='fine-tune'
        )
    
    print(f"✅ 파일 업로드 완료: {response.id}")
    return response.id

def start_new_fine_tuning(training_file_id: str) -> str:
    """기존 GPT-4.1 파인튜닝 모델을 베이스로 추가 학습"""
    print("🚀 GPT-4.1 모델 기반 추가 학습 시작...")
    
    # 기존 모델 정보 읽기
    current_model = "ft:gpt-4.1-2025-04-14:personal::C8SL0o5t"  # 현재 사용중인 모델
    
    # 추가 학습을 위한 보수적 파라미터
    hyperparameters = {
        "n_epochs": 2,  # 기존 모델 기반이므로 2회 반복
        "learning_rate_multiplier": 0.3  # 기존 학습을 보존하면서 추가 학습
    }
    
    response = openai.fine_tuning.jobs.create(
        training_file=training_file_id,
        model=current_model,  # 기존 GPT-4.1 파인튜닝 모델 사용
        hyperparameters=hyperparameters,
        suffix="korean-sign-translator-v3-enhanced"  # 강화 버전 표시
    )
    
    print(f"✅ 파인튜닝 작업 생성 완료: {response.id}")
    print(f"📊 학습 파라미터:")
    print(f"   - Epochs: {hyperparameters['n_epochs']}")
    print(f"   - Learning Rate Multiplier: {hyperparameters['learning_rate_multiplier']}")
    print(f"   - 베이스 모델: {current_model} (기존 GPT-4.1 모델 강화)")
    
    return response.id

def monitor_fine_tuning(job_id: str):
    """파인튜닝 진행 상황 모니터링"""
    print(f"👀 파인튜닝 작업 모니터링 시작: {job_id}")
    
    start_time = time.time()
    
    while True:
        try:
            job = openai.fine_tuning.jobs.retrieve(job_id)
            status = job.status
            
            elapsed_time = int(time.time() - start_time)
            elapsed_min = elapsed_time // 60
            elapsed_sec = elapsed_time % 60
            
            print(f"⏰ [{elapsed_min:02d}:{elapsed_sec:02d}] 상태: {status}")
            
            if status == "succeeded":
                print(f"🎉 파인튜닝 완료!")
                print(f"🆔 새 모델 ID: {job.fine_tuned_model}")
                
                # 모델 정보 업데이트
                update_model_info(job.fine_tuned_model, job_id, "sign_to_korean_filtered.jsonl")
                
                print("\n🎯 새 모델이 준비되었습니다!")
                print(f"📋 모델 ID: {job.fine_tuned_model}")
                break
                
            elif status == "failed":
                print(f"❌ 파인튜닝 실패: {job.error}")
                break
                
            elif status in ["cancelled", "timeout"]:
                print(f"⚠️ 파인튜닝 중단: {status}")
                break
            
            # 10만 문장은 오래 걸릴 수 있으므로 2분마다 체크
            time.sleep(120)
            
        except Exception as e:
            print(f"❌ 상태 확인 오류: {e}")
            time.sleep(60)

def update_model_info(model_id: str, job_id: str, training_file: str):
    """새 모델 정보를 model_info.json에 저장"""
    model_info = {
        "fine_tuned_model_id": model_id,
        "job_id": job_id,
        "base_model": "ft:gpt-4.1-2025-04-14:personal::C8SL0o5t",
        "status": "succeeded",
        "created_at": int(time.time()),
        "training_data": f"{training_file} (99,993개)",
        "version": "3.0",
        "improvements": "기존 GPT-4.1 모델에 10만 문장 추가 학습 - {2024}년 등 엉터리 번역 완전 방지 목표 (epoch=2)"
    }
    
    os.makedirs("data", exist_ok=True)
    
    with open("data/model_info.json", "w", encoding="utf-8") as f:
        json.dump(model_info, f, ensure_ascii=False, indent=2)
    
    print(f"💾 모델 정보 저장 완료: data/model_info.json")

def main():
    print("🤖 GPT-4.1 모델 강화 학습기 (10만 문장)")
    print("=" * 60)
    print("🎯 목표: {2024}년, {6}월 등 엉터리 번역 완전 방지")
    print("💪 전략: 기존 GPT-4.1 모델에 10만 문장 추가 학습으로 성능 강화")
    print()

    if not openai.api_key:
        print("❌ OPENAI_API_KEY가 .env 파일에 설정되지 않았거나 로드되지 않았습니다.")
        print(".env 파일에 다음과 같이 설정하세요:")
        print("OPENAI_API_KEY=your-api-key-here")
        return

    print(f"✅ OpenAI API 키 로드 완료: {openai.api_key[:20]}...")

    training_file = "sign_to_korean_filtered.jsonl"
    if not os.path.exists(training_file):
        print(f"❌ 훈련 파일을 찾을 수 없습니다: {training_file}")
        print("99,993개 문장이 포함된 전체 데이터 파일이 필요합니다.")
        return

    # 파일 크기 확인
    file_size_mb = os.path.getsize(training_file) / (1024 * 1024)
    print(f"📁 훈련 파일: {training_file}")
    print(f"📊 파일 크기: {file_size_mb:.2f} MB")
    
    # 사용자 확인
    print("\n⚠️  중요 사항:")
    print("1. 기존 GPT-4.1 파인튜닝 모델을 베이스로 추가 학습합니다")
    print("2. 10만 문장 학습은 시간이 오래 걸릴 수 있습니다 (수 시간)")
    print("3. epoch=2, learning_rate=0.3으로 보수적 추가 학습합니다")
    print("4. 비용이 더 많이 발생할 수 있습니다")
    
    confirm = input("\n🤔 계속 진행하시겠습니까? (y/N): ").strip().lower()
    if confirm != 'y':
        print("❌ 작업이 취소되었습니다.")
        return
    
    try:
        # 1. 파일 업로드
        training_file_id = upload_training_file(training_file)
        
        # 2. 새로운 파인튜닝 시작
        job_id = start_new_fine_tuning(training_file_id)
        
        # 3. 진행 상황 모니터링
        monitor_fine_tuning(job_id)
        
        print("\n🎯 다음 단계:")
        print("1. .env 파일에서 OPENAI_FINE_TUNED_MODEL_ID를 새 모델 ID로 업데이트")
        print("2. 애플리케이션 재시작")
        print("3. 새 모델로 번역 테스트")
        print("4. {2024}년, {6}월 등의 엉터리 번역이 사라졌는지 확인")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return

if __name__ == "__main__":
    main()
