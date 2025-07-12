-- =====================================
-- 积分分配作为分配模式集成脚本
-- 目标：将积分分配集成到现有的分配模式中，不修改原有逻辑
-- 执行顺序：3 (在简化分配系统之后)
-- =====================================

-- =====================================
-- 1. 扩展分配方法枚举
-- =====================================

-- 扩展 allocation_method 枚举类型
DO $$
BEGIN
    -- 检查是否已经存在 'points' 枚举值
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'allocation_method'::regtype 
        AND enumlabel = 'points'
    ) THEN
        -- 添加 'points' 到枚举类型
        ALTER TYPE allocation_method ADD VALUE 'points';
        RAISE NOTICE '已添加 points 分配方法到 allocation_method 枚举';
    ELSE
        RAISE NOTICE 'points 分配方法已存在于 allocation_method 枚举中';
    END IF;
END $$;

-- =====================================
-- 2. 积分成本配置表（简化版）
-- =====================================

-- 创建积分成本配置表
CREATE TABLE IF NOT EXISTS public.lead_points_cost (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    
    -- 成本配置
    base_points_cost integer NOT NULL DEFAULT 30,
    dynamic_cost_config jsonb DEFAULT '{}',
    
    -- 触发条件
    conditions jsonb DEFAULT '{}',
    
    -- 优先级和排序
    priority integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- 约束
    CONSTRAINT lead_points_cost_positive CHECK (base_points_cost > 0)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lead_points_cost_active 
ON lead_points_cost(is_active, priority) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_lead_points_cost_conditions 
ON lead_points_cost USING gin (conditions);

-- =====================================
-- 3. 扩展现有分配日志表（添加积分相关字段）
-- =====================================

-- 为 simple_allocation_logs 表添加积分相关字段
ALTER TABLE public.simple_allocation_logs 
ADD COLUMN IF NOT EXISTS points_cost integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS user_balance_before integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS user_balance_after integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS points_transaction_id bigint DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cost_rule_id uuid REFERENCES lead_points_cost(id);

-- 创建积分相关索引
CREATE INDEX IF NOT EXISTS idx_simple_allocation_logs_points_cost 
ON simple_allocation_logs(points_cost) WHERE points_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_simple_allocation_logs_points_transaction 
ON simple_allocation_logs(points_transaction_id) WHERE points_transaction_id IS NOT NULL;

-- =====================================
-- 4. 核心函数：积分成本计算
-- =====================================

-- 计算线索积分成本
CREATE OR REPLACE FUNCTION public.calculate_lead_points_cost(
    p_source source,
    p_leadtype text,
    p_campaignname text DEFAULT NULL,
    p_unitname text DEFAULT NULL,
    p_remark text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    cost_record RECORD;
    final_cost integer;
    cost_details jsonb := '{}';
    dynamic_adjustments jsonb := '{}';
    total_adjustment integer := 0;
BEGIN
    -- 查找匹配的成本规则（按优先级排序）
    SELECT * INTO cost_record
    FROM lead_points_cost
    WHERE is_active = true
      AND check_cost_conditions(conditions, p_source, p_leadtype, p_campaignname, p_unitname, p_remark)
    ORDER BY priority DESC, created_at ASC
    LIMIT 1;
    
    -- 如果没有找到规则，使用默认成本
    IF cost_record IS NULL THEN
        final_cost := 30; -- 默认30积分
        cost_details := jsonb_build_object(
            'rule_name', 'default',
            'base_cost', final_cost,
            'dynamic_adjustments', '{}',
            'total_adjustment', 0,
            'final_cost', final_cost
        );
    ELSE
        -- 计算动态调整
        dynamic_adjustments := calculate_dynamic_cost_adjustments(
            cost_record.dynamic_cost_config,
            p_source, p_leadtype, p_campaignname, p_unitname, p_remark
        );
        
        -- 计算总调整
        SELECT COALESCE(SUM(value::integer), 0) INTO total_adjustment
        FROM jsonb_each(dynamic_adjustments);
        
        -- 计算最终成本
        final_cost := cost_record.base_points_cost + total_adjustment;
        
        -- 确保成本为正数
        IF final_cost < 1 THEN
            final_cost := 1;
        END IF;
        
        cost_details := jsonb_build_object(
            'rule_name', cost_record.name,
            'rule_id', cost_record.id,
            'base_cost', cost_record.base_points_cost,
            'dynamic_adjustments', dynamic_adjustments,
            'total_adjustment', total_adjustment,
            'final_cost', final_cost
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'points_cost', final_cost,
        'cost_details', cost_details
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'points_cost', 30
    );
END;
$$;

-- 检查成本规则条件
CREATE OR REPLACE FUNCTION public.check_cost_conditions(
    conditions jsonb,
    p_source source,
    p_leadtype text,
    p_campaignname text DEFAULT NULL,
    p_unitname text DEFAULT NULL,
    p_remark text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    extracted_community text;
BEGIN
    -- 检查来源条件
    IF conditions ? 'sources' AND p_source IS NOT NULL THEN
        IF NOT (p_source::text = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'sources')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 显式避免 leadtype 为 null 或空字符串时命中
    IF conditions ? 'lead_types' AND (p_leadtype IS NULL OR p_leadtype = '') THEN
        RETURN false;
    END IF;
    -- 检查线索类型条件
    IF conditions ? 'lead_types' AND p_leadtype IS NOT NULL THEN
        IF NOT (p_leadtype = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'lead_types')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查关键词条件（包含从remark中提取的社区信息）
    IF conditions ? 'keywords' THEN
        DECLARE
            keyword text;
            found_keyword boolean := false;
        BEGIN
            -- 优先从remark中提取community信息
            IF p_remark IS NOT NULL AND p_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
                extracted_community := (regexp_match(p_remark, '\[COMMUNITY:([^\]]+)\]'))[1];
            END IF;
            
            FOR keyword IN SELECT jsonb_array_elements_text(conditions->'keywords')
            LOOP
                IF (p_campaignname ILIKE '%' || keyword || '%' OR
                    p_unitname ILIKE '%' || keyword || '%' OR
                    p_remark ILIKE '%' || keyword || '%' OR
                    (extracted_community IS NOT NULL AND extracted_community ILIKE '%' || keyword || '%')) THEN
                    found_keyword := true;
                    EXIT;
                END IF;
            END LOOP;
            
            IF NOT found_keyword THEN
                RETURN false;
            END IF;
        END;
    END IF;
    
    RETURN true;
END;
$$;

-- 计算动态成本调整
CREATE OR REPLACE FUNCTION public.calculate_dynamic_cost_adjustments(
    dynamic_config jsonb,
    p_source source,
    p_leadtype text,
    p_campaignname text DEFAULT NULL,
    p_unitname text DEFAULT NULL,
    p_remark text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    adjustments jsonb := '{}';
    adjustment_value integer;
    extracted_community text;
BEGIN
    -- 来源调整
    IF dynamic_config ? 'source_adjustments' AND p_source IS NOT NULL THEN
        adjustment_value := COALESCE((dynamic_config->'source_adjustments'->>(p_source::text))::integer, 0);
        IF adjustment_value != 0 THEN
            adjustments := adjustments || jsonb_build_object('source_' || p_source, adjustment_value);
        END IF;
    END IF;
    
    -- 线索类型调整
    IF dynamic_config ? 'leadtype_adjustments' AND p_leadtype IS NOT NULL THEN
        adjustment_value := COALESCE((dynamic_config->'leadtype_adjustments'->>p_leadtype)::integer, 0);
        IF adjustment_value != 0 THEN
            adjustments := adjustments || jsonb_build_object('leadtype_' || p_leadtype, adjustment_value);
        END IF;
    END IF;
    
    -- 关键词调整（包含从remark中提取的社区信息）
    IF dynamic_config ? 'keyword_adjustments' THEN
        DECLARE
            keyword text;
            keyword_adjustment integer;
        BEGIN
            -- 优先从remark中提取community信息
            IF p_remark IS NOT NULL AND p_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
                extracted_community := (regexp_match(p_remark, '\[COMMUNITY:([^\]]+)\]'))[1];
            END IF;
            
            FOR keyword IN SELECT jsonb_object_keys(dynamic_config->'keyword_adjustments')
            LOOP
                keyword_adjustment := (dynamic_config->'keyword_adjustments'->>keyword)::integer;
                IF (p_campaignname ILIKE '%' || keyword || '%' OR
                    p_unitname ILIKE '%' || keyword || '%' OR
                    p_remark ILIKE '%' || keyword || '%' OR
                    (extracted_community IS NOT NULL AND extracted_community ILIKE '%' || keyword || '%')) THEN
                    adjustments := adjustments || jsonb_build_object('keyword_' || keyword, keyword_adjustment);
                END IF;
            END LOOP;
        END;
    END IF;
    
    RETURN adjustments;
END;
$$;

-- =====================================
-- 5. 扩展 allocate_from_users 函数以支持积分分配（保持原有逻辑）
-- =====================================

-- 扩展 allocate_from_users 函数，添加积分分配模式
CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method,
    p_required_points integer DEFAULT NULL  -- 新增：所需积分参数
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
    available_users bigint[];
    user_id bigint;
BEGIN
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- 如果是积分分配模式且指定了所需积分，先过滤积分足够的用户
    IF method = 'points' AND p_required_points IS NOT NULL AND p_required_points > 0 THEN
        available_users := ARRAY[]::bigint[];
        
        -- 检查每个用户的积分余额
        FOREACH user_id IN ARRAY user_list LOOP
            IF EXISTS (
                SELECT 1 FROM user_points_wallet 
                WHERE user_id = user_id::bigint 
                AND COALESCE(total_points, 0) >= p_required_points
            ) THEN
                available_users := available_users || user_id;
            END IF;
        END LOOP;
        
        -- 如果没有积分足够的用户，返回NULL
        IF array_length(available_users, 1) IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- 使用过滤后的用户列表
        user_list := available_users;
    END IF;
    
    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
            SELECT user_id INTO target_user_id
            FROM unnest(user_list) AS user_id
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = user_id::bigint
                AND sal.created_at >= CURRENT_DATE
            ) ASC, RANDOM()
            LIMIT 1;
            
        WHEN 'random' THEN
            -- 随机分配
            SELECT user_id INTO target_user_id
            FROM unnest(user_list) AS user_id
            ORDER BY RANDOM()
            LIMIT 1;
            
        WHEN 'workload' THEN
            -- 按工作量分配
            SELECT user_id INTO target_user_id
            FROM unnest(user_list) AS user_id
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = user_id::bigint
                AND sal.created_at >= CURRENT_DATE - INTERVAL '7 days'
            ) ASC, RANDOM()
            LIMIT 1;
            
        WHEN 'points' THEN
            -- 积分分配：选择积分余额最高的用户
            SELECT user_id INTO target_user_id
            FROM unnest(user_list) AS user_id
            ORDER BY (
                SELECT COALESCE(total_points, 0) FROM user_points_wallet 
                WHERE user_id = user_id::bigint
            ) DESC, RANDOM()
            LIMIT 1;
            
        ELSE
            -- 默认取第一个用户
            SELECT user_id INTO target_user_id
            FROM unnest(user_list) AS user_id
            LIMIT 1;
    END CASE;
    
    RETURN target_user_id;
END;
$$;

-- =====================================
-- 6. 创建积分处理函数（独立于分配逻辑）
-- =====================================

-- 处理积分扣除的函数
CREATE OR REPLACE FUNCTION public.process_points_deduction(
    p_user_id bigint,
    p_leadid text,
    p_source source,
    p_leadtype text,
    p_campaignname text DEFAULT NULL,
    p_unitname text DEFAULT NULL,
    p_remark text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    points_cost_result jsonb;
    points_cost integer;
    current_balance integer;
    new_balance integer;
    transaction_id bigint;
    cost_rule_id uuid;
    points_details jsonb := '{}';
BEGIN
    -- 计算积分成本
    points_cost_result := calculate_lead_points_cost(
        p_source, p_leadtype, p_campaignname, p_unitname, p_remark
    );
    
    IF (points_cost_result->>'success')::boolean THEN
        points_cost := (points_cost_result->>'points_cost')::integer;
        cost_rule_id := (points_cost_result->'cost_details'->>'rule_id')::uuid;
        
        -- 获取用户当前积分余额
        SELECT COALESCE(total_points, 0) INTO current_balance
        FROM user_points_wallet
        WHERE user_id = p_user_id;
        
        -- 检查余额是否足够
        IF current_balance >= points_cost THEN
            -- 计算新余额
            new_balance := current_balance - points_cost;
            
            -- 插入积分交易记录
            INSERT INTO user_points_transactions (
                user_id, points_change, balance_after,
                transaction_type, source_type, source_id, description
            ) VALUES (
                p_user_id, -points_cost, new_balance,
                'DEDUCT', 'ALLOCATION_LEAD', NULL,
                '线索分配扣除积分：' || p_leadid
            ) RETURNING id INTO transaction_id;
            
            -- 构建积分详情
            points_details := jsonb_build_object(
                'points_cost', points_cost,
                'user_balance_before', current_balance,
                'user_balance_after', new_balance,
                'transaction_id', transaction_id,
                'cost_rule_id', cost_rule_id,
                'deduction_reason', '线索分配',
                'cost_details', points_cost_result->'cost_details',
                'success', true
            );
        ELSE
            -- 积分不足
            points_details := jsonb_build_object(
                'error', '积分不足',
                'required_points', points_cost,
                'available_points', current_balance,
                'success', false
            );
        END IF;
    ELSE
        -- 积分成本计算失败
        points_details := jsonb_build_object(
            'error', '积分成本计算失败',
            'error_details', points_cost_result,
            'success', false
        );
    END IF;
    
    RETURN points_details;
END;
$$;

-- =====================================
-- 7. 修改分配函数以支持积分预检查
-- =====================================

-- 修改 allocate_lead_simple 函数，支持积分预检查
CREATE OR REPLACE FUNCTION public.allocate_lead_simple(
    p_leadid text,
    p_source source DEFAULT NULL,
    p_leadtype text DEFAULT NULL,
    p_community community DEFAULT NULL,
    p_manual_user_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    rule_record RECORD;
    target_user_id bigint;
    processing_result jsonb;
    group_index integer;
    user_group_id bigint;
    candidate_users bigint[];
    final_users bigint[];
    allocation_details jsonb := '{}';
    group_allocation_method allocation_method;
    debug_info jsonb := '{}';
    rules_attempted integer := 0;
    rule_success boolean := false;
    points_cost integer := NULL;
    points_cost_result jsonb;
BEGIN
    -- 添加调试日志
    debug_info := jsonb_build_object(
        'input_leadid', p_leadid,
        'input_source', p_source,
        'input_leadtype', p_leadtype,
        'input_community', p_community,
        'input_manual_user_id', p_manual_user_id
    );
    
    -- 1. 手动分配优先
    IF p_manual_user_id IS NOT NULL THEN
        debug_info := debug_info || jsonb_build_object('manual_assignment', true);
        RETURN jsonb_build_object(
            'success', true,
            'assigned_user_id', p_manual_user_id,
            'allocation_method', 'manual',
            'processing_details', jsonb_build_object('manual_assignment', true),
            'debug_info', debug_info
        );
    END IF;
    
    -- 2. 按优先级顺序尝试所有匹配的规则
    FOR rule_record IN
        SELECT * FROM simple_allocation_rules
        WHERE is_active = true
          AND check_rule_conditions(conditions, p_source, p_leadtype, p_community)
        ORDER BY priority DESC, created_at ASC
    LOOP
        rules_attempted := rules_attempted + 1;
        
        -- 遍历规则中的用户组
        group_index := 1;
        FOREACH user_group_id IN ARRAY rule_record.user_groups
        LOOP
            -- 获取用户组中的用户列表
            candidate_users := get_group_users(user_group_id);
            
            -- 应用分配过滤器
            final_users := apply_allocation_filters(
                candidate_users,
                user_group_id,
                p_community,
                true, -- 质量控制
                true, -- 社区匹配
                rule_record.enable_permission_check
            );
            
            -- 如果有可用用户，尝试分配
            IF final_users IS NOT NULL AND array_length(final_users, 1) > 0 THEN
                -- 从users_list表获取分配方法，优先使用用户组配置
                SELECT allocation INTO group_allocation_method
                FROM users_list
                WHERE id = user_group_id;
                
                -- 如果是积分分配模式，先计算积分成本
                IF group_allocation_method = 'points' THEN
                    points_cost_result := calculate_lead_points_cost(
                        p_source, p_leadtype, NULL, NULL, NULL
                    );
                    IF (points_cost_result->>'success')::boolean THEN
                        points_cost := (points_cost_result->>'points_cost')::integer;
                    END IF;
                END IF;
                
                BEGIN
                    -- 调用分配函数，传入积分成本参数
                    SELECT allocate_from_users(final_users, COALESCE(group_allocation_method, rule_record.allocation_method), points_cost) INTO target_user_id;
                    
                    IF target_user_id IS NOT NULL THEN
                        rule_success := true;
                        
                        -- 移除日志记录，由触发器统一处理
                        RETURN jsonb_build_object(
                            'success', true,
                            'assigned_user_id', target_user_id,
                            'allocation_method', rule_record.allocation_method,
                            'rule_name', rule_record.name,
                            'rule_priority', rule_record.priority,
                            'selected_group_index', group_index,
                            'rules_attempted', rules_attempted,
                            'points_cost', points_cost,
                            'processing_details', jsonb_build_object(
                                'rule_name', rule_record.name,
                                'rule_priority', rule_record.priority,
                                'group_id', user_group_id,
                                'candidate_count', array_length(candidate_users, 1),
                                'final_count', array_length(final_users, 1),
                                'allocation_method', COALESCE(group_allocation_method, rule_record.allocation_method),
                                'rules_attempted', rules_attempted,
                                'points_cost', points_cost,
                                'filters_applied', jsonb_build_object(
                                    'permission_check', rule_record.enable_permission_check
                                ),
                                'debug_info', debug_info
                            ),
                            'debug_info', debug_info
                        );
                    END IF;
                END;
            END IF;
            
            group_index := group_index + 1;
        END LOOP;
        
        EXIT WHEN rule_success;
    END LOOP;
    
    -- 如果没有成功分配，返回失败结果（不记录日志）
    RETURN jsonb_build_object(
        'success', false,
        'error', '无法找到合适的分配目标',
        'rules_attempted', rules_attempted,
        'debug_info', debug_info
    );
END;
$$;

-- =====================================
-- 8. 修改触发器以集成积分处理（保持原有逻辑）
-- =====================================

-- 修改触发器函数，集成积分信息记录
CREATE OR REPLACE FUNCTION public.simple_lead_allocation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    allocation_result jsonb;
    target_user_id bigint;
    duplicate_count integer;
    lead_community community;
    debug_info jsonb := '{}';
    points_details jsonb := '{}';
    group_allocation_method allocation_method;
    points_cost integer;
BEGIN
    -- 检查过去7天内是否有重复的phone或wechat
    SELECT COUNT(*) INTO duplicate_count
    FROM public.leads l
    WHERE (
            (NEW.phone IS NOT NULL AND NEW.phone != '' AND l.phone = NEW.phone) OR
            (NEW.wechat IS NOT NULL AND NEW.wechat != '' AND l.wechat = NEW.wechat)
    )
    AND l.created_at >= NOW() - INTERVAL '7 days'
    AND l.leadid != NEW.leadid;  -- 排除当前记录
    
    -- 如果发现重复，记录日志并返回
    IF duplicate_count > 0 THEN
        INSERT INTO simple_allocation_logs (
            leadid,
            processing_details
        ) VALUES (
            NEW.leadid,
            jsonb_build_object(
                'duplicate_found', true,
                'duplicate_count', duplicate_count,
                'check_time', NOW()
            )
        );
        RETURN NEW;
    END IF;
    
    -- 优先从remark中提取community信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
        SELECT (regexp_match(NEW.remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
        debug_info := debug_info || jsonb_build_object('community_from_remark', lead_community);
    END IF;
    
    -- 如果remark中没有community信息，则从广告信息动态推导
    IF lead_community IS NULL THEN
        SELECT community INTO lead_community
        FROM community_keywords
        WHERE EXISTS (
          SELECT 1 FROM unnest(keyword) AS k
          WHERE
            (NEW.campaignname ILIKE '%' || k || '%'
             OR NEW.unitname ILIKE '%' || k || '%'
             OR NEW.remark ILIKE '%' || k || '%')
        )
        ORDER BY priority DESC
        LIMIT 1;
        
        IF lead_community IS NOT NULL THEN
            debug_info := debug_info || jsonb_build_object('community_from_keywords', lead_community);
        END IF;
    END IF;
    
    -- 如果仍然没有匹配到，使用默认值
    IF lead_community IS NULL THEN
        SELECT enumlabel::community INTO lead_community
        FROM pg_enum 
        WHERE enumtypid = 'community'::regtype 
        ORDER BY enumsortorder 
        LIMIT 1;
        debug_info := debug_info || jsonb_build_object('community_default', lead_community);
    END IF;
    
    -- 执行分配（保持原有逻辑）
    BEGIN
        allocation_result := allocate_lead_simple(
            NEW.leadid,
            NEW.source,
            NEW.leadtype,
            lead_community,
            NULL  -- 手动分配用户
        );
        
        -- 获取分配结果
        IF allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean THEN
            target_user_id := (allocation_result->>'assigned_user_id')::bigint;
            points_cost := (allocation_result->>'points_cost')::integer;
            
            -- 如果分配成功，检查是否需要处理积分
            IF target_user_id IS NOT NULL THEN
                -- 获取用户组的分配方法
                SELECT allocation INTO group_allocation_method
                FROM users_list ul
                JOIN simple_allocation_rules sar ON ul.id = ANY(sar.user_groups)
                WHERE sar.id = (allocation_result->>'rule_id')::uuid
                LIMIT 1;
                
                -- 如果是积分分配模式，处理积分扣除
                IF group_allocation_method = 'points' AND points_cost IS NOT NULL THEN
                    points_details := process_points_deduction(
                        target_user_id,
                        NEW.leadid,
                        NEW.source,
                        NEW.leadtype,
                        NEW.campaignname,
                        NEW.unitname,
                        NEW.remark
                    );
                    
                    -- 如果积分扣除失败，记录失败信息但不影响分配结果
                    IF NOT (points_details->>'success')::boolean THEN
                        -- 记录积分扣除失败，但不影响分配结果
                        INSERT INTO simple_allocation_logs (
                            leadid,
                            processing_details
                        ) VALUES (
                            NEW.leadid,
                            jsonb_build_object(
                                'allocation_success', true,
                                'points_deduction_failed', true,
                                'points_details', points_details,
                                'debug_info', debug_info
                            )
                        );
                    END IF;
                END IF;
            END IF;
            
            -- 记录成功分配日志（包含积分信息）
            INSERT INTO simple_allocation_logs (
                leadid, 
                rule_id, 
                assigned_user_id, 
                allocation_method,
                selected_group_index, 
                processing_details,
                -- 积分相关字段
                points_cost,
                user_balance_before,
                user_balance_after,
                points_transaction_id,
                cost_rule_id
            ) VALUES (
                NEW.leadid,
                (allocation_result->>'rule_id')::uuid,
                target_user_id,
                allocation_result->>'allocation_method',
                (allocation_result->>'selected_group_index')::integer,
                jsonb_build_object(
                    'debug_info', jsonb_build_object(
                        'target_user_id', target_user_id,
                        'followup_created', true,
                        'allocation_result', allocation_result,
                        'community_from_remark', debug_info->>'community_from_remark',
                        'points_details', points_details
                    ),
                    'followup_created', true,
                    'allocation_success', true
                ),
                -- 积分相关字段
                (points_details->>'points_cost')::integer,
                (points_details->>'user_balance_before')::integer,
                (points_details->>'user_balance_after')::integer,
                (points_details->>'transaction_id')::bigint,
                (points_details->>'cost_rule_id')::uuid
            );
            
            -- 创建followups记录
            IF target_user_id IS NOT NULL THEN
                -- 检查用户是否存在
                IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                    RAISE EXCEPTION '用户ID % 不存在', target_user_id;
                END IF;
                
                -- 检查leadid是否已存在followups记录
                IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
                    INSERT INTO public.followups (
                        leadid, 
                        leadtype, 
                        followupstage, 
                        interviewsales_user_id,
                        created_at, 
                        updated_at
                    ) VALUES (
                        NEW.leadid, 
                        NEW.leadtype, 
                        '待接收', 
                        target_user_id,
                        NOW(), 
                        NOW()
                    );
                END IF;
            END IF;
        ELSE
            -- 记录分配失败的情况
            INSERT INTO simple_allocation_logs (
                leadid,
                processing_details
            ) VALUES (
                NEW.leadid,
                jsonb_build_object(
                    'allocation_failed', true,
                    'error_details', allocation_result,
                    'debug_info', debug_info
                )
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- 记录异常情况
        INSERT INTO simple_allocation_logs (
            leadid,
            processing_details
        ) VALUES (
            NEW.leadid,
            jsonb_build_object(
                'error', SQLERRM,
                'error_detail', SQLSTATE,
                'debug_info', debug_info
            )
        );
    END;
    
    RETURN NEW;
END;
$$;

-- =====================================
-- 8. 管理函数
-- =====================================

-- 创建积分成本规则
CREATE OR REPLACE FUNCTION public.create_lead_points_cost_rule(
    p_name text,
    p_description text DEFAULT NULL,
    p_base_points_cost integer DEFAULT 30,
    p_conditions jsonb DEFAULT '{}',
    p_dynamic_cost_config jsonb DEFAULT '{}',
    p_priority integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    rule_id uuid;
BEGIN
    INSERT INTO lead_points_cost (
        name, description, base_points_cost, conditions, 
        dynamic_cost_config, priority
    ) VALUES (
        p_name, p_description, p_base_points_cost, p_conditions,
        p_dynamic_cost_config, p_priority
    ) RETURNING id INTO rule_id;
    
    RETURN rule_id;
END;
$$;

-- =====================================
-- 9. 示例数据
-- =====================================

-- 创建示例积分成本规则
SELECT create_lead_points_cost_rule(
    '默认线索成本',
    '所有线索的默认积分成本',
    30,
    '{}',
    '{}',
    100
);

SELECT create_lead_points_cost_rule(
    '高价值线索成本',
    '高价值线索的积分成本',
    50,
    '{"lead_types": ["意向客户", "准客户"]}',
    '{"source_adjustments": {"抖音": 10, "微信": 5}}',
    200
);

-- =====================================
-- 10. 系统验证
-- =====================================

-- 验证积分分配系统
CREATE OR REPLACE FUNCTION public.validate_points_allocation_system()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb := '{}';
    cost_rules_count integer;
    allocation_logs_with_points integer;
    active_users_count integer;
BEGIN
    -- 检查积分成本规则数量
    SELECT COUNT(*) INTO cost_rules_count
    FROM lead_points_cost
    WHERE is_active = true;
    
    -- 检查包含积分信息的分配日志数量
    SELECT COUNT(*) INTO allocation_logs_with_points
    FROM simple_allocation_logs
    WHERE points_cost IS NOT NULL;
    
    -- 检查活跃用户数量
    SELECT COUNT(*) INTO active_users_count
    FROM users_profile
    WHERE status = 'active';
    
    -- 构建结果
    result := jsonb_build_object(
        'cost_rules', cost_rules_count,
        'allocation_logs_with_points', allocation_logs_with_points,
        'active_users', active_users_count,
        'system_ready', (cost_rules_count > 0 AND active_users_count > 0),
        'validation_time', NOW()
    );
    
    RETURN result;
END;
$$;

-- 执行系统验证
SELECT public.validate_points_allocation_system() AS points_allocation_validation; 