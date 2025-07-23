import { serve } from "https://deno.land/std@0.202.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(async (req) => {
  const body = await req.json();
  console.log('[Webhook Triggered] body:', JSON.stringify(body));
  const { record, type } = body;
  if (type !== 'INSERT' || !record) {
    console.log('[Skip] Not an INSERT event or missing record.');
    return new Response('skip', { status: 200 });
  }

  // 1. 获取审批流模板
  const { data: flow, error: flowErr } = await supabase
    .from('approval_flows')
    .select('*')
    .eq('id', record.flow_id)
    .single();
  if (flowErr) {
    console.log('[Error] 查询审批流模板失败:', flowErr.message);
    return new Response('flow error', { status: 200 });
  }
  if (!flow || !flow.config?.steps) {
    console.log('[No Steps] 审批流模板无steps:', flow);
    return new Response('no steps', { status: 200 });
  }
  console.log('[Flow Loaded]', flow.id, flow.type, flow.config.steps);

  // 2. 遍历每个step
  for (const [stepIndex, step] of flow.config.steps.entries()) {
    let approverIds: number[] = [];
    if (step.default_approver_id && step.default_approver_id.length > 0) {
      approverIds = step.default_approver_id;
      console.log(`[Step ${stepIndex}] 使用default_approver_id:`, approverIds);
    } else if (step.permission) {
      // 查找拥有该权限的所有用户
      const { data: users, error: userErr } = await supabase
        .rpc('get_users_by_permission', { permission: step.permission });
      if (userErr) {
        console.log(`[Step ${stepIndex}] get_users_by_permission error:`, userErr.message);
      }
      approverIds = (users || []).map((u: any) => u.id);
      console.log(`[Step ${stepIndex}] 按permission分配审批人:`, step.permission, approverIds);
    }
    // 插入审批节点
    for (const approverId of approverIds) {
      const { error: insertErr } = await supabase.from('approval_steps').insert({
        instance_id: record.id,
        step_index: stepIndex,
        approver_id: approverId,
        status: 'pending',
        node_config: step
      });
      if (insertErr) {
        console.log(`[Step ${stepIndex}] 插入审批节点失败:`, approverId, insertErr.message);
      } else {
        console.log(`[Step ${stepIndex}] 成功插入审批节点:`, approverId);
      }
    }
  }
  console.log('[Done] 审批节点分配流程结束');
  return new Response('ok', { status: 200 });
}); 