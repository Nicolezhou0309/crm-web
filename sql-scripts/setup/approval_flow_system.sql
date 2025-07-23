-- =============================
-- 审批流系统表结构及扩展
-- =============================

-- 1. 审批流模板表
CREATE TABLE IF NOT EXISTS public.approval_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- 审批流名称
  type text NOT NULL, -- 业务类型（如积分、合同等）
  config jsonb NOT NULL, -- 审批流配置（节点、权限、模式等）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.approval_flows IS '审批流模板表，定义各业务类型的审批流程结构';
COMMENT ON COLUMN public.approval_flows.config IS 'JSON格式，定义审批节点、权限、审批模式、默认审批人等';

-- 2. 审批实例表
CREATE TABLE IF NOT EXISTS public.approval_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES approval_flows(id), -- 审批流模板ID
  target_table text NOT NULL, -- 业务表名（如leads、deals等）
  target_id text NOT NULL, -- 业务对象ID
  status text NOT NULL DEFAULT 'pending', -- 审批状态
  current_step int NOT NULL DEFAULT 0, -- 当前节点索引
  created_by bigint NOT NULL REFERENCES users_profile(id), -- 发起人（users_profile.id）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.approval_instances IS '审批实例表，记录每次审批流的实际运行情况，created_by为users_profile.id';

-- 3. 审批节点表
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES approval_instances(id), -- 审批实例ID
  step_index int NOT NULL, -- 节点序号
  approver_id bigint NOT NULL REFERENCES users_profile(id), -- 审批人（users_profile.id）
  status text NOT NULL DEFAULT 'pending', -- 节点状态
  comment text, -- 审批意见
  action_time timestamptz, -- 审批时间
  node_config jsonb -- 节点配置快照
);

COMMENT ON TABLE public.approval_steps IS '审批节点表，记录每个审批实例的各节点审批情况，approver_id为users_profile.id';
COMMENT ON COLUMN public.approval_steps.node_config IS 'JSON格式，记录节点配置快照，便于追溯审批人分配规则等';

-- 4. 业务表如leads增加审批流实例ID字段
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS approval_instance_id uuid REFERENCES approval_instances(id);
COMMENT ON COLUMN public.leads.approval_instance_id IS '关联的审批流实例ID';

-- =============================
-- 索引优化
-- =============================
CREATE INDEX IF NOT EXISTS idx_approval_instances_status ON public.approval_instances(status);
CREATE INDEX IF NOT EXISTS idx_approval_instances_flow_id ON public.approval_instances(flow_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_instance_id ON public.approval_steps(instance_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id ON public.approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_status ON public.approval_steps(status);

-- =============================
-- 触发器示例
-- =============================
-- 自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_approval_flows ON public.approval_flows;
CREATE TRIGGER trg_update_approval_flows
BEFORE UPDATE ON public.approval_flows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_approval_instances ON public.approval_instances;
CREATE TRIGGER trg_update_approval_instances
BEFORE UPDATE ON public.approval_instances
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 审批流通过后触发业务动作（示例：仅记录日志，实际可调用Edge Function或业务存储过程）
CREATE OR REPLACE FUNCTION approval_instance_approved_hook()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    -- 这里可调用业务逻辑，如发放积分、变更业务状态等
    RAISE NOTICE '审批流[%]已通过，业务表: %, 业务ID: %', NEW.id, NEW.target_table, NEW.target_id;
    -- 可扩展：PERFORM your_business_function(NEW.target_table, NEW.target_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_approval_instance_approved ON public.approval_instances;
CREATE TRIGGER trg_approval_instance_approved
AFTER UPDATE OF status ON public.approval_instances
FOR EACH ROW EXECUTE FUNCTION approval_instance_approved_hook();

-- =============================
-- 样例数据
-- =============================
-- 请用实际存在的 users_profile.id 替换下方样例ID
-- 审批流模板样例
INSERT INTO public.approval_flows (name, type, config)
VALUES (
  '积分发放审批流',
  'points',
  '{
    "steps": [
      {"type": "approval", "permission": "DEPT_MANAGER", "organization_field": "organization_id", "mode": "any", "default_approver_id": 1},
      {"type": "notify", "notifiers": [2]}
    ]
  }'
) ON CONFLICT DO NOTHING;

-- 审批实例样例
INSERT INTO public.approval_instances (flow_id, target_table, target_id, status, current_step, created_by)
SELECT id, 'leads', 'leadid-001', 'pending', 0, 1
FROM public.approval_flows WHERE name = '积分发放审批流'
LIMIT 1;

-- 审批节点样例
INSERT INTO public.approval_steps (instance_id, step_index, approver_id, status, node_config)
SELECT ai.id, 0, 1, 'pending', '{"type": "approval", "permission": "DEPT_MANAGER"}'
FROM public.approval_instances ai
JOIN public.approval_flows af ON ai.flow_id = af.id
WHERE af.name = '积分发放审批流'
LIMIT 1;

-- =============================
-- 权限控制建议（仅注释）
-- =============================
-- 建议结合Supabase RLS（行级安全）或Postgres POLICY实现审批流数据隔离：
-- 1. 仅审批相关人员（如发起人、审批人、管理员）可查询/操作对应审批流数据。
-- 2. 可为approval_instances、approval_steps分别设置RLS策略：
--    - 仅created_by、相关approver_id、或有特定角色/权限的用户可访问。
-- 3. 业务表如leads的approval_instance_id字段可用于联动审批流与业务权限。
-- 4. 可结合Supabase Edge Function实现更复杂的审批流与业务联动。
-- 5. 生产环境务必开启RLS并完善策略，防止越权访问。 