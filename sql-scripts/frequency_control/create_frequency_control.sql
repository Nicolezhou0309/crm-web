-- 频率控制系统数据库表结构
-- 文件名: create_frequency_control_tables.sql

-- =====================================
-- 1. 操作频率控制表
-- =====================================

CREATE TABLE IF NOT EXISTS public.operation_frequency_control (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    operation_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_operation_frequency_user_type 
ON public.operation_frequency_control (user_id, operation_type);

CREATE INDEX IF NOT EXISTS idx_operation_frequency_window 
ON public.operation_frequency_control (window_start, window_end);

CREATE INDEX IF NOT EXISTS idx_operation_frequency_created 
ON public.operation_frequency_control (created_at);

-- 添加注释
COMMENT ON TABLE public.operation_frequency_control IS '操作频率控制表';
COMMENT ON COLUMN public.operation_frequency_control.user_id IS '用户ID';
COMMENT ON COLUMN public.operation_frequency_control.operation_type IS '操作类型：dropout(丢单)、followup(跟进)、stage_change(阶段变更)';
COMMENT ON COLUMN public.operation_frequency_control.operation_count IS '操作次数';
COMMENT ON COLUMN public.operation_frequency_control.window_start IS '时间窗口开始时间';
COMMENT ON COLUMN public.operation_frequency_control.window_end IS '时间窗口结束时间';

-- =====================================
-- 2. 频率控制配置表
-- =====================================

CREATE TABLE IF NOT EXISTS public.frequency_control_config (
    id BIGSERIAL PRIMARY KEY,
    operation_type VARCHAR(50) UNIQUE NOT NULL,
    max_operations INTEGER NOT NULL,
    time_window_minutes INTEGER NOT NULL,
    warning_message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO public.frequency_control_config (operation_type, max_operations, time_window_minutes, warning_message) VALUES
('dropout', 3, 10, '丢单操作过于频繁，请确保每个客户都得到充分跟进'),
('followup', 5, 5, '跟进备注填写过于频繁，请确保内容质量'),
('stage_change', 8, 5, '阶段变更过于频繁，请确保操作准确性')
ON CONFLICT (operation_type) DO UPDATE SET
    max_operations = EXCLUDED.max_operations,
    time_window_minutes = EXCLUDED.time_window_minutes,
    warning_message = EXCLUDED.warning_message,
    updated_at = NOW();

-- 添加注释
COMMENT ON TABLE public.frequency_control_config IS '频率控制配置表';
COMMENT ON COLUMN public.frequency_control_config.operation_type IS '操作类型';
COMMENT ON COLUMN public.frequency_control_config.max_operations IS '最大操作次数';
COMMENT ON COLUMN public.frequency_control_config.time_window_minutes IS '时间窗口（分钟）';
COMMENT ON COLUMN public.frequency_control_config.warning_message IS '警告消息';

-- =====================================
-- 3. 操作日志表（可选，用于审计）
-- =====================================

CREATE TABLE IF NOT EXISTS public.operation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    record_id VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    operation_result VARCHAR(20) NOT NULL, -- 'success', 'blocked', 'error'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_type 
ON public.operation_logs (user_id, operation_type);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created 
ON public.operation_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_operation_logs_result 
ON public.operation_logs (operation_result);

-- 添加注释
COMMENT ON TABLE public.operation_logs IS '操作日志表';
COMMENT ON COLUMN public.operation_logs.user_id IS '用户ID';
COMMENT ON COLUMN public.operation_logs.operation_type IS '操作类型';
COMMENT ON COLUMN public.operation_logs.record_id IS '记录ID';
COMMENT ON COLUMN public.operation_logs.old_value IS '旧值';
COMMENT ON COLUMN public.operation_logs.new_value IS '新值';
COMMENT ON COLUMN public.operation_logs.operation_result IS '操作结果';
COMMENT ON COLUMN public.operation_logs.ip_address IS 'IP地址';
COMMENT ON COLUMN public.operation_logs.user_agent IS '用户代理';

-- =====================================
-- 4. 频率检查函数
-- =====================================

CREATE OR REPLACE FUNCTION public.check_operation_frequency(
    p_user_id BIGINT,
    p_operation_type VARCHAR(50)
) RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_current_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_window_end TIMESTAMP WITH TIME ZONE;
    v_result JSONB;
BEGIN
    -- 获取配置
    SELECT * INTO v_config 
    FROM public.frequency_control_config 
    WHERE operation_type = p_operation_type AND is_active = true;
    
    IF NOT FOUND THEN
        -- 没有配置，允许操作
        RETURN jsonb_build_object('allowed', true);
    END IF;
    
    -- 计算时间窗口
    v_window_start := NOW() - INTERVAL '1 minute' * v_config.time_window_minutes;
    v_window_end := NOW();
    
    -- 检查当前窗口内的操作次数
    SELECT COALESCE(SUM(operation_count), 0) INTO v_current_count
    FROM public.operation_frequency_control
    WHERE user_id = p_user_id 
      AND operation_type = p_operation_type
      AND window_start >= v_window_start
      AND window_end <= v_window_end;
    
    -- 判断是否允许操作
    IF v_current_count >= v_config.max_operations THEN
        v_result := jsonb_build_object(
            'allowed', false,
            'message', v_config.warning_message,
            'current_count', v_current_count,
            'max_operations', v_config.max_operations,
            'time_window_minutes', v_config.time_window_minutes
        );
    ELSE
        v_result := jsonb_build_object(
            'allowed', true,
            'current_count', v_current_count,
            'max_operations', v_config.max_operations,
            'time_window_minutes', v_config.time_window_minutes
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. 记录操作函数
-- =====================================

CREATE OR REPLACE FUNCTION public.record_operation(
    p_user_id BIGINT,
    p_operation_type VARCHAR(50),
    p_record_id VARCHAR(50) DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_window_end TIMESTAMP WITH TIME ZONE;
    v_existing_record RECORD;
    v_result JSONB;
BEGIN
    -- 获取配置
    SELECT * INTO v_config 
    FROM public.frequency_control_config 
    WHERE operation_type = p_operation_type AND is_active = true;
    
    IF NOT FOUND THEN
        -- 没有配置，只记录日志
        INSERT INTO public.operation_logs (
            user_id, operation_type, record_id, old_value, new_value, 
            operation_result, ip_address, user_agent
        ) VALUES (
            p_user_id, p_operation_type, p_record_id, p_old_value, p_new_value,
            'success', p_ip_address, p_user_agent
        );
        
        RETURN jsonb_build_object('success', true, 'message', '操作已记录');
    END IF;
    
    -- 计算时间窗口
    v_window_start := NOW() - INTERVAL '1 minute' * v_config.time_window_minutes;
    v_window_end := NOW();
    
    -- 查找现有记录
    SELECT * INTO v_existing_record
    FROM public.operation_frequency_control
    WHERE user_id = p_user_id 
      AND operation_type = p_operation_type
      AND window_start >= v_window_start
      AND window_end <= v_window_end
    LIMIT 1;
    
    IF FOUND THEN
        -- 更新现有记录
        UPDATE public.operation_frequency_control
        SET operation_count = operation_count + 1,
            updated_at = NOW()
        WHERE id = v_existing_record.id;
    ELSE
        -- 创建新记录
        INSERT INTO public.operation_frequency_control (
            user_id, operation_type, operation_count, window_start, window_end
        ) VALUES (
            p_user_id, p_operation_type, 1, v_window_start, v_window_end
        );
    END IF;
    
    -- 记录操作日志
    INSERT INTO public.operation_logs (
        user_id, operation_type, record_id, old_value, new_value, 
        operation_result, ip_address, user_agent
    ) VALUES (
        p_user_id, p_operation_type, p_record_id, p_old_value, p_new_value,
        'success', p_ip_address, p_user_agent
    );
    
    RETURN jsonb_build_object('success', true, 'message', '操作已记录');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. 清理过期数据函数
-- =====================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_frequency_data()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
    v_max_window_minutes INTEGER;
BEGIN
    -- 获取最大时间窗口
    SELECT COALESCE(MAX(time_window_minutes), 60) INTO v_max_window_minutes
    FROM public.frequency_control_config
    WHERE is_active = true;
    
    -- 删除过期的频率控制记录
    DELETE FROM public.operation_frequency_control
    WHERE window_end < NOW() - INTERVAL '1 minute' * v_max_window_minutes;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- 删除30天前的操作日志（可选）
    DELETE FROM public.operation_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 7. 创建定时清理任务（可选）
-- =====================================

-- 如果需要自动清理，可以设置定时任务
-- 注意：这需要pg_cron扩展，如果没有安装可以手动执行

-- 创建定时任务（每小时执行一次）
-- SELECT cron.schedule('cleanup-frequency-data', '0 * * * *', 'SELECT public.cleanup_expired_frequency_data();');

-- =====================================
-- 8. 权限设置
-- =====================================

-- 为应用用户授予权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_frequency_control TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequency_control_config TO authenticated;
GRANT SELECT, INSERT ON public.operation_logs TO authenticated;

-- 为函数授予执行权限
GRANT EXECUTE ON FUNCTION public.check_operation_frequency(BIGINT, VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_operation(BIGINT, VARCHAR(50), VARCHAR(50), TEXT, TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_frequency_data() TO authenticated;

-- =====================================
-- 9. 创建视图用于监控
-- =====================================

CREATE OR REPLACE VIEW public.frequency_control_summary AS
SELECT 
    fc.operation_type,
    fc.max_operations,
    fc.time_window_minutes,
    fc.warning_message,
    COUNT(ofc.id) as active_records,
    SUM(ofc.operation_count) as total_operations,
    fc.is_active
FROM public.frequency_control_config fc
LEFT JOIN public.operation_frequency_control ofc ON fc.operation_type = ofc.operation_type
    AND ofc.window_end > NOW() - INTERVAL '1 minute' * fc.time_window_minutes
GROUP BY fc.operation_type, fc.max_operations, fc.time_window_minutes, fc.warning_message, fc.is_active
ORDER BY fc.operation_type;

-- 添加注释
COMMENT ON VIEW public.frequency_control_summary IS '频率控制汇总视图';

-- =====================================
-- 10. 测试数据（可选）
-- =====================================
-- 自动清理频率控制和日志表，按容量阈值
CREATE OR REPLACE FUNCTION public.auto_cleanup_frequency_tables(
    p_freq_table_max_rows INTEGER DEFAULT 100000,   -- 频率表最大行数
    p_freq_table_batch_delete INTEGER DEFAULT 10000, -- 每次批量删除行数
    p_log_table_max_rows INTEGER DEFAULT 500000,    -- 日志表最大行数
    p_log_table_batch_delete INTEGER DEFAULT 50000   -- 每次批量删除行数
) RETURNS JSONB AS $$
DECLARE
    v_freq_count INTEGER;
    v_log_count INTEGER;
    v_freq_deleted INTEGER := 0;
    v_log_deleted INTEGER := 0;
BEGIN
    -- 1. 清理 operation_frequency_control
    SELECT COUNT(*) INTO v_freq_count FROM public.operation_frequency_control;
    IF v_freq_count > p_freq_table_max_rows THEN
        WITH del AS (
            DELETE FROM public.operation_frequency_control
            WHERE id IN (
                SELECT id FROM public.operation_frequency_control
                ORDER BY window_end ASC, id ASC
                LIMIT p_freq_table_batch_delete
            )
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_freq_deleted FROM del;
    END IF;

    -- 2. 清理 operation_logs
    SELECT COUNT(*) INTO v_log_count FROM public.operation_logs;
    IF v_log_count > p_log_table_max_rows THEN
        WITH del AS (
            DELETE FROM public.operation_logs
            WHERE id IN (
                SELECT id FROM public.operation_logs
                ORDER BY created_at ASC, id ASC
                LIMIT p_log_table_batch_delete
            )
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_log_deleted FROM del;
    END IF;

    RETURN jsonb_build_object(
        'freq_table_total', v_freq_count,
        'freq_table_deleted', v_freq_deleted,
        'log_table_total', v_log_count,
        'log_table_deleted', v_log_deleted
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 用法示例（手动执行）：
-- SELECT * FROM public.auto_cleanup_frequency_tables();

-- 建议配合pg_cron定时任务，每小时或每天自动执行：
-- SELECT cron.schedule('auto-cleanup-frequency', '0 * * * *', 'SELECT public.auto_cleanup_frequency_tables();');
-- =====================================
-- 完成
-- =====================================

-- 验证表创建
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('operation_frequency_control', 'frequency_control_config', 'operation_logs')
ORDER BY table_name, ordinal_position;