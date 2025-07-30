-- 修复points_exchange_records表缺少description列的问题
-- 执行时间: 2025年1月

-- 检查points_exchange_records表是否存在description列
DO $$
BEGIN
    -- 检查description列是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'points_exchange_records' 
        AND column_name = 'description'
    ) THEN
        -- 添加description列
        ALTER TABLE public.points_exchange_records 
        ADD COLUMN description text;
        
        RAISE NOTICE '已为points_exchange_records表添加description列';
    ELSE
        RAISE NOTICE 'points_exchange_records表已存在description列';
    END IF;
END $$;

-- 验证修复结果
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'points_exchange_records' 
AND column_name = 'description'; 