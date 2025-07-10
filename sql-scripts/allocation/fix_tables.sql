-- 删除并重建分配规则表
DROP TABLE IF EXISTS public.simple_allocation_rules CASCADE;

CREATE TABLE public.simple_allocation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    
    -- 触发条件（简化）
    conditions jsonb DEFAULT '{}', -- 统一的条件配置
    
    -- 分配目标（简化）
    user_groups bigint[], -- 用户组数组，按顺序尝试
    allocation_method allocation_method DEFAULT 'round_robin',
    
    -- 功能开关（简化配置）
    enable_permission_check boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 删除并重建触发器
DROP TRIGGER IF EXISTS trg_simple_allocation_rules_updated ON public.simple_allocation_rules;
DROP TRIGGER IF EXISTS check_users_profile_ids_trigger ON public.users_list;

-- 重建触发器
CREATE TRIGGER trg_simple_allocation_rules_updated
BEFORE UPDATE ON public.simple_allocation_rules
FOR EACH ROW
EXECUTE FUNCTION update_simple_allocation_rules_timestamp();

CREATE TRIGGER check_users_profile_ids_trigger 
BEFORE INSERT OR UPDATE ON public.users_list 
FOR EACH ROW
EXECUTE FUNCTION check_users_profile_ids();

-- 重建索引
DROP INDEX IF EXISTS idx_simple_allocation_rules_active;
CREATE INDEX idx_simple_allocation_rules_active 
ON simple_allocation_rules(is_active, priority) WHERE is_active = true; 