#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
현재 파인튜닝 작업 취소 및 새로운 작업 준비
"""

import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def cancel_current_job():
    """현재 진행중인 파인튜닝 작업 취소"""
    print("🔍 현재 진행중인 파인튜닝 작업 확인...")
    
    try:
        # 최근 작업들 가져오기
        jobs = openai.fine_tuning.jobs.list(limit=10)
        
        print(f"📋 최근 파인튜닝 작업 {len(jobs.data)}개:")
        
        for i, job in enumerate(jobs.data):
            status_emoji = {
                'validating_files': '🔄',
                'queued': '⏳',
                'running': '🏃',
                'succeeded': '✅',
                'failed': '❌',
                'cancelled': '⚠️'
            }.get(job.status, '❓')
            
            print(f"{i+1}. {status_emoji} {job.id} - {job.status}")
            
            # 진행중인 작업이 있으면 취소
            if job.status in ['validating_files', 'queued', 'running']:
                print(f"⚠️  진행중인 작업 발견: {job.id}")
                cancel_choice = input(f"이 작업을 취소하시겠습니까? (y/N): ").strip().lower()
                
                if cancel_choice == 'y':
                    try:
                        openai.fine_tuning.jobs.cancel(job.id)
                        print(f"✅ 작업 취소 완료: {job.id}")
                    except Exception as e:
                        print(f"❌ 취소 실패: {e}")
                        
        print("\n✅ 작업 확인 완료!")
        
    except Exception as e:
        print(f"❌ 작업 확인 오류: {e}")

if __name__ == "__main__":
    cancel_current_job()
