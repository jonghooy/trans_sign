#!/usr/bin/env python3
"""
가장 간단한 Gemini 모델 연결 테스트
"""

import os
import sys
import vertexai
from vertexai.generative_models import GenerativeModel

# 환경 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gemini-service-key.json'
vertexai.init(project="geminisignkorean", location="us-central1")

def test_basic_model():
    """기본 Gemini 모델 테스트"""
    print("🔍 기본 Gemini 2.0 Flash 모델 테스트")
    print("=" * 50)
    
    try:
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        # 매우 간단한 테스트
        response = model.generate_content("안녕하세요")
        
        if response.text:
            print(f"✅ 응답: {response.text}")
        else:
            print("❌ 빈 응답")
            
    except Exception as e:
        print(f"❌ 오류: {e}")

def test_finetuned_model():
    """파인튜닝된 모델 테스트"""
    print("\n🎯 파인튜닝된 Gemini 모델 테스트")
    print("=" * 50)
    
    try:
        model_id = "projects/530606339865/locations/us-central1/models/1203467153647337472@1"
        model = GenerativeModel(model_id)
        
        # 매우 간단한 테스트
        response = model.generate_content("안녕하세요")
        
        if response.text:
            print(f"✅ 응답: {response.text}")
        else:
            print("❌ 빈 응답")
            
    except Exception as e:
        print(f"❌ 오류: {e}")

def test_model_info():
    """모델 정보 확인"""
    print("\n📋 모델 정보 확인")
    print("=" * 50)
    
    try:
        from vertexai.generative_models import GenerativeModel
        
        # 기본 모델 정보
        print("기본 모델: gemini-2.0-flash-exp")
        
        # 파인튜닝 모델 정보
        model_id = "projects/530606339865/locations/us-central1/models/1203467153647337472@1"
        print(f"파인튜닝 모델: {model_id}")
        
        # 모델 존재 여부만 확인
        try:
            model = GenerativeModel(model_id)
            print("✅ 파인튜닝 모델 로드 가능")
        except Exception as e:
            print(f"❌ 파인튜닝 모델 로드 실패: {e}")
            
    except Exception as e:
        print(f"❌ 모델 정보 확인 실패: {e}")

if __name__ == "__main__":
    print("🚀 간단한 Gemini 모델 연결 테스트\n")
    
    test_basic_model()
    test_finetuned_model()
    test_model_info() 