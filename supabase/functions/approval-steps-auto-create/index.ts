import { serve } from "https://deno.land/std@0.202.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(async (req) => {
  const body = await req.json();
  const { record, type } = body;
  // 只处理approval_instances的INSERT事件
  if (type !== 'INSERT' || !record) return new Response('skip', { status: 200 });

  // 1. 获取审批流模板
  const { data: flow } = await supabase
    .from('approval_flows')
    .select('*')
    .eq('id', record.flow_id)
    .single();
  if (!flow || !flow.config?.steps) return new Response('no steps', { status: 200 });

  // 2. 遍历每个step
  for (const [stepIndex, step] of flow.config.steps.entries()) {
    let approverIds: number[] = [];
    if (step.default_approver_id && step.default_approver_id.length > 0) {
      approverIds = step.default_approver_id;
    } else if (step.permission) {
      // 查找拥有该权限的所有用户
      const { data: users } = await supabase
        .rpc('get_users_by_permission', { permission: step.permission });
      approverIds = (users || []).map(u => u.id);
    }
    // 插入审批节点
    for (const approverId of approverIds) {
      await supabase.from('approval_steps').insert({
        instance_id: record.id,
        step_index: stepIndex,
        approver_id: approverId,
        status: 'pending',
        node_config: step
      });
    }
  }
  return new Response('ok', { status: 200 });
}); 