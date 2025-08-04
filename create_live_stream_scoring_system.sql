-- 直播评分系统数据库设计
-- 基于现有的live_stream_schedules表进行扩展

-- 1. 扩展live_stream_schedules表，添加评分相关字段
ALTER TABLE public.live_stream_schedules 
ADD COLUMN IF NOT EXISTS average_score DECIMAL(3,1) NULL,
ADD COLUMN IF NOT EXISTS scoring_data JSONB NULL,
ADD COLUMN IF NOT EXISTS scoring_status TEXT NULL DEFAULT 'not_scored' CHECK (
  scoring_status IN ('not_scored', 'scoring_in_progress', 'scored', 'approved')
),
ADD COLUMN IF NOT EXISTS scored_by BIGINT NULL,
ADD COLUMN IF NOT EXISTS scored_at TIMESTAMP WITH TIME ZONE NULL;

-- 添加外键约束
ALTER TABLE public.live_stream_schedules 
ADD CONSTRAINT live_stream_schedules_scored_by_fkey 
FOREIGN KEY (scored_by) REFERENCES users_profile (id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_average_score 
ON public.live_stream_schedules USING btree (average_score);

CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_scoring_status 
ON public.live_stream_schedules USING btree (scoring_status);

CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_scored_by 
ON public.live_stream_schedules USING btree (scored_by);

CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_scoring_data 
ON public.live_stream_schedules USING gin (scoring_data);

-- 2. 创建评分维度表
CREATE TABLE public.live_stream_scoring_dimensions (
  id BIGSERIAL NOT NULL,
  dimension_name TEXT NOT NULL,
  dimension_code TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT live_stream_scoring_dimensions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_dimensions_code 
ON public.live_stream_scoring_dimensions USING btree (dimension_code);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_dimensions_active 
ON public.live_stream_scoring_dimensions USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_dimensions_sort 
ON public.live_stream_scoring_dimensions USING btree (sort_order);

-- 3. 创建评分选项表
CREATE TABLE public.live_stream_scoring_options (
  id BIGSERIAL NOT NULL,
  dimension_code TEXT NOT NULL,
  option_code TEXT NOT NULL,
  option_text TEXT NOT NULL,
  score DECIMAL(3,1) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT live_stream_scoring_options_pkey PRIMARY KEY (id),
  CONSTRAINT live_stream_scoring_options_dimension_option_unique 
    UNIQUE (dimension_code, option_code),
  CONSTRAINT live_stream_scoring_options_dimension_fkey 
    FOREIGN KEY (dimension_code) REFERENCES live_stream_scoring_dimensions (dimension_code) 
    ON DELETE CASCADE
) TABLESPACE pg_default;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_options_dimension 
ON public.live_stream_scoring_options USING btree (dimension_code);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_options_active 
ON public.live_stream_scoring_options USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_options_sort 
ON public.live_stream_scoring_options USING btree (sort_order);

-- 4. 创建评分日志表
CREATE TABLE public.live_stream_scoring_log (
  id BIGSERIAL NOT NULL,
  schedule_id BIGINT NOT NULL,
  evaluator_id BIGINT NOT NULL,
  scoring_data JSONB NOT NULL,
  average_score DECIMAL(3,1) NOT NULL,
  evaluation_notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT live_stream_scoring_log_pkey PRIMARY KEY (id),
  CONSTRAINT live_stream_scoring_log_schedule_fkey 
    FOREIGN KEY (schedule_id) REFERENCES live_stream_schedules (id) 
    ON DELETE CASCADE,
  CONSTRAINT live_stream_scoring_log_evaluator_fkey 
    FOREIGN KEY (evaluator_id) REFERENCES users_profile (id) 
    ON DELETE CASCADE
) TABLESPACE pg_default;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_log_schedule 
ON public.live_stream_scoring_log USING btree (schedule_id);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_log_evaluator 
ON public.live_stream_scoring_log USING btree (evaluator_id);

CREATE INDEX IF NOT EXISTS idx_live_stream_scoring_log_created 
ON public.live_stream_scoring_log USING btree (created_at);

-- 5. 插入默认评分维度数据（带权重）
INSERT INTO public.live_stream_scoring_dimensions 
(dimension_name, dimension_code, description, weight, sort_order) VALUES
('开播准备', 'preparation', '直播开始前的准备工作评分', 1.20, 1),
('直播状态', 'live_status', '直播过程中的状态表现评分', 1.50, 2),
('讲解话术', 'presentation', '直播讲解的话术质量评分', 2.00, 3),
('出勤情况', 'attendance', '直播出勤和时长评分', 1.80, 4),
('运镜技巧', 'camera_skills', '直播镜头运用技巧评分', 1.00, 5)
ON CONFLICT (dimension_code) DO UPDATE SET 
  weight = EXCLUDED.weight,
  updated_at = now();

-- 6. 插入默认评分选项数据
INSERT INTO public.live_stream_scoring_options 
(dimension_code, option_code, option_text, score, sort_order) VALUES
-- 开播准备选项
('preparation', 'no_delay', '开播即出镜开始讲解', 10.0, 1),
('preparation', 'adjust_within_1min', '开播后适当调整，1分钟内开始讲解', 5.5, 2),
('preparation', 'chat_over_1min', '开播后闲聊，1分钟内未开始讲解', 3.0, 3),

-- 直播状态选项
('live_status', 'energetic', '进入直播间口播欢迎，状态饱满', 10.0, 1),
('live_status', 'normal', '状态平淡无明显优点', 5.5, 2),
('live_status', 'lazy', '态度懒散，说话无精打采', 0.0, 3),

-- 讲解话术选项
('presentation', 'attractive', '话术流畅严谨有吸引力，讲解认真全面', 10.0, 1),
('presentation', 'complete_but_rough', '每10分钟介绍一遍房间，介绍完整但不够严谨', 5.5, 2),
('presentation', 'cold_field', '只读评论不介绍房间，冷场或聊天超过5分钟', 3.0, 3),

-- 出勤情况选项
('attendance', 'on_time_full', '准时开播并播满120分钟，中途未离开', 9.0, 1),
('attendance', 'delay_under_10min', '因上场拖延迟到，未满120分钟或中途缺席10分钟以内', 5.5, 2),
('attendance', 'late_over_10min', '无故迟到或直播时长未满120分钟或中途缺席超过10分钟', 0.0, 3),

-- 运镜技巧选项
('camera_skills', 'beautiful', '构图美观横平竖直，人物居中运镜丝滑', 10.0, 1),
('camera_skills', 'slightly_tilted', '构图略微倾斜，运镜轻微摇晃', 5.5, 2),
('camera_skills', 'poor_angle', '人物长时间不在镜头，画面角度刁钻，运镜摇晃严重', 3.0, 3)
ON CONFLICT (dimension_code, option_code) DO NOTHING;

-- 7. 创建评分计算函数（支持权重）
CREATE OR REPLACE FUNCTION calculate_weighted_score(scoring_data JSONB)
RETURNS DECIMAL(3,1) AS $$
DECLARE
  total_weighted_score DECIMAL(10,2) := 0;
  total_weight DECIMAL(10,2) := 0;
  dimension_score DECIMAL(3,1);
  dimension_weight DECIMAL(3,2);
  dimension_code TEXT;
  dimension_data JSONB;
BEGIN
  -- 遍历所有维度的评分
  FOR dimension_data IN SELECT key, value FROM jsonb_each(scoring_data->'dimensions')
  LOOP
    dimension_code := dimension_data.key;
    dimension_score := (dimension_data.value->>'score')::DECIMAL(3,1);
    
    IF dimension_score IS NOT NULL THEN
      -- 从维度表中获取权重
      SELECT weight INTO dimension_weight 
      FROM live_stream_scoring_dimensions 
      WHERE dimension_code = dimension_code AND is_active = true;
      
      -- 如果找不到权重，使用默认权重1.0
      IF dimension_weight IS NULL THEN
        dimension_weight := 1.0;
      END IF;
      
      total_weighted_score := total_weighted_score + (dimension_score * dimension_weight);
      total_weight := total_weight + dimension_weight;
    END IF;
  END LOOP;
  
  -- 计算加权平均分
  IF total_weight > 0 THEN
    RETURN ROUND(total_weighted_score / total_weight, 1);
  ELSE
    RETURN 0.0;
  END IF;
END;
$$ LANGUAGE plpgsql;



-- 8. 创建触发器，自动更新加权评分
CREATE OR REPLACE FUNCTION update_weighted_score()
RETURNS TRIGGER AS $$
BEGIN
  -- 当scoring_data更新时，直接计算评分
  IF NEW.scoring_data IS NOT NULL THEN
    NEW.average_score := calculate_weighted_score(NEW.scoring_data);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



CREATE TRIGGER trigger_update_weighted_score
  BEFORE UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_weighted_score();



-- 9. 创建评分状态更新函数
CREATE OR REPLACE FUNCTION update_scoring_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 当有评分数据时，更新评分状态
  IF NEW.scoring_data IS NOT NULL AND NEW.scored_by IS NOT NULL THEN
    NEW.scoring_status := 'scored';
    NEW.scored_at := now();
  ELSIF NEW.scoring_data IS NULL THEN
    NEW.scoring_status := 'not_scored';
    NEW.scored_by := NULL;
    NEW.scored_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scoring_status
  BEFORE INSERT OR UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_status();

-- 10. 创建视图，方便查询评分数据
-- 简化第一个视图，只保留最常用的字段
CREATE OR REPLACE VIEW live_stream_schedules_with_scoring AS
SELECT 
  lss.id,
  lss.date,
  lss.time_slot_id,
  lss.created_by,
  lss.average_score,
  lss.scoring_status,
  lss.scored_by,
  lss.scored_at,
  up.nickname as evaluator_name
FROM live_stream_schedules lss
LEFT JOIN users_profile up ON lss.scored_by = up.id
ORDER BY lss.date DESC, lss.time_slot_id;

-- 11. 创建评分统计视图（保留，这个很有用）
CREATE OR REPLACE VIEW scoring_statistics AS
SELECT 
  DATE_TRUNC('day', lss.date) as score_date,
  COUNT(*) as total_schedules,
  COUNT(CASE WHEN lss.scoring_status = 'scored' THEN 1 END) as scored_count,
  COUNT(CASE WHEN lss.scoring_status = 'approved' THEN 1 END) as approved_count,
  AVG(lss.average_score) as avg_score,
  MIN(lss.average_score) as min_score,
  MAX(lss.average_score) as max_score
FROM live_stream_schedules lss
WHERE lss.average_score IS NOT NULL
GROUP BY DATE_TRUNC('day', lss.date)
ORDER BY score_date DESC;

-- 12. 新增：评分日志详细视图（更有用）
CREATE OR REPLACE VIEW scoring_log_detail AS
SELECT 
  lssl.id as log_id,
  lssl.schedule_id,
  lss.date,
  lss.time_slot_id,
  lss.created_by,
  lssl.evaluator_id,
  up_evaluator.nickname as evaluator_name,
  lssl.average_score,
  lssl.evaluation_notes,
  lssl.scoring_data,
  lssl.created_at as scoring_created_at
FROM live_stream_scoring_log lssl
JOIN live_stream_schedules lss ON lssl.schedule_id = lss.id
JOIN users_profile up_evaluator ON lssl.evaluator_id = up_evaluator.id
ORDER BY lssl.created_at DESC;

-- 13. 新增：评分维度统计视图（用于分析各维度表现）
CREATE OR REPLACE VIEW dimension_performance_stats AS
SELECT 
  lsd.dimension_name,
  lsd.dimension_code,
  lsd.weight,
  COUNT(DISTINCT lss.id) as total_evaluations,
  AVG((lss.scoring_data->'dimensions'->lsd.dimension_code->>'score')::DECIMAL(3,1)) as avg_dimension_score,
  MIN((lss.scoring_data->'dimensions'->lsd.dimension_code->>'score')::DECIMAL(3,1)) as min_dimension_score,
  MAX((lss.scoring_data->'dimensions'->lsd.dimension_code->>'score')::DECIMAL(3,1)) as max_dimension_score
FROM live_stream_scoring_dimensions lsd
LEFT JOIN live_stream_schedules lss ON lss.scoring_data IS NOT NULL 
  AND lss.scoring_data->'dimensions' ? lsd.dimension_code
WHERE lsd.is_active = true
GROUP BY lsd.id, lsd.dimension_name, lsd.dimension_code, lsd.weight
ORDER BY lsd.sort_order;

-- 12. 添加注释
COMMENT ON TABLE live_stream_schedules IS '直播日程表，包含评分相关字段';
COMMENT ON COLUMN live_stream_schedules.average_score IS '平均评分';
COMMENT ON COLUMN live_stream_schedules.scoring_data IS '评分过程数据（JSONB格式）';
COMMENT ON COLUMN live_stream_schedules.scoring_status IS '评分状态：not_scored/scoring_in_progress/scored/approved';
COMMENT ON COLUMN live_stream_schedules.scored_by IS '评分人ID';
COMMENT ON COLUMN live_stream_schedules.scored_at IS '评分时间';

COMMENT ON TABLE live_stream_scoring_dimensions IS '评分维度表';
COMMENT ON TABLE live_stream_scoring_options IS '评分选项表';
COMMENT ON TABLE live_stream_scoring_log IS '评分日志表';

COMMENT ON FUNCTION calculate_weighted_score IS '计算加权评分函数（支持维度权重）';
COMMENT ON FUNCTION update_weighted_score IS '自动更新加权评分触发器函数';
COMMENT ON FUNCTION update_scoring_status IS '自动更新评分状态触发器函数';

-- 14. 创建权重管理函数
CREATE OR REPLACE FUNCTION update_dimension_weight(
  p_dimension_code TEXT,
  p_new_weight DECIMAL(3,2)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 更新维度权重
  UPDATE live_stream_scoring_dimensions 
  SET weight = p_new_weight, updated_at = now()
  WHERE dimension_code = p_dimension_code AND is_active = true;
  
  -- 返回是否成功更新
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 创建重新计算所有评分的函数
CREATE OR REPLACE FUNCTION recalculate_all_scores()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
  schedule_record RECORD;
BEGIN
  -- 遍历所有有评分数据的记录
  FOR schedule_record IN 
    SELECT id, scoring_data 
    FROM live_stream_schedules 
    WHERE scoring_data IS NOT NULL
  LOOP
    -- 重新计算评分
    UPDATE live_stream_schedules 
    SET average_score = calculate_weighted_score(scoring_data)
    WHERE id = schedule_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_dimension_weight IS '更新维度权重函数';
COMMENT ON FUNCTION recalculate_all_scores IS '重新计算所有评分函数（权重变更后使用）';

-- 临时调试函数：禁用触发器
CREATE OR REPLACE FUNCTION disable_scoring_triggers()
RETURNS VOID AS $$
BEGIN
  -- 禁用评分相关触发器
  ALTER TABLE live_stream_schedules DISABLE TRIGGER trigger_update_weighted_score;
  ALTER TABLE live_stream_schedules DISABLE TRIGGER trigger_update_scoring_status;
END;
$$ LANGUAGE plpgsql;

-- 临时调试函数：启用触发器
CREATE OR REPLACE FUNCTION enable_scoring_triggers()
RETURNS VOID AS $$
BEGIN
  -- 启用评分相关触发器
  ALTER TABLE live_stream_schedules ENABLE TRIGGER trigger_update_weighted_score;
  ALTER TABLE live_stream_schedules ENABLE TRIGGER trigger_update_scoring_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION disable_scoring_triggers IS '临时禁用评分触发器（调试用）';
COMMENT ON FUNCTION enable_scoring_triggers IS '临时启用评分触发器（调试用）';

-- 创建安全的评分更新函数
CREATE OR REPLACE FUNCTION update_live_stream_scoring(
  p_schedule_id BIGINT,
  p_scoring_data JSONB,
  p_scored_by BIGINT,
  p_average_score DECIMAL(3,1)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 使用PostgreSQL的JSON函数来验证和格式化数据
  UPDATE live_stream_schedules 
  SET 
    scoring_data = p_scoring_data,
    scored_by = p_scored_by,
    scored_at = now(),
    average_score = p_average_score,
    scoring_status = 'scored'
  WHERE id = p_schedule_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_live_stream_scoring IS '安全的评分更新函数（避免JSON解析错误）'; 