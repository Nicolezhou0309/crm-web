-- 检查频率控制系统状态
-- 连接到数据库后运行此脚本

-- 1. 检查表是否存在
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '存在'
        ELSE '不存在'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN (
        'operation_frequency_control',
        'frequency_control_config', 
        'operation_logs'
    );

-- 2. 检查频率控制配置
SELECT 
    operation_type,
    max_operations,
    time_window_minutes,
    warning_message,
    is_active
FROM public.frequency_control_config
ORDER BY operation_type;

-- 3. 检查最近的频率控制记录
SELECT 
    user_id,
    operation_type,
    operation_count,
    window_start,
    window_end,
    created_at
FROM public.operation_frequency_control
ORDER BY created_at DESC
LIMIT 10;

-- 4. 检查最近的操作日志
SELECT 
    user_id,
    operation_type,
    record_id,
    operation_result,
    created_at
FROM public.operation_logs
ORDER BY created_at DESC
LIMIT 10;

-- 5. 检查函数是否存在
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN (
        'check_operation_frequency',
        'record_operation',
        'cleanup_expired_frequency_data'
    );

-- 6. 测试频率检查函数（需要提供用户ID和操作类型）
-- SELECT public.check_operation_frequency(1, 'followup');

-- 7. 检查视图是否存在
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name = 'frequency_control_summary'; 