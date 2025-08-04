#!/usr/bin/env python3
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 환경변수 로드
load_dotenv()

class SignLanguageTranslator:
    def __init__(self, model_info_file='model_info.json'):
        """모델 정보 로드 및 클라이언트 초기화"""
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # 모델 정보 로드
        try:
            with open(model_info_file, 'r', encoding='utf-8') as f:
                self.model_info = json.load(f)
            self.model_id = self.model_info['fine_tuned_model_id']
            print(f"🤖 로드된 모델: {self.model_id}")
        except FileNotFoundError:
            print(f"❌ {model_info_file} 파일을 찾을 수 없습니다.")
            print("먼저 fine_tune_gpt4o.py를 실행해주세요!")
            return
        except KeyError:
            print(f"❌ {model_info_file}에서 모델 ID를 찾을 수 없습니다.")
            return

    def translate_to_sign(self, korean_text, temperature=0.1):
        """한국어 문장을 수어로 번역"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "user", "content": korean_text}
                ],
                max_tokens=200,
                temperature=temperature
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"❌ 번역 실패: {e}")
            return None

    def interactive_mode(self):
        """대화형 번역 모드"""
        print("\n🗣️  수어 번역기 (Interactive Mode)")
        print("한국어 문장을 입력하면 수어로 번역해드립니다.")
        print("종료하려면 'quit' 또는 'exit'를 입력하세요.\n")
        
        while True:
            korean_text = input("🇰🇷 한국어 입력: ").strip()
            
            if korean_text.lower() in ['quit', 'exit', '종료']:
                print("👋 수어 번역기를 종료합니다!")
                break
            
            if not korean_text:
                continue
            
            print("🤖 번역 중...")
            sign_translation = self.translate_to_sign(korean_text)
            
            if sign_translation:
                print(f"👋 수어 번역: {sign_translation}\n")
            else:
                print("❌ 번역에 실패했습니다.\n")

    def batch_translate(self, input_file, output_file):
        """파일 단위 일괄 번역"""
        print(f"📄 파일 일괄 번역: {input_file} → {output_file}")
        
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            translations = []
            
            for i, line in enumerate(lines, 1):
                korean_text = line.strip()
                if not korean_text:
                    continue
                
                print(f"번역 중... {i}/{len(lines)}")
                sign_translation = self.translate_to_sign(korean_text)
                
                translations.append({
                    "korean": korean_text,
                    "sign": sign_translation
                })
            
            # 결과 저장
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(translations, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 일괄 번역 완료! 결과: {output_file}")
            
        except FileNotFoundError:
            print(f"❌ 입력 파일을 찾을 수 없습니다: {input_file}")

    def test_samples(self):
        """몇 가지 샘플 테스트"""
        samples = [
            "안녕하세요, 반갑습니다.",
            "오늘 날씨가 정말 좋네요.",
            "수어를 배우고 싶어요.",
            "병원에 가야 할 것 같아요.",
            "가족들과 함께 저녁을 먹었습니다."
        ]
        
        print("\n🧪 샘플 테스트:")
        print("=" * 60)
        
        for i, sample in enumerate(samples, 1):
            print(f"\n테스트 {i}:")
            print(f"🇰🇷 한국어: {sample}")
            
            sign_translation = self.translate_to_sign(sample)
            print(f"👋 수어: {sign_translation}")
        
        print("=" * 60)

def main():
    # API 키 확인
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ .env 파일에 OPENAI_API_KEY를 설정해주세요!")
        return
    
    # 번역기 초기화
    translator = SignLanguageTranslator()
    
    if not hasattr(translator, 'model_id'):
        return
    
    print("\n선택하세요:")
    print("1. 대화형 번역 모드")
    print("2. 샘플 테스트")
    print("3. 파일 일괄 번역")
    
    choice = input("\n번호를 입력하세요 (1-3): ").strip()
    
    if choice == "1":
        translator.interactive_mode()
    elif choice == "2":
        translator.test_samples()
    elif choice == "3":
        input_file = input("입력 파일명: ").strip()
        output_file = input("출력 파일명 (기본: translations.json): ").strip()
        if not output_file:
            output_file = "translations.json"
        translator.batch_translate(input_file, output_file)
    else:
        print("잘못된 선택입니다.")

if __name__ == "__main__":
    main() 