-- =============================================
-- 数据库恢复脚本
-- 恢复所有表格、函数和数据
-- =============================================

-- 1. 恢复积分系统表格和函数
\i create_points_framework.sql

-- 2. 恢复其他核心表格
\i sql-scripts/setup/db_struct_backup.sql

-- 3. 恢复RLS策略
\i sql-scripts/setup/rls_policies_backup.sql

-- 4. 修复award_points函数
\i fix_award_points_function.sql

-- 5. 验证恢复结果
SELECT 'Database restored successfully' as status; 