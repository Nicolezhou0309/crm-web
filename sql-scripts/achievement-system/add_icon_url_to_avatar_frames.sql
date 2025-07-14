-- =============================================
-- 为 avatar_frames 表添加 icon_url 字段
-- 创建时间: 2024年12月
-- =============================================

BEGIN;

-- 为 avatar_frames 表添加 icon_url 字段
ALTER TABLE avatar_frames 
ADD COLUMN IF NOT EXISTS icon_url text;

-- 添加注释
COMMENT ON COLUMN avatar_frames.icon_url IS '头像框图片URL，支持PNG、JPG等格式';

-- 创建索引（可选，如果经常按icon_url查询）
CREATE INDEX IF NOT EXISTS idx_avatar_frames_icon_url ON avatar_frames(icon_url) WHERE icon_url IS NOT NULL;

COMMIT;

-- 部署完成提示
DO $$
BEGIN
  RAISE NOTICE 'avatar_frames 表已添加 icon_url 字段！';
  RAISE NOTICE '现在可以存储头像框图片的URL了';
END $$; 