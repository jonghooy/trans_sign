#!/usr/bin/env python3
"""
파인튜닝된 Gemini 모델 디버깅 및 재검토
"""

import os
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import aiplatform
import time

# 환경 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gemini-service-key.json'

# 모델 정보
PROJECT_ID = "geminisignkorean"  # 실제 프로젝트 번호가 아닌 ID
PROJECT_NUMBER = "530606339865"  # 프로젝트 번호
LOCATION = "us-central1"
MODEL_ID = "1203467153647337472"
ENDPOINT_ID = "5169953151826001920"

def test_method_1_model_id():
    """방법 1: 모델 ID로 직접 호출"""
    print("📍 방법 1: 모델 ID로 직접 호출")
    print("=" * 50)
    
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        
        # 다양한 형식 시도
        model_paths = [
            f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/models/{MODEL_ID}@1",
            f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/models/{MODEL_ID}",
            f"{MODEL_ID}@1",
            f"{MODEL_ID}",
        ]
        
        for model_path in model_paths:
            print(f"\n시도: {model_path}")
            try:
                model = GenerativeModel(model_path)
                response = model.generate_content("안녕")
                print(f"✅ 성공: {response.text}")
                return True
            except Exception as e:
                print(f"❌ 실패: {e}")
                
    except Exception as e:
        print(f"❌ 초기화 실패: {e}")
    
    return False

def test_method_2_endpoint():
    """방법 2: 엔드포인트 사용"""
    print("\n📍 방법 2: 엔드포인트 직접 사용")
    print("=" * 50)
    
    try:
        aiplatform.init(project=PROJECT_ID, location=LOCATION)
        
        endpoint_path = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/endpoints/{ENDPOINT_ID}"
        print(f"엔드포인트: {endpoint_path}")
        
        endpoint = aiplatform.Endpoint(endpoint_path)
        
        # 간단한 예측 요청
        instances = [{"content": "안녕하세요"}]
        
        try:
            predictions = endpoint.predict(instances=instances)
            print(f"✅ 예측 성공: {predictions}")
            return True
        except Exception as e:
            print(f"❌ 예측 실패: {e}")
            
    except Exception as e:
        print(f"❌ 엔드포인트 초기화 실패: {e}")
    
    return False

def test_method_3_project_number():
    """방법 3: 프로젝트 번호 사용"""
    print("\n📍 방법 3: 프로젝트 번호로 초기화")
    print("=" * 50)
    
    try:
        # 프로젝트 번호로 초기화
        vertexai.init(project=PROJECT_NUMBER, location=LOCATION)
        
        model_path = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/models/{MODEL_ID}@1"
        print(f"모델 경로: {model_path}")
        
        model = GenerativeModel(model_path)
        response = model.generate_content("안녕")
        print(f"✅ 성공: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ 실패: {e}")
    
    return False

def test_method_4_base_model():
    """방법 4: 기본 모델로 파인튜닝 확인"""
    print("\n📍 방법 4: 기본 Gemini Flash 모델 재확인")
    print("=" * 50)
    
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        
        # 기본 모델 테스트
        base_model = GenerativeModel("gemini-2.0-flash-exp")
        response = base_model.generate_content("수어로 번역: 안녕하세요")
        print(f"✅ 기본 모델 작동: {response.text}")
        
        # 파인튜닝 모델과 동일한 구조로 호출
        finetuned_model = GenerativeModel(f"{MODEL_ID}@1")
        response = finetuned_model.generate_content("안녕하세요")
        print(f"✅ 파인튜닝 모델 작동: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ 실패: {e}")
    
    return False

def test_method_5_minimal():
    """방법 5: 최소한의 설정으로 테스트"""
    print("\n📍 방법 5: 최소한의 설정")
    print("=" * 50)
    
    try:
        import google.auth
        credentials, project = google.auth.default()
        print(f"인증된 프로젝트: {project}")
        
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
        
        # 모델 리소스 이름 직접 구성
        model_name = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/models/{MODEL_ID}"
        print(f"모델 리소스 이름: {model_name}")
        
        model = GenerativeModel(model_name)
        
        # 매우 간단한 텍스트
        response = model.generate_content(
            "Hi",
            generation_config={
                "temperature": 0,
                "max_output_tokens": 10,
            }
        )
        
        if response.text:
            print(f"✅ 응답: {response.text}")
            return True
        else:
            print("❌ 빈 응답")
            
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()
    
    return False

def check_model_status():
    """모델 상태 확인"""
    print("\n📍 모델 메타데이터 확인")
    print("=" * 50)
    
    try:
        aiplatform.init(project=PROJECT_ID, location=LOCATION)
        
        # 모델 객체 가져오기
        model_name = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/models/{MODEL_ID}"
        model = aiplatform.Model(model_name)
        
        print(f"모델 이름: {model.display_name}")
        print(f"모델 상태: {model.state}")
        print(f"생성 시간: {model.create_time}")
        print(f"업데이트 시간: {model.update_time}")
        
        # 엔드포인트 정보
        if hasattr(model, 'deployed_model_refs'):
            print(f"배포된 엔드포인트: {model.deployed_model_refs}")
            
    except Exception as e:
        print(f"❌ 모델 정보 조회 실패: {e}")

def main():
    """메인 함수"""
    print("🔍 파인튜닝된 Gemini 모델 종합 디버깅")
    print("=" * 60)
    print(f"프로젝트 ID: {PROJECT_ID}")
    print(f"프로젝트 번호: {PROJECT_NUMBER}")
    print(f"모델 ID: {MODEL_ID}")
    print(f"엔드포인트 ID: {ENDPOINT_ID}")
    print("=" * 60)
    
    # 모델 상태 확인
    check_model_status()
    
    # 다양한 방법 시도
    methods = [
        test_method_1_model_id,
        test_method_2_endpoint,
        test_method_3_project_number,
        test_method_4_base_model,
        test_method_5_minimal,
    ]
    
    success = False
    for method in methods:
        if method():
            success = True
            break
        time.sleep(2)  # API 호출 간격
    
    if not success:
        print("\n❌ 모든 방법이 실패했습니다.")
        print("\n💡 가능한 원인:")
        print("1. 모델이 아직 완전히 배포되지 않음")
        print("2. 권한 문제")
        print("3. API 버전 불일치")
        print("4. 파인튜닝 모델 형식 문제")
    else:
        print("\n✅ 모델 사용 가능!")

if __name__ == "__main__":
    main() 