#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
원본 GPT-4.1부터 완전히 새로운 파인튜닝 시작
훈련용 + 검증용 데이터 모두 업로드
"""

import openai
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def upload_training_file(file_path: str, purpose: str = 'fine-tune') -> str:
    """훈련/검증 파일을 OpenAI에 업로드"""
    print(f"📤 파일 업로드 중: {file_path} ({purpose})")
    
    with open(file_path, 'rb') as f:
        response = openai.files.create(
            file=f,
            purpose=purpose
        )
    
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"✅ 파일 업로드 완료: {response.id} ({file_size_mb:.2f} MB)")
    return response.id

def start_fresh_fine_tuning(training_file_id: str, validation_file_id: str = None) -> str:
    """원본 GPT-4.1부터 완전히 새로운 파인튜닝 시작"""
    print("🚀 원본 GPT-4.1 기반 새로운 파인튜닝 시작...")
    
    # 강력한 학습을 위한 파라미터
    hyperparameters = {
        "n_epochs": 2,  # 사용자 요청에 따라 2회 반복
        "learning_rate_multiplier": 0.5  # 적당한 학습률로 안정적 학습
    }
    
    # 파인튜닝 작업 생성 파라미터
    create_params = {
        "training_file": training_file_id,
        "model": "gpt-4.1-2025-04-14",  # 사용자 지정 GPT-4.1 모델
        "hyperparameters": hyperparameters,
        "suffix": "korean-sign-fresh-v2"  # 새로운 버전
    }
    
    # 검증 파일이 있으면 추가
    if validation_file_id:
        create_params["validation_file"] = validation_file_id
        print("🔍 검증 데이터 포함됨")
    
    response = openai.fine_tuning.jobs.create(**create_params)
    
    print(f"✅ 파인튜닝 작업 생성 완료: {response.id}")
    print(f"📊 학습 파라미터:")
    print(f"   - 베이스 모델: gpt-4.1-2025-04-14 (GPT-4.1)")
    print(f"   - Epochs: {hyperparameters['n_epochs']}")
    print(f"   - Learning Rate: {hyperparameters['learning_rate_multiplier']}")
    print(f"   - 훈련 파일: {training_file_id}")
    if validation_file_id:
        print(f"   - 검증 파일: {validation_file_id}")
    
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
            
            # 훈련 진행률 표시 (있다면)
            progress_info = ""
            if hasattr(job, 'trained_tokens') and job.trained_tokens:
                progress_info = f" | 훈련된 토큰: {job.trained_tokens:,}"
            
            print(f"⏰ [{elapsed_min:02d}:{elapsed_sec:02d}] 상태: {status}{progress_info}")
            
            if status == "succeeded":
                print(f"🎉 파인튜닝 완료!")
                print(f"🆔 새 모델 ID: {job.fine_tuned_model}")
                
                # 결과 통계 출력
                if hasattr(job, 'result_files') and job.result_files:
                    print(f"📊 결과 파일: {job.result_files}")
                
                # 모델 정보 업데이트
                update_model_info(job.fine_tuned_model, job_id)
                
                print("\n🎯 새로운 GPT-4.1 기반 모델이 준비되었습니다!")
                print(f"📋 모델 ID: {job.fine_tuned_model}")
                break
                
            elif status == "failed":
                print(f"❌ 파인튜닝 실패: {getattr(job, 'error', '알 수 없는 오류')}")
                break
                
            elif status in ["cancelled", "timeout"]:
                print(f"⚠️ 파인튜닝 중단: {status}")
                break
            
            # 상태에 따른 대기 시간 조정
            if status == "validating_files":
                time.sleep(60)  # 검증 중에는 1분마다
            else:
                time.sleep(120)  # 학습 중에는 2분마다
            
        except Exception as e:
            print(f"❌ 상태 확인 오류: {e}")
            time.sleep(60)

def update_model_info(model_id: str, job_id: str):
    """새 모델 정보를 model_info.json에 저장"""
    model_info = {
        "fine_tuned_model_id": model_id,
        "job_id": job_id,
        "base_model": "gpt-4.1-2025-04-14",
        "status": "succeeded",
        "created_at": int(time.time()),
        "training_data": "sign_to_korean_filtered_train.jsonl (89,993개)",
        "validation_data": "sign_to_korean_filtered_validation.jsonl (10,000개)",
        "version": "4.0",
        "improvements": "gpt-4.1-2025-04-14 베이스로 완전히 새로운 파인튜닝 - {2024}년 등 엉터리 번역 완전 제거 목표 (epoch=2, 90K train + 10K validation)"
    }
    
    os.makedirs("data", exist_ok=True)
    
    with open("data/model_info.json", "w", encoding="utf-8") as f:
        json.dump(model_info, f, ensure_ascii=False, indent=2)
    
    print(f"💾 모델 정보 저장 완료: data/model_info.json")

def main():
    print("🤖 GPT-4.1-2025-04-14 기반 새로운 파인튜닝")
    print("=" * 60)
    print("🎯 목표: 깨끗한 모델부터 시작하여 {2024}년 등 엉터리 번역 완전 방지")
    print("💪 전략: gpt-4.1-2025-04-14 + 9만 훈련 + 1만 검증")
    print("🔥 기존 파인튜닝 모델의 편향 완전 제거")
    print()

    if not openai.api_key:
        print("❌ OPENAI_API_KEY가 .env 파일에 설정되지 않았거나 로드되지 않았습니다.")
        print(".env 파일에 다음과 같이 설정하세요:")
        print("OPENAI_API_KEY=your-api-key-here")
        return

    print(f"✅ OpenAI API 키 로드 완료: {openai.api_key[:20]}...")

    # 파일 존재 확인
    train_file = "sign_to_korean_filtered_train.jsonl"
    validation_file = "sign_to_korean_filtered_validation.jsonl"
    
    if not os.path.exists(train_file):
        print(f"❌ 훈련 파일을 찾을 수 없습니다: {train_file}")
        print("먼저 split_train_validation.py를 실행하세요.")
        return
        
    if not os.path.exists(validation_file):
        print(f"❌ 검증 파일을 찾을 수 없습니다: {validation_file}")
        print("먼저 split_train_validation.py를 실행하세요.")
        return

    # 파일 크기 확인
    train_size_mb = os.path.getsize(train_file) / (1024 * 1024)
    validation_size_mb = os.path.getsize(validation_file) / (1024 * 1024)
    
    print(f"📁 파일 정보:")
    print(f"   🎯 훈련용: {train_file} ({train_size_mb:.2f} MB)")
    print(f"   🔍 검증용: {validation_file} ({validation_size_mb:.2f} MB)")
    
    # 사용자 확인
    print("\n⚠️  중요 사항:")
    print("1. gpt-4.1-2025-04-14 베이스로 완전히 새로 시작합니다")
    print("2. 기존 파인튜닝 모델의 편향을 완전히 제거합니다")
    print("3. 89,993개 훈련 + 10,000개 검증 데이터 사용")
    print("4. epoch=2, learning_rate=0.5로 학습합니다")
    print("5. 학습 시간이 오래 걸릴 수 있습니다 (3-6시간)")
    print("6. 비용이 많이 발생할 수 있습니다")
    
    confirm = input("\n🤔 gpt-4.1-2025-04-14 베이스로 새로 시작하시겠습니까? (y/N): ").strip().lower()
    if confirm != 'y':
        print("❌ 작업이 취소되었습니다.")
        return
    
    try:
        # 1. 훈련 파일 업로드
        training_file_id = upload_training_file(train_file)
        
        # 2. 검증 파일 업로드
        validation_file_id = upload_training_file(validation_file, 'fine-tune')
        
        # 3. 새로운 파인튜닝 시작
        job_id = start_fresh_fine_tuning(training_file_id, validation_file_id)
        
        # 4. 진행 상황 모니터링
        monitor_fine_tuning(job_id)
        
        print("\n🎯 다음 단계:")
        print("1. .env 파일에서 OPENAI_FINE_TUNED_MODEL_ID를 새 모델 ID로 업데이트")
        print("2. 애플리케이션 재시작")
        print("3. 새로운 깨끗한 모델로 번역 테스트")
        print("4. {2024}년, {6}월 등의 엉터리 번역이 완전히 사라졌는지 확인")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return

if __name__ == "__main__":
    main()
