-- 第一步：清理历史调试数据
-- 执行日期：2025-01-10

-- 删除所有调试相关的日志记录
DELETE FROM simple_allocation_logs
WHERE leadid LIKE 'DEBUG_%'
   OR leadid LIKE 'DEFAULT_USER_%'
   OR leadid LIKE 'ALLOCATE_%'
   OR leadid LIKE 'TEST_%';

-- 查看清理结果
SELECT 
    '清理完成' as status,
    COUNT(*) as remaining_logs
FROM simple_allocation_logs; 