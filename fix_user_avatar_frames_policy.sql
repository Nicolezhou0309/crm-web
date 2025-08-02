-- =============================================
-- 为 user_avatar_frames 表添加查询策略
-- 创建时间: 2025年1月
-- =============================================

-- 允许认证用户查询 user_avatar_frames 表
CREATE POLICY "Allow select for authenticated users" 
ON "public"."user_avatar_frames"
TO authenticated
USING (true);

-- 部署完成提示
DO $$
BEGIN
  RAISE NOTICE 'user_avatar_frames 表查询策略已创建！';
  RAISE NOTICE '现在认证用户可以正常查询头像框了';
END $$; 