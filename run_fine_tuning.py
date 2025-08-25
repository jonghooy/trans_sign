#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenAI 파인튜닝 실행 스크립트

사용법:
    python run_fine_tuning.py
"""

import openai
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv

# .env 파일에서 환경변수 로드
load_dotenv()

# OpenAI API 키 설정
openai.api_key = os.getenv('OPENAI_API_KEY')

def upload_training_file(file_path: str) -> str:
    """훈련 파일을 OpenAI에 업로드"""
    
    print(f"📤 파일 업로드 중: {file_path}")
    
    try:
        with open(file_path, "rb") as f:
            response = openai.files.create(
                file=f,
                purpose="fine-tune"
            )
        
        file_id = response.id
        print(f"✅ 파일 업로드 완료!")
        print(f"📁 파일 ID: {file_id}")
        return file_id
        
    except Exception as e:
        print(f"❌ 파일 업로드 실패: {e}")
        return None

def start_fine_tuning(training_file_id: str, base_model: str = None) -> str:
    """파인튜닝 작업 시작"""
    
    # 기존 파인튜닝 모델이 있으면 그것을 베이스로 사용
    if base_model:
        print(f"🔄 기존 모델 기반 추가 파인튜닝: {base_model}")
        model = base_model
    else:
        print(f"🆕 새로운 파인튜닝 시작")
        model = "gpt-4o-mini-2024-07-18"  # 또는 "gpt-3.5-turbo-1106"
    
    try:
        response = openai.fine_tuning.jobs.create(
            training_file=training_file_id,
            model=model,
            hyperparameters={
                "n_epochs": 1,  # 에포크 수 (완전히 잘못 나오는 현상만 막기 위함)
                "learning_rate_multiplier": 0.5 if base_model else 1.0  # 기존 모델 기반이면 낮은 학습률
            }
        )
        
        job_id = response.id
        print(f"🚀 파인튜닝 작업 시작!")
        print(f"🔧 작업 ID: {job_id}")
        return job_id
        
    except Exception as e:
        print(f"❌ 파인튜닝 시작 실패: {e}")
        return None

def monitor_fine_tuning(job_id: str):
    """파인튜닝 진행 상황 모니터링"""
    
    print(f"👀 파인튜닝 진행 상황 모니터링: {job_id}")
    print("-" * 50)
    
    while True:
        try:
            job = openai.fine_tuning.jobs.retrieve(job_id)
            status = job.status
            
            print(f"⏰ {datetime.now().strftime('%H:%M:%S')} | 상태: {status}")
            
            if status == "succeeded":
                model_id = job.fine_tuned_model
                print(f"🎉 파인튜닝 완료!")
                print(f"🤖 새 모델 ID: {model_id}")
                
                # model_info.json 업데이트
                update_model_info(model_id, job_id)
                break
                
            elif status == "failed":
                print(f"❌ 파인튜닝 실패")
                print(f"오류: {job.error}")
                break
                
            elif status in ["running", "validating_files"]:
                print(f"🔄 진행 중... 30초 후 다시 확인")
                time.sleep(30)
                
            else:
                print(f"⏳ 대기 중... 30초 후 다시 확인")
                time.sleep(30)
                
        except Exception as e:
            print(f"❌ 상태 확인 오류: {e}")
            time.sleep(30)

def update_model_info(model_id: str, job_id: str):
    """model_info.json 파일 업데이트"""
    
    model_info = {
        "fine_tuned_model_id": model_id,
        "job_id": job_id,
        "base_model": "gpt-4o-mini-2024-07-18",
        "status": "succeeded",
        "created_at": int(time.time()),
        "training_data": "sign_to_korean_sample_10k.jsonl (10,000개)",
        "version": "2.0",
        "improvements": "1만 문장으로 {2024}년 등 엉터리 번역 현상 방지 (epoch=1)"
    }
    
    try:
        with open("data/model_info.json", "w", encoding="utf-8") as f:
            json.dump(model_info, f, indent=2, ensure_ascii=False)
        
        print(f"📝 model_info.json 업데이트 완료")
        
    except Exception as e:
        print(f"⚠️ model_info.json 업데이트 실패: {e}")

def main():
    """메인 함수"""
    
    print("🤖 OpenAI 파인튜닝 실행기")
    print("=" * 50)
    
    # API 키 확인
    if not openai.api_key:
        print("❌ OPENAI_API_KEY가 .env 파일에 설정되지 않았거나 로드되지 않았습니다.")
        print(".env 파일에 다음과 같이 설정하세요:")
        print("OPENAI_API_KEY=your-api-key-here")
        return
    
    print(f"✅ OpenAI API 키 로드 완료: {openai.api_key[:20]}...")
    
    # 훈련 파일 확인 (10,000개 샘플 데이터 사용)
    training_file = "sign_to_korean_sample_10k.jsonl"
    if not os.path.exists(training_file):
        print(f"❌ 훈련 파일을 찾을 수 없습니다: {training_file}")
        print("먼저 create_sample_data.py를 실행하세요.")
        return
    
    print(f"📁 훈련 파일: {training_file}")
    
    # 기존 모델 사용 여부 확인
    use_existing = input("🔄 기존 파인튜닝 모델을 베이스로 사용하시겠습니까? (y/N): ").strip().lower()
    base_model = None
    
    if use_existing == 'y':
        # model_info.json에서 기존 모델 ID 읽기
        try:
            with open("data/model_info.json", "r") as f:
                model_info = json.load(f)
            base_model = model_info.get("fine_tuned_model_id")
            print(f"🔗 기존 모델: {base_model}")
        except:
            print("⚠️ 기존 모델 정보를 찾을 수 없습니다. 새로운 파인튜닝을 시작합니다.")
    
    print("-" * 50)
    
    # 1. 파일 업로드
    file_id = upload_training_file(training_file)
    if not file_id:
        return
    
    # 2. 파인튜닝 시작
    job_id = start_fine_tuning(file_id, base_model)
    if not job_id:
        return
    
    # 3. 진행 상황 모니터링
    monitor_fine_tuning(job_id)
    
    print("\n🎯 다음 단계:")
    print("1. .env 파일에서 OPENAI_FINE_TUNED_MODEL_ID 업데이트")
    print("2. 애플리케이션 재시작")
    print("3. 새 모델로 번역 테스트")

if __name__ == "__main__":
    main()
