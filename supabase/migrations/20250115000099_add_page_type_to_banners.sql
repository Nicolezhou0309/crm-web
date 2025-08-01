-- 为banners表添加page_type字段，支持不同页面的banner管理
ALTER TABLE banners ADD COLUMN IF NOT EXISTS page_type VARCHAR(50) DEFAULT 'home' NOT NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_banners_page_type ON banners(page_type);

-- 添加约束确保page_type的值有效
ALTER TABLE banners ADD CONSTRAINT check_page_type 
CHECK (page_type IN ('home', 'live_stream_registration', 'other'));

-- 为现有数据设置默认值
UPDATE banners SET page_type = 'home' WHERE page_type IS NULL; 