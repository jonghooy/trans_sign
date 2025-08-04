#!/usr/bin/env python3
"""
기본 Gemini 모델 연결 테스트
"""

import vertexai
from vertexai.generative_models import GenerativeModel

def test_basic_gemini():
    """기본 Gemini 모델 테스트"""
    
    # 프로젝트 설정
    PROJECT_ID = "geminisignkorean"
    LOCATION = "us-central1"
    
    try:
        # Vertex AI 초기화
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        print("✅ Vertex AI 초기화 완료")
        
        # 기본 Gemini 2.5 Flash 모델 로드
        model = GenerativeModel("gemini-2.5-flash")
        print("✅ 기본 Gemini 2.5 Flash 모델 로드 완료")
        
        # 간단한 테스트
        test_prompt = "안녕하세요를 수어로 번역해주세요. 형식: 단어+단어"
        
        print(f"\n테스트 프롬프트: {test_prompt}")
        print("응답 생성 중...")
        
        response = model.generate_content(test_prompt)
        print(f"✅ 응답: {response.text}")
        
        return True
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return False

def test_tuned_model():
    """파인튜닝된 모델 테스트"""
    
    PROJECT_ID = "geminisignkorean"
    LOCATION = "us-central1"
    
    try:
        # Vertex AI 초기화
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        
        # 파인튜닝된 모델 로드 (완전한 경로)
        tuned_model_name = "projects/530606339865/locations/us-central1/models/1203467153647337472"
        
        print(f"파인튜닝된 모델 로드 시도: {tuned_model_name}")
        
        model = GenerativeModel(tuned_model_name)
        print("✅ 파인튜닝된 모델 로드 완료")
        
        # 간단한 테스트
        test_prompt = "안녕하세요"
        
        print(f"\n테스트 프롬프트: {test_prompt}")
        print("응답 생성 중...")
        
        response = model.generate_content(test_prompt)
        print(f"✅ 응답: {response.text}")
        
        return True
        
    except Exception as e:
        print(f"❌ 파인튜닝된 모델 오류: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Gemini 모델 연결 테스트")
    print("=" * 50)
    
    print("\n1. 기본 Gemini 2.5 Flash 모델 테스트")
    basic_success = test_basic_gemini()
    
    print("\n" + "=" * 50)
    print("\n2. 파인튜닝된 모델 테스트")
    tuned_success = test_tuned_model()
    
    print("\n" + "=" * 50)
    print(f"결과:")
    print(f"  기본 모델: {'✅ 성공' if basic_success else '❌ 실패'}")
    print(f"  파인튜닝 모델: {'✅ 성공' if tuned_success else '❌ 실패'}") 