#!/usr/bin/env python3
"""
기본 Gemini 2.5 Flash 모델로 평가 (베이스라인 성능 측정)

파인튜닝된 모델과 비교하기 위한 베이스라인 성능을 측정합니다.
"""

import os
import json
import time
import re
from datetime import datetime
from typing import List, Dict, Tuple
import vertexai
from vertexai.generative_models import GenerativeModel

class BaselineGeminiEvaluator:
    def __init__(self, project_id: str, location: str = "us-central1"):
        """
        기본 Gemini 모델 평가자 초기화
        
        Args:
            project_id: Google Cloud 프로젝트 ID
            location: Vertex AI 지역
        """
        self.project_id = project_id
        self.location = location
        
        # Vertex AI 초기화
        vertexai.init(project=project_id, location=location)
        
        # 기본 Gemini 2.5 Flash 모델 로드
        try:
            # 수어 번역에 특화된 시스템 인스트럭션
            system_instruction = """당신은 한국어를 한국 수어로 번역하는 전문가입니다. 

주어진 한국어 문장을 정확하고 자연스러운 한국 수어 표기법으로 번역해주세요. 

번역 규칙:
1. 단어는 '+'로 연결합니다
2. 고유명사나 숫자는 {}로 감쌉니다
3. 수어 문법에 맞게 어순을 조정합니다
4. 간결하고 명확한 표현을 사용합니다

예시:
- "안녕하세요" → "안녕+인사"
- "백령도는 1년에 100일은 기본적으로 해무가 끼지 않아?" → "{백령도}+{1}+년+{100}일+기본+해무+없다"

번역 결과만 출력하고 설명은 생략하세요."""

            self.model = GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_instruction
            )
            print(f"✅ 기본 Gemini 2.5 Flash 모델 로드 완료")
        except Exception as e:
            print(f"❌ 모델 로드 실패: {e}")
            raise

    def translate_to_sign(self, korean_text: str, temperature: float = 0.1) -> str:
        """
        한국어 문장을 수어로 번역
        
        Args:
            korean_text: 번역할 한국어 문장
            temperature: 생성 온도 (기본값: 0.1)
            
        Returns:
            수어 번역 결과
        """
        try:
            # 생성 설정
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": 200,
                "top_p": 0.8,
                "top_k": 40
            }
            
            response = self.model.generate_content(
                korean_text,
                generation_config=generation_config
            )
            
            # 응답에서 수어 번역 부분만 추출
            text = response.text.strip()
            
            # "+" 포함된 번역 결과 추출 (간단한 후처리)
            lines = text.split('\n')
            for line in lines:
                line = line.strip()
                # "+" 문자가 포함된 라인을 찾음
                if '+' in line and len(line.split('+')) >= 2:
                    # 불필요한 기호나 텍스트 제거
                    cleaned = re.sub(r'[→\-\*•]', '', line)
                    cleaned = cleaned.strip()
                    # "로 감싸진 부분 추출
                    if '"' in cleaned:
                        match = re.search(r'"([^"]*)"', cleaned)
                        if match:
                            return match.group(1)
                    return cleaned
            
            # "+" 문자가 없으면 첫 번째 라인 반환
            return lines[0] if lines else text
            
        except Exception as e:
            print(f"❌ 번역 실패 ({korean_text[:30]}...): {e}")
            return ""

    def calculate_jaccard_similarity(self, predicted: str, expected: str) -> float:
        """Jaccard 유사도 계산"""
        pred_words = set(predicted.split('+')) if predicted else set()
        exp_words = set(expected.split('+')) if expected else set()
        
        intersection = pred_words.intersection(exp_words)
        union = pred_words.union(exp_words)
        
        if len(union) == 0:
            return 1.0 if len(pred_words) == 0 and len(exp_words) == 0 else 0.0
        
        return len(intersection) / len(union)

    def calculate_word_accuracy(self, predicted: str, expected: str) -> Dict:
        """단어 정확도 계산"""
        pred_words = predicted.split('+') if predicted else []
        exp_words = expected.split('+') if expected else []
        
        pred_set = set(pred_words)
        exp_set = set(exp_words)
        matching_words = len(pred_set.intersection(exp_set))
        
        if len(exp_words) == 0:
            accuracy = 1.0 if len(pred_words) == 0 else 0.0
        else:
            accuracy = matching_words / len(exp_words)
        
        return {
            "word_accuracy": accuracy,
            "predicted_words": len(pred_words),
            "expected_words": len(exp_words),
            "matching_words": matching_words
        }

    def load_test_data(self, test_file_path: str) -> List[Dict]:
        """테스트 데이터 로드"""
        test_data = []
        
        try:
            with open(test_file_path, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    try:
                        data = json.loads(line.strip())
                        
                        korean_text = data["contents"][0]["parts"][0]["text"]
                        expected_sign = data["contents"][1]["parts"][0]["text"]
                        
                        test_data.append({
                            "index": i + 1,
                            "korean": korean_text,
                            "expected": expected_sign
                        })
                        
                    except (json.JSONDecodeError, KeyError) as e:
                        print(f"⚠️  데이터 파싱 오류 (라인 {i+1}): {e}")
                        continue
                        
            print(f"✅ 테스트 데이터 로드 완료: {len(test_data)}개 샘플")
            return test_data
            
        except FileNotFoundError:
            print(f"❌ 테스트 파일을 찾을 수 없습니다: {test_file_path}")
            return []

    def evaluate_model(self, test_data: List[Dict], max_samples: int = None) -> Dict:
        """모델 평가 실행"""
        if max_samples:
            test_data = test_data[:max_samples]
        
        print(f"\n🧪 기본 Gemini 모델 평가 시작 ({len(test_data)}개 샘플)")
        print("=" * 70)
        
        results = []
        total_jaccard = 0.0
        total_word_accuracy = 0.0
        successful_tests = 0
        
        start_time = time.time()
        
        for i, sample in enumerate(test_data, 1):
            korean = sample["korean"]
            expected = sample["expected"]
            
            print(f"[{i}/{len(test_data)}] 번역 중: {korean[:50]}...")
            
            # 번역 실행
            predicted = self.translate_to_sign(korean)
            
            if predicted:
                # 유사도 계산
                jaccard = self.calculate_jaccard_similarity(predicted, expected)
                word_acc_info = self.calculate_word_accuracy(predicted, expected)
                
                total_jaccard += jaccard
                total_word_accuracy += word_acc_info["word_accuracy"]
                successful_tests += 1
                
                # 결과 저장
                result = {
                    "index": sample["index"],
                    "korean": korean,
                    "expected": expected,
                    "predicted": predicted,
                    "similarity": {
                        "jaccard": jaccard,
                        **word_acc_info
                    }
                }
                results.append(result)
                
                # 진행률 출력
                if i % 5 == 0 or successful_tests <= 3:
                    avg_jaccard = total_jaccard / successful_tests
                    print(f"   ✅ 성공! Jaccard: {jaccard:.3f}")
                    print(f"   예상: {expected}")
                    print(f"   예측: {predicted}")
                    print(f"   현재 평균 Jaccard: {avg_jaccard:.3f}")
            else:
                print(f"   ❌ 번역 실패")
        
        # 최종 결과 계산
        avg_jaccard = total_jaccard / successful_tests if successful_tests > 0 else 0.0
        avg_word_accuracy = total_word_accuracy / successful_tests if successful_tests > 0 else 0.0
        
        evaluation_result = {
            "model_name": "gemini-2.5-flash (baseline)",
            "test_time": datetime.now().isoformat(),
            "total_samples": len(test_data),
            "successful_tests": successful_tests,
            "avg_jaccard": avg_jaccard,
            "avg_word_accuracy": avg_word_accuracy,
            "detailed_results": results
        }
        
        print("\n" + "=" * 70)
        print("🎉 평가 완료!")
        print(f"✅ 성공한 테스트: {successful_tests}/{len(test_data)}")
        print(f"📊 평균 Jaccard 유사도: {avg_jaccard:.4f}")
        print(f"📊 평균 단어 정확도: {avg_word_accuracy:.4f}")
        
        return evaluation_result

    def save_results(self, results: Dict, output_file: str):
        """평가 결과 저장"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"💾 결과 저장 완료: {output_file}")
        except Exception as e:
            print(f"❌ 결과 저장 실패: {e}")

def main():
    """메인 함수"""
    print("🚀 기본 Gemini 2.5 Flash 모델 평가 (베이스라인)")
    print("=" * 70)
    
    # 프로젝트 설정
    PROJECT_ID = "geminisignkorean"
    LOCATION = "us-central1"
    
    # 테스트 데이터 파일
    TEST_DATA_FILE = "data/gemini_test_1pct.jsonl"
    
    # 출력 파일명 생성
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    OUTPUT_FILE = f"data/baseline_gemini_evaluation_{timestamp}.json"
    
    try:
        # 평가자 초기화
        evaluator = BaselineGeminiEvaluator(PROJECT_ID, LOCATION)
        
        # 테스트 데이터 로드
        test_data = evaluator.load_test_data(TEST_DATA_FILE)
        
        if not test_data:
            print("❌ 테스트 데이터가 없습니다.")
            return
        
        # 사용자 입력: 테스트할 샘플 수
        print(f"\n📊 총 {len(test_data)}개의 테스트 샘플이 있습니다.")
        sample_input = input("테스트할 샘플 수를 입력하세요 (전체는 Enter): ").strip()
        
        max_samples = None
        if sample_input:
            try:
                max_samples = int(sample_input)
                print(f"📝 {max_samples}개 샘플로 제한하여 평가합니다.")
            except ValueError:
                print("⚠️  잘못된 입력입니다. 전체 샘플로 평가합니다.")
        
        # 평가 실행
        results = evaluator.evaluate_model(test_data, max_samples)
        
        # 결과 저장
        evaluator.save_results(results, OUTPUT_FILE)
        
        print(f"\n🎯 평가 요약:")
        print(f"   모델: 기본 Gemini 2.5 Flash (베이스라인)")
        print(f"   테스트 샘플: {results['successful_tests']}/{results['total_samples']}")
        print(f"   Jaccard 유사도: {results['avg_jaccard']:.4f}")
        print(f"   단어 정확도: {results['avg_word_accuracy']:.4f}")
        print(f"   결과 파일: {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"❌ 평가 중 오류 발생: {e}")

if __name__ == "__main__":
    main() 