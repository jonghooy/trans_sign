-- 21만 문장 CSV 업로드를 위한 translation_tasks 테이블 확장
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 새로운 컬럼들 추가
ALTER TABLE translation_tasks 
ADD COLUMN IF NOT EXISTS sentence_id VARCHAR,
ADD COLUMN IF NOT EXISTS human_translated_text TEXT,
ADD COLUMN IF NOT EXISTS source_type VARCHAR DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS upload_batch_id UUID,
ADD COLUMN IF NOT EXISTS created_by VARCHAR;

-- 2. 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_translation_tasks_sentence_id ON translation_tasks(sentence_id);
CREATE INDEX IF NOT EXISTS idx_translation_tasks_upload_batch ON translation_tasks(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_translation_tasks_source_type ON translation_tasks(source_type);

-- 3. sentence_id 중복 방지를 위한 유니크 제약조건 (옵션)
-- 주의: 기존 데이터가 있으면 실패할 수 있음
-- ALTER TABLE translation_tasks 
-- ADD CONSTRAINT unique_sentence_id UNIQUE (sentence_id);

-- 4. 확인 쿼리
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'translation_tasks' 
ORDER BY ordinal_position; 