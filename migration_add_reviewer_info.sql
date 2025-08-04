-- 검수자 정보 추가를 위한 데이터베이스 확장
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. accepted_data 테이블에 검수자 정보 컬럼 추가
ALTER TABLE accepted_data 
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. rejected_data 테이블에 검수자 정보 컬럼 추가
ALTER TABLE rejected_data 
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_accepted_data_reviewed_by ON accepted_data(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_rejected_data_reviewed_by ON rejected_data(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_accepted_data_reviewed_at ON accepted_data(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_rejected_data_reviewed_at ON rejected_data(reviewed_at);

-- 4. 확인 쿼리
SELECT 
    'accepted_data' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'accepted_data' 
AND column_name IN ('reviewed_by', 'reviewed_at')

UNION ALL

SELECT 
    'rejected_data' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rejected_data' 
AND column_name IN ('reviewed_by', 'reviewed_at')
ORDER BY table_name, column_name; 