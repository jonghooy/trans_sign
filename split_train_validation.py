#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
10만 문장을 훈련용과 검증용으로 분리
- 훈련용: 80% (약 80,000문장)
- 검증용: 20% (약 20,000문장)
"""

import json
import random
import os

def split_data(input_file: str, train_ratio: float = 0.8):
    """JSONL 파일을 훈련용과 검증용으로 분리"""
    
    print(f"📁 입력 파일: {input_file}")
    
    if not os.path.exists(input_file):
        print(f"❌ 파일을 찾을 수 없습니다: {input_file}")
        return
    
    # 모든 라인 읽기
    print("📖 데이터 로딩 중...")
    lines = []
    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    # JSON 유효성 검사
                    json.loads(line)
                    lines.append(line)
                except json.JSONDecodeError:
                    print(f"⚠️  잘못된 JSON 라인 {line_num}: {line[:50]}...")
    
    total_count = len(lines)
    print(f"✅ 총 {total_count:,}개 문장 로딩 완료")
    
    # 데이터 셔플링 (재현 가능하도록 시드 고정)
    print("🔀 데이터 셔플링...")
    random.seed(42)  # 고정 시드로 재현 가능한 결과
    random.shuffle(lines)
    
    # 분리 비율 계산
    train_count = int(total_count * train_ratio)
    validation_count = total_count - train_count
    
    print(f"📊 분리 계획:")
    print(f"   - 훈련용: {train_count:,}개 ({train_ratio*100:.1f}%)")
    print(f"   - 검증용: {validation_count:,}개 ({(1-train_ratio)*100:.1f}%)")
    
    # 데이터 분리
    train_lines = lines[:train_count]
    validation_lines = lines[train_count:]
    
    # 파일명 생성
    base_name = os.path.splitext(input_file)[0]
    train_file = f"{base_name}_train.jsonl"
    validation_file = f"{base_name}_validation.jsonl"
    
    # 훈련용 파일 저장
    print(f"💾 훈련용 데이터 저장: {train_file}")
    with open(train_file, 'w', encoding='utf-8') as f:
        for line in train_lines:
            f.write(line + '\n')
    
    # 검증용 파일 저장
    print(f"💾 검증용 데이터 저장: {validation_file}")
    with open(validation_file, 'w', encoding='utf-8') as f:
        for line in validation_lines:
            f.write(line + '\n')
    
    print("\n✅ 데이터 분리 완료!")
    print(f"📋 결과:")
    print(f"   🎯 훈련용: {train_file} ({train_count:,}개)")
    print(f"   🔍 검증용: {validation_file} ({validation_count:,}개)")
    
    # 파일 크기 확인
    train_size = os.path.getsize(train_file) / (1024 * 1024)
    validation_size = os.path.getsize(validation_file) / (1024 * 1024)
    
    print(f"📊 파일 크기:")
    print(f"   🎯 훈련용: {train_size:.2f} MB")
    print(f"   🔍 검증용: {validation_size:.2f} MB")
    
    return train_file, validation_file

def verify_split_quality(train_file: str, validation_file: str):
    """분리된 데이터의 품질 검증"""
    print("\n🔍 데이터 품질 검증...")
    
    # 몇 개 샘플 확인
    print(f"\n📝 훈련용 샘플 (첫 3개):")
    with open(train_file, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= 3:
                break
            data = json.loads(line.strip())
            user_content = data['messages'][0]['content']
            assistant_content = data['messages'][1]['content']
            print(f"   {i+1}. 입력: {user_content[:30]}...")
            print(f"      출력: {assistant_content[:30]}...")
    
    print(f"\n📝 검증용 샘플 (첫 3개):")
    with open(validation_file, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= 3:
                break
            data = json.loads(line.strip())
            user_content = data['messages'][0]['content']
            assistant_content = data['messages'][1]['content']
            print(f"   {i+1}. 입력: {user_content[:30]}...")
            print(f"      출력: {assistant_content[:30]}...")

def main():
    print("🔪 파인튜닝 데이터 분리기")
    print("=" * 50)
    print("🎯 목표: 훈련용 90% + 검증용 10% 분리")
    print()
    
    input_file = "sign_to_korean_filtered.jsonl"
    
    if not os.path.exists(input_file):
        print(f"❌ 입력 파일을 찾을 수 없습니다: {input_file}")
        return
    
    # 데이터 분리 (90% 훈련, 10% 검증)
    train_file, validation_file = split_data(input_file, train_ratio=0.9)
    
    # 품질 검증
    verify_split_quality(train_file, validation_file)
    
    print(f"\n🎯 다음 단계:")
    print(f"1. 훈련용: {train_file}")
    print(f"2. 검증용: {validation_file}")
    print(f"3. 파인튜닝 스크립트에서 두 파일 모두 업로드")

if __name__ == "__main__":
    main()
