-- 创建直播报名配置表
CREATE TABLE IF NOT EXISTS public.livestream_registration_config (
    id SERIAL PRIMARY KEY,
    registration_open_time TIME NOT NULL DEFAULT '09:00:00'::time without time zone,
    registration_close_time TIME NOT NULL DEFAULT '18:00:00'::time without time zone,
    registration_open_day_of_week INTEGER NULL DEFAULT 1,
    registration_close_day_of_week INTEGER NULL DEFAULT 5,
    privilege_advance_open_time TIME NOT NULL DEFAULT '08:00:00'::time without time zone,
    privilege_advance_close_time TIME NOT NULL DEFAULT '20:00:00'::time without time zone,
    privilege_advance_open_day_of_week INTEGER NULL DEFAULT 1,
    privilege_advance_close_day_of_week INTEGER NULL DEFAULT 7,
    weekly_limit_per_user INTEGER NULL DEFAULT 3,
    privilege_advance_limit INTEGER NULL DEFAULT 2,
    privilege_managers JSONB NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NULL DEFAULT true,
    is_emergency_closed BOOLEAN NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now()
) TABLESPACE pg_default;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_livestream_registration_config_active 
ON public.livestream_registration_config (is_active, is_emergency_closed);

-- 插入默认配置
INSERT INTO public.livestream_registration_config (
    registration_open_time,
    registration_close_time,
    registration_open_day_of_week,
    registration_close_day_of_week,
    privilege_advance_open_time,
    privilege_advance_close_time,
    privilege_advance_open_day_of_week,
    privilege_advance_close_day_of_week,
    weekly_limit_per_user,
    privilege_advance_limit,
    privilege_managers,
    is_active,
    is_emergency_closed
) VALUES (
    '09:00:00',
    '18:00:00',
    1,
    5,
    '08:00:00',
    '20:00:00',
    1,
    7,
    3,
    2,
    '[]'::jsonb,
    true,
    false
) ON CONFLICT DO NOTHING;

-- 添加注释
COMMENT ON TABLE public.livestream_registration_config IS '直播报名配置表';
COMMENT ON COLUMN public.livestream_registration_config.registration_open_time IS '基础报名开放时间';
COMMENT ON COLUMN public.livestream_registration_config.registration_close_time IS '基础报名关闭时间';
COMMENT ON COLUMN public.livestream_registration_config.registration_open_day_of_week IS '基础报名开放星期(1=周一,7=周日)';
COMMENT ON COLUMN public.livestream_registration_config.registration_close_day_of_week IS '基础报名关闭星期(1=周一,7=周日)';
COMMENT ON COLUMN public.livestream_registration_config.privilege_advance_open_time IS '特权用户提前报名开放时间';
COMMENT ON COLUMN public.livestream_registration_config.privilege_advance_close_time IS '特权用户提前报名关闭时间';
COMMENT ON COLUMN public.livestream_registration_config.privilege_advance_open_day_of_week IS '特权用户提前报名开放星期(1=周一,7=周日)';
COMMENT ON COLUMN public.livestream_registration_config.privilege_advance_close_day_of_week IS '特权用户提前报名关闭星期(1=周一,7=周日)';
COMMENT ON COLUMN public.livestream_registration_config.weekly_limit_per_user IS '基础用户每周报名限制';
COMMENT ON COLUMN public.livestream_registration_config.privilege_advance_limit IS '特权用户提前报名限制';
COMMENT ON COLUMN public.livestream_registration_config.privilege_managers IS '特权用户ID列表(JSONB数组)';
COMMENT ON COLUMN public.livestream_registration_config.is_active IS '是否启用配置';
COMMENT ON COLUMN public.livestream_registration_config.is_emergency_closed IS '是否紧急关闭报名';
