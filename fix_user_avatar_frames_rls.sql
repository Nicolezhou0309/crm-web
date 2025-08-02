-- =============================================
-- 修复 user_avatar_frames 表的 RLS 策略
-- 创建时间: 2025年1月
-- =============================================

BEGIN;

-- 删除现有的策略（如果存在）
DROP POLICY IF EXISTS "用户可查看自己的头像框" ON user_avatar_frames;
DROP POLICY IF EXISTS "管理员可管理所有头像框" ON user_avatar_frames;

-- 创建查询策略：用户可查看自己的头像框
CREATE POLICY "用户可查看自己的头像框" ON user_avatar_frames
FOR SELECT USING (auth.uid()::bigint = user_id);

-- 创建插入策略：用户可为自己添加头像框
CREATE POLICY "用户可为自己添加头像框" ON user_avatar_frames
FOR INSERT WITH CHECK (auth.uid()::bigint = user_id);

-- 创建更新策略：用户可更新自己的头像框
CREATE POLICY "用户可更新自己的头像框" ON user_avatar_frames
FOR UPDATE USING (auth.uid()::bigint = user_id);

-- 创建删除策略：用户可删除自己的头像框
CREATE POLICY "用户可删除自己的头像框" ON user_avatar_frames
FOR DELETE USING (auth.uid()::bigint = user_id);

-- 管理员策略：有用户管理权限的用户可管理所有头像框
CREATE POLICY "管理员可管理所有头像框" ON user_avatar_frames
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()::bigint
    AND p.resource = 'user_manage'
    AND p.action = 'read'
  )
);

COMMIT;

-- 部署完成提示
DO $$
BEGIN
  RAISE NOTICE 'user_avatar_frames 表 RLS 策略已修复！';
  RAISE NOTICE '现在用户可以正常查询自己的头像框了';
END $$; 