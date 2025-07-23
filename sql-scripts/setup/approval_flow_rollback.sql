-- 1. 新增权限点
insert into public.permissions (name, description, resource, action)
values ('lead.rollback.approve', '线索回退审批权限', 'lead', 'rollback_approve')
on conflict do nothing;

-- 2. 新增审批流模板
insert into public.approval_flows (name, type, config)
values (
  '线索回退审批流',
  'lead_rollback',
  '{
    "steps": [
      {"type": "approval", "permission": "lead.rollback.approve", "mode": "any"}
    ]
  }'
) on conflict do nothing;

-- 3. leads表补充invalid字段
alter table if exists public.leads add column if not exists invalid boolean default false;
comment on column public.leads.invalid is '线索是否无效（回退/作废）';

-- 4. 示例RLS策略（仅供参考，实际需结合业务调整）
-- 仅发起人、审批人、管理员可查审批流
-- 仅线索归属人可发起回退
-- ...

-- 5. 审批流通过后触发Edge Function（见Edge Function代码）
-- 触发器已在 approval_flow_system.sql 中定义

-- 6. 操作说明
-- 部署：supabase db push 或 supabase db execute sql-scripts/setup/approval_flow_rollback.sql 