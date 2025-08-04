#!/usr/bin/env python3
"""
최종 Gemini 모델 평가 (충분한 토큰 할당)
"""

import os
import json
import time
import re
from datetime import datetime
from typing import List, Dict
import vertexai
from vertexai.generative_models import GenerativeModel

class FinalGeminiEvaluator:
    def __init__(self, project_id: str, location: str = "us-central1"):
        self.project_id = project_id
        self.location = location
        
        # Vertex AI 초기화
        vertexai.init(project=project_id, location=location)
        
        # 짧은 시스템 인스트럭션과 충분한 토큰
        try:
            system_instruction = "한국어를 수어로 번역. 형식: 단어+단어"

            self.model = GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_instruction
            )
            print(f"✅ 최종 Gemini 모델 로드 완료")
        except Exception as e:
            print(f"❌ 모델 로드 실패: {e}")
            raise

    def translate_to_sign(self, korean_text: str) -> str:
        """한국어 문장을 수어로 번역"""
        try:
            # 충분한 토큰 할당
            generation_config = {
                "temperature": 0.1,
                "max_output_tokens": 500,  # 대폭 증가
                "top_p": 0.9,
                "top_k": 20
            }
            
            response = self.model.generate_content(
                korean_text,
                generation_config=generation_config
            )
            
            text = response.text.strip()
            
            # "+" 포함된 라인 찾기
            lines = text.split('\n')
            for line in lines:
                line = line.strip()
                if '+' in line and len(line.split('+')) >= 2:
                    # 불필요한 문자 제거
                    cleaned = re.sub(r'[→\-\*•":\(\)]', '', line)
                    cleaned = cleaned.strip()
                    # 앞의 설명 부분 제거
                    if '=' in cleaned:
                        cleaned = cleaned.split('=')[-1].strip()
                    if '→' in cleaned:
                        cleaned = cleaned.split('→')[-1].strip()
                    return cleaned
            
            return lines[0] if lines else text
            
        except Exception as e:
            print(f"❌ 번역 실패: {str(e)[:100]}")
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
        
        print(f"\n🧪 최종 Gemini 모델 평가 시작 ({len(test_data)}개 샘플)")
        print("=" * 70)
        
        results = []
        total_jaccard = 0.0
        total_word_accuracy = 0.0
        successful_tests = 0
        
        for i, sample in enumerate(test_data, 1):
            korean = sample["korean"]
            expected = sample["expected"]
            
            print(f"[{i}/{len(test_data)}] {korean[:30]}...")
            
            predicted = self.translate_to_sign(korean)
            
            if predicted:
                jaccard = self.calculate_jaccard_similarity(predicted, expected)
                word_acc_info = self.calculate_word_accuracy(predicted, expected)
                
                total_jaccard += jaccard
                total_word_accuracy += word_acc_info["word_accuracy"]
                successful_tests += 1
                
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
                
                # 처음 5개와 10의 배수마다 결과 표시
                if successful_tests <= 5 or i % 10 == 0:
                    print(f"   ✅ Jaccard: {jaccard:.3f}")
                    print(f"   예상: {expected}")
                    print(f"   예측: {predicted}")
                    if successful_tests >= 2:
                        avg_jaccard = total_jaccard / successful_tests
                        print(f"   평균: {avg_jaccard:.3f}")
                    print()
            else:
                print(f"   ❌ 실패")
        
        # 최종 결과 계산
        avg_jaccard = total_jaccard / successful_tests if successful_tests > 0 else 0.0
        avg_word_accuracy = total_word_accuracy / successful_tests if successful_tests > 0 else 0.0
        
        evaluation_result = {
            "model_name": "gemini-2.5-flash (final)",
            "test_time": datetime.now().isoformat(),
            "total_samples": len(test_data),
            "successful_tests": successful_tests,
            "avg_jaccard": avg_jaccard,
            "avg_word_accuracy": avg_word_accuracy,
            "detailed_results": results
        }
        
        print("=" * 70)
        print("🎉 평가 완료!")
        print(f"✅ 성공: {successful_tests}/{len(test_data)} ({successful_tests/len(test_data)*100:.1f}%)")
        print(f"📊 Jaccard 유사도: {avg_jaccard:.4f}")
        print(f"📊 단어 정확도: {avg_word_accuracy:.4f}")
        
        return evaluation_result

    def save_results(self, results: Dict, output_file: str):
        """평가 결과 저장"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"💾 결과 저장: {output_file}")
        except Exception as e:
            print(f"❌ 저장 실패: {e}")

def main():
    """메인 함수"""
    print("🚀 최종 Gemini 모델 평가")
    print("토큰 할당: 500개 (충분한 출력 보장)")
    print("=" * 50)
    
    PROJECT_ID = "geminisignkorean"
    LOCATION = "us-central1"
    TEST_DATA_FILE = "data/gemini_test_1pct.jsonl"
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    OUTPUT_FILE = f"data/final_gemini_evaluation_{timestamp}.json"
    
    try:
        evaluator = FinalGeminiEvaluator(PROJECT_ID, LOCATION)
        test_data = evaluator.load_test_data(TEST_DATA_FILE)
        
        if not test_data:
            print("❌ 테스트 데이터가 없습니다.")
            return
        
        print(f"\n📊 총 {len(test_data)}개 샘플")
        sample_input = input("테스트할 샘플 수 (전체는 Enter): ").strip()
        
        max_samples = None
        if sample_input:
            try:
                max_samples = int(sample_input)
                print(f"📝 {max_samples}개 샘플로 제한")
            except ValueError:
                print("⚠️  전체 샘플로 평가")
        
        results = evaluator.evaluate_model(test_data, max_samples)
        evaluator.save_results(results, OUTPUT_FILE)
        
        print(f"\n🎯 최종 결과:")
        print(f"   모델: Gemini 2.5 Flash (기본)")
        print(f"   성공률: {results['successful_tests']}/{results['total_samples']}")
        print(f"   Jaccard: {results['avg_jaccard']:.4f}")
        print(f"   단어 정확도: {results['avg_word_accuracy']:.4f}")
        
        # 기존 OpenAI 결과와 비교
        print(f"\n📈 성능 비교 (기존 OpenAI 파인튜닝):")
        print(f"   OpenAI Jaccard: 0.5670")
        print(f"   OpenAI 단어 정확도: 0.7013")
        print(f"   Gemini vs OpenAI:")
        print(f"     Jaccard 차이: {results['avg_jaccard'] - 0.5670:+.4f}")
        print(f"     단어 정확도 차이: {results['avg_word_accuracy'] - 0.7013:+.4f}")
        
    except Exception as e:
        print(f"❌ 오류: {e}")

if __name__ == "__main__":
    main() 