#!/usr/bin/env python3
import os
import time
import json
from dotenv import load_dotenv
from openai import OpenAI

# 환경변수 로드
load_dotenv()

class SignLanguageFineTuner:
    def __init__(self):
        """OpenAI 클라이언트 초기화"""
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # 파일 경로 설정 (전체 데이터셋 사용)
        self.train_file = 'train_full_98pct.jsonl'
        self.validation_file = 'validation_1pct.jsonl'
        self.test_file = 'test_1pct.jsonl'
        
        print("🤖 수어 번역 GPT-4o Fine-tuning 시작!")
        print(f"📚 학습 데이터: {self.train_file}")
        print(f"✅ 검증 데이터: {self.validation_file}")
        print(f"🧪 테스트 데이터: {self.test_file}")

    def upload_files(self):
        """학습 및 검증 파일 업로드"""
        print("\n📤 파일 업로드 중...")
        
        # 학습 파일 업로드
        print(f"📚 학습 파일 업로드: {self.train_file}")
        with open(self.train_file, 'rb') as f:
            self.train_file_obj = self.client.files.create(
                file=f,
                purpose='fine-tune'
            )
        print(f"✅ 학습 파일 업로드 완료 - ID: {self.train_file_obj.id}")
        
        # 검증 파일 업로드
        print(f"✅ 검증 파일 업로드: {self.validation_file}")
        with open(self.validation_file, 'rb') as f:
            self.validation_file_obj = self.client.files.create(
                file=f,
                purpose='fine-tune'
            )
        print(f"✅ 검증 파일 업로드 완료 - ID: {self.validation_file_obj.id}")
        
        return self.train_file_obj.id, self.validation_file_obj.id

    def create_fine_tune_job(self, train_file_id, validation_file_id):
        """Fine-tuning 작업 생성"""
        print("\n🚀 Fine-tuning 작업 생성 중...")
        
        # GPT-4.1 사용 (최신 고성능 모델)
        model = "gpt-4.1-2025-04-14"  # 또는 "gpt-4o-mini-2024-07-18"
        
        self.fine_tune_job = self.client.fine_tuning.jobs.create(
            training_file=train_file_id,
            validation_file=validation_file_id,
            model=model,
            hyperparameters={
                "n_epochs": 3,  # 에포크 수 (1-50)
                "batch_size": "auto",  # 배치 크기
                "learning_rate_multiplier": "auto"  # 학습률 배수
            },
            suffix="sign-korean-translator"  # 모델명 접미사
        )
        
        print(f"✅ Fine-tuning 작업 생성 완료!")
        print(f"📋 작업 ID: {self.fine_tune_job.id}")
        print(f"🎯 모델: {model}")
        print(f"📊 상태: {self.fine_tune_job.status}")
        
        return self.fine_tune_job.id

    def monitor_fine_tune_job(self, job_id):
        """Fine-tuning 진행 상황 모니터링"""
        print(f"\n👀 Fine-tuning 진행 상황 모니터링 중... (작업 ID: {job_id})")
        print("⏳ 학습이 완료될 때까지 기다립니다. (보통 10-30분 소요)")
        
        start_time = time.time()
        
        while True:
            job = self.client.fine_tuning.jobs.retrieve(job_id)
            status = job.status
            elapsed_time = int(time.time() - start_time)
            
            print(f"⏰ {elapsed_time//60:02d}:{elapsed_time%60:02d} - 상태: {status}")
            
            if status == "succeeded":
                print(f"🎉 Fine-tuning 완료!")
                print(f"✅ 완성된 모델: {job.fine_tuned_model}")
                self.fine_tuned_model_id = job.fine_tuned_model
                break
            elif status == "failed":
                print(f"❌ Fine-tuning 실패")
                if job.error:
                    print(f"오류 내용: {job.error}")
                break
            elif status in ["cancelled", "cancelling"]:
                print(f"🚫 Fine-tuning 취소됨")
                break
            
            # 30초마다 상태 확인
            time.sleep(30)
        
        return job

    def test_model(self, model_id, num_tests=5):
        """완성된 모델 테스트"""
        print(f"\n🧪 모델 테스트 중... (모델: {model_id})")
        
        # 테스트 데이터에서 몇 개 샘플 선택
        test_samples = []
        with open(self.test_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= num_tests:
                    break
                test_samples.append(json.loads(line.strip()))
        
        print(f"📝 {len(test_samples)}개 테스트 샘플로 모델 성능 확인:")
        print("=" * 80)
        
        for i, sample in enumerate(test_samples, 1):
            korean_text = sample['messages'][0]['content']
            expected_sign = sample['messages'][1]['content']
            
            # 모델에게 예측 요청
            try:
                response = self.client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "user", "content": korean_text}
                    ],
                    max_tokens=200,
                    temperature=0.1
                )
                
                predicted_sign = response.choices[0].message.content
                
                print(f"\n테스트 {i}:")
                print(f"🗣️  입력: {korean_text}")
                print(f"✅ 정답: {expected_sign}")
                print(f"🤖 예측: {predicted_sign}")
                print(f"📊 일치: {'✅' if predicted_sign.strip() == expected_sign.strip() else '❌'}")
                
            except Exception as e:
                print(f"❌ 테스트 {i} 실패: {e}")
        
        print("=" * 80)

    def save_model_info(self, model_id, job_id):
        """모델 정보 저장"""
        model_info = {
            "fine_tuned_model_id": model_id,
            "fine_tune_job_id": job_id,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "train_file": self.train_file,
            "validation_file": self.validation_file,
            "test_file": self.test_file
        }
        
        with open('model_info.json', 'w', encoding='utf-8') as f:
            json.dump(model_info, f, ensure_ascii=False, indent=2)
        
        print(f"📄 모델 정보가 model_info.json에 저장되었습니다.")

    def run_full_pipeline(self):
        """전체 파이프라인 실행"""
        try:
            # 1. 파일 업로드
            train_file_id, validation_file_id = self.upload_files()
            
            # 2. Fine-tuning 작업 생성
            job_id = self.create_fine_tune_job(train_file_id, validation_file_id)
            
            # 3. 진행 상황 모니터링
            job = self.monitor_fine_tune_job(job_id)
            
            if job.status == "succeeded":
                # 4. 모델 테스트
                self.test_model(job.fine_tuned_model)
                
                # 5. 모델 정보 저장
                self.save_model_info(job.fine_tuned_model, job_id)
                
                print(f"\n🎊 수어 번역 모델 fine-tuning 완료!")
                print(f"🤖 사용 가능한 모델: {job.fine_tuned_model}")
                
        except Exception as e:
            print(f"❌ 오류 발생: {e}")

def main():
    # API 키 확인
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ .env 파일에 OPENAI_API_KEY를 설정해주세요!")
        return
    
    # Fine-tuner 실행
    fine_tuner = SignLanguageFineTuner()
    fine_tuner.run_full_pipeline()

if __name__ == "__main__":
    main() 