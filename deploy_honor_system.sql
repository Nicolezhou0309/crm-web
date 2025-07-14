-- =============================================
-- 部署荣誉系统数据库结构
-- 创建时间: 2024年12月
-- 使用现有的 achievement_progress_logs 表记录发放历史
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
  RAISE NOTICE '荣誉系统数据库结构部署完成！';
  RAISE NOTICE '包含：头像框图片URL字段';
  RAISE NOTICE '发放记录将统一存储在 achievement_progress_logs 表中';
END $$; 