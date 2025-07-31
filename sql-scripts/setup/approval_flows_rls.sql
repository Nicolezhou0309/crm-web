-- =============================================
-- 审批表 RLS 权限规则
-- 创建时间: 2025年1月
-- 说明: 为审批相关表设置 RLS 权限控制
-- 要求: 1. approval_manage拥有所有权限 2. 用户只拥有自己记录的增删改查权限
-- =============================================

-- 启用 RLS
ALTER TABLE public.approval_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 确保 approval_manage 权限点存在
-- =============================================

-- 插入 approval_manage 权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('approval_manage', '审批管理权限', 'approval', 'manage')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. APPROVAL_FLOWS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "approval_flows_select_policy" ON public.approval_flows;
DROP POLICY IF EXISTS "approval_flows_insert_policy" ON public.approval_flows;
DROP POLICY IF EXISTS "approval_flows_update_policy" ON public.approval_flows;
DROP POLICY IF EXISTS "approval_flows_delete_policy" ON public.approval_flows;

-- SELECT 权限：approval_manage权限可以查看所有，普通用户只能查看自己相关的
CREATE POLICY "approval_flows_select_policy" ON public.approval_flows
FOR SELECT TO public
USING (
  -- 有 approval_manage 权限的用户可以查看所有审批流模板
  has_permission('approval', 'manage')
  OR
  -- 用户查看自己创建的审批实例相关的审批流模板
  EXISTS (
    SELECT 1 FROM approval_instances ai
    JOIN users_profile up ON up.id = ai.created_by
    WHERE ai.flow_id = approval_flows.id
    AND up.user_id = auth.uid()
  )
);

-- INSERT 权限：只有approval_manage权限可以创建审批流模板
CREATE POLICY "approval_flows_insert_policy" ON public.approval_flows
FOR INSERT TO public
WITH CHECK (
  -- 只有 approval_manage 权限的用户可以创建审批流模板
  has_permission('approval', 'manage')
);

-- UPDATE 权限：只有approval_manage权限可以更新审批流模板
CREATE POLICY "approval_flows_update_policy" ON public.approval_flows
FOR UPDATE TO public
USING (
  -- 只有 approval_manage 权限的用户可以更新审批流模板
  has_permission('approval', 'manage')
)
WITH CHECK (
  -- 只有 approval_manage 权限的用户可以更新审批流模板
  has_permission('approval', 'manage')
);

-- DELETE 权限：只有approval_manage权限可以删除审批流模板
CREATE POLICY "approval_flows_delete_policy" ON public.approval_flows
FOR DELETE TO public
USING (
  -- 只有 approval_manage 权限的用户可以删除审批流模板
  has_permission('approval', 'manage')
);

-- =============================================
-- 3. APPROVAL_INSTANCES 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "approval_instances_select_policy" ON public.approval_instances;
DROP POLICY IF EXISTS "approval_instances_insert_policy" ON public.approval_instances;
DROP POLICY IF EXISTS "approval_instances_update_policy" ON public.approval_instances;
DROP POLICY IF EXISTS "approval_instances_delete_policy" ON public.approval_instances;

-- SELECT 权限：approval_manage权限可以查看所有，普通用户只能查看自己创建的
CREATE POLICY "approval_instances_select_policy" ON public.approval_instances
FOR SELECT TO public
USING (
  -- 有 approval_manage 权限的用户可以查看所有审批实例
  has_permission('approval', 'manage')
  OR
  -- 用户查看自己创建的审批实例
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_instances.created_by
  )
);

-- INSERT 权限：approval_manage权限可以创建，普通用户也可以创建自己的
CREATE POLICY "approval_instances_insert_policy" ON public.approval_instances
FOR INSERT TO public
WITH CHECK (
  -- 有 approval_manage 权限的用户可以创建所有审批实例
  has_permission('approval', 'manage')
  OR
  -- 用户创建自己的审批实例
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_instances.created_by
  )
);

-- UPDATE 权限：approval_manage权限可以更新所有，普通用户只能更新自己创建的
CREATE POLICY "approval_instances_update_policy" ON public.approval_instances
FOR UPDATE TO public
USING (
  -- 有 approval_manage 权限的用户可以更新所有审批实例
  has_permission('approval', 'manage')
  OR
  -- 用户更新自己创建的审批实例
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_instances.created_by
  )
)
WITH CHECK (
  -- 有 approval_manage 权限的用户可以更新所有审批实例
  has_permission('approval', 'manage')
  OR
  -- 用户更新自己创建的审批实例
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_instances.created_by
  )
);

-- DELETE 权限：approval_manage权限可以删除所有，普通用户只能删除自己创建的
CREATE POLICY "approval_instances_delete_policy" ON public.approval_instances
FOR DELETE TO public
USING (
  -- 有 approval_manage 权限的用户可以删除所有审批实例
  has_permission('approval', 'manage')
  OR
  -- 用户删除自己创建的审批实例
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_instances.created_by
  )
);

-- =============================================
-- 4. APPROVAL_STEPS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "approval_steps_select_policy" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_insert_policy" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_update_policy" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_delete_policy" ON public.approval_steps;

-- SELECT 权限：approval_manage权限可以查看所有，普通用户只能查看自己相关的
CREATE POLICY "approval_steps_select_policy" ON public.approval_steps
FOR SELECT TO public
USING (
  -- 有 approval_manage 权限的用户可以查看所有审批步骤
  has_permission('approval', 'manage')
  OR
  -- 用户查看自己作为审批人的审批步骤
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_steps.approver_id
  )
  OR
  -- 用户查看自己创建的审批实例的步骤
  EXISTS (
    SELECT 1 FROM approval_instances ai
    JOIN users_profile up ON up.id = ai.created_by
    WHERE ai.id = approval_steps.instance_id
    AND up.user_id = auth.uid()
  )
);

-- INSERT 权限：approval_manage权限可以创建，普通用户不能直接创建
CREATE POLICY "approval_steps_insert_policy" ON public.approval_steps
FOR INSERT TO public
WITH CHECK (
  -- 只有 approval_manage 权限的用户可以创建审批步骤
  has_permission('approval', 'manage')
);

-- UPDATE 权限：approval_manage权限可以更新所有，普通用户只能更新自己作为审批人的步骤
CREATE POLICY "approval_steps_update_policy" ON public.approval_steps
FOR UPDATE TO public
USING (
  -- 有 approval_manage 权限的用户可以更新所有审批步骤
  has_permission('approval', 'manage')
  OR
  -- 用户更新自己作为审批人的审批步骤
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_steps.approver_id
  )
)
WITH CHECK (
  -- 有 approval_manage 权限的用户可以更新所有审批步骤
  has_permission('approval', 'manage')
  OR
  -- 用户更新自己作为审批人的审批步骤
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = approval_steps.approver_id
  )
);

-- DELETE 权限：approval_manage权限可以删除所有，普通用户不能删除
CREATE POLICY "approval_steps_delete_policy" ON public.approval_steps
FOR DELETE TO public
USING (
  -- 只有 approval_manage 权限的用户可以删除审批步骤
  has_permission('approval', 'manage')
);

-- =============================================
-- 5. 权限验证函数
-- =============================================


-- 添加注释
COMMENT ON POLICY "approval_flows_select_policy" ON public.approval_flows IS '审批流模板查看权限：管理权限可查看所有，普通用户只能查看自己相关的';
COMMENT ON POLICY "approval_flows_insert_policy" ON public.approval_flows IS '审批流模板创建权限：只有管理权限可以创建';
COMMENT ON POLICY "approval_flows_update_policy" ON public.approval_flows IS '审批流模板更新权限：只有管理权限可以更新';
COMMENT ON POLICY "approval_flows_delete_policy" ON public.approval_flows IS '审批流模板删除权限：只有管理权限可以删除';

COMMENT ON POLICY "approval_instances_select_policy" ON public.approval_instances IS '审批实例查看权限：管理权限可查看所有，普通用户只能查看自己创建的';
COMMENT ON POLICY "approval_instances_insert_policy" ON public.approval_instances IS '审批实例创建权限：管理权限可创建所有，普通用户可创建自己的';
COMMENT ON POLICY "approval_instances_update_policy" ON public.approval_instances IS '审批实例更新权限：管理权限可更新所有，普通用户只能更新自己创建的';
COMMENT ON POLICY "approval_instances_delete_policy" ON public.approval_instances IS '审批实例删除权限：管理权限可删除所有，普通用户只能删除自己创建的';

COMMENT ON POLICY "approval_steps_select_policy" ON public.approval_steps IS '审批步骤查看权限：管理权限可查看所有，普通用户只能查看自己相关的';
COMMENT ON POLICY "approval_steps_insert_policy" ON public.approval_steps IS '审批步骤创建权限：只有管理权限可以创建';
COMMENT ON POLICY "approval_steps_update_policy" ON public.approval_steps IS '审批步骤更新权限：管理权限可更新所有，普通用户只能更新自己作为审批人的步骤';
COMMENT ON POLICY "approval_steps_delete_policy" ON public.approval_steps IS '审批步骤删除权限：只有管理权限可以删除'; 