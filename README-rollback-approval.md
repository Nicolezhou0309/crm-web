# 线索回退审批流一键部署与使用说明

## 1. SQL脚本部署

```sh
supabase db execute sql-scripts/setup/approval_flow_rollback.sql
```

## 2. Edge Function部署

```sh
cd supabase/functions/lead-rollback-approval
supabase functions deploy lead-rollback-approval
```

## 3. 前端集成
- 回退时调用supabase.from('approval_instances').insert，type=lead_rollback，target_table=leads，target_id=线索ID，config存reason和evidence。
- 审批人可在审批中心处理。

## 4. 权限配置
- 在permissions表插入lead.rollback.approve权限点。
- 分配给审批人。

## 5. 流程说明
- 用户发起回退，审批流自动流转。
- 审批通过后自动返还积分、标记线索无效、通知用户。

## 6. 常见问题
- 上传失败：请检查rollback bucket和RLS策略。
- 审批流未触发：请检查Edge Function部署和触发器。
- 权限不足：请检查permissions表和用户分配。 