import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  try {
    const event = await req.json();
    if (!event || event.type !== 'UPDATE' || !event.record) {
      return new Response(JSON.stringify({ error: '无效事件' }), { status: 400 });
    }
    const newRow = event.record;
    const oldRow = event.old_record;
    if (!newRow || newRow.status !== 'approved' || oldRow?.status === 'approved') {
      return new Response(JSON.stringify({ message: '无需处理' }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // 获取审批流模板
    const { data: flow, error: flowError } = await supabase
      .from('approval_flows')
      .select('*')
      .eq('id', newRow.flow_id)
      .single();
    if (flowError || !flow) {
      return new Response(JSON.stringify({ error: '审批流模板不存在' }), { status: 404 });
    }

    // 获取所有审批节点
    const { data: steps } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('instance_id', newRow.id);

    // 业务联动：线索回退审批流
    if (flow.type === 'lead_rollback' || newRow.type === 'lead_rollback') {
      const leadid = newRow.target_id;
      const applicant_id = newRow.created_by;
      const config = newRow.config || {};
      // 查询最近一次积分发放
      const { data: pointsRecord } = await supabase
        .from('points_allocation_records')
        .select('*')
        .eq('leadid', leadid)
        .eq('assigned_user_id', applicant_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pointsRecord && pointsRecord.points) {
        await supabase.rpc('add_points_to_wallet', {
          user_id: applicant_id,
          points: pointsRecord.points,
          reason: '线索回退返还',
          leadid,
        });
        await supabase.from('points_transactions').insert({
          user_id: applicant_id,
          type: 'rollback_refund',
          points: pointsRecord.points,
          leadid,
          created_at: new Date().toISOString(),
        });
      }
      await supabase.from('leads').update({ invalid: true }).eq('id', leadid);
      await supabase.from('notifications').insert({
        user_id: applicant_id,
        type: 'lead_rollback_success',
        content: `线索${leadid}回退成功，积分已返还`,
        created_at: new Date().toISOString(),
      });
      console.log('lead rollback approval processed', { leadid, applicant_id });
    }

    // 业务联动：积分审批流
    if (flow.type === 'points') {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('leadid', newRow.target_id)
        .single();
      if (leadError || !lead) {
        return new Response(JSON.stringify({ error: '业务对象不存在' }), { status: 404 });
      }
      const { error: updateError } = await supabase
        .from('leads')
        .update({ points_status: 'approved' })
        .eq('leadid', newRow.target_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: '业务操作失败', details: updateError.message }), { status: 500 });
      }
    }

    // 记录操作日志
    await supabase.from('approval_action_logs').insert({
      approval_instance_id: newRow.id,
      action: 'auto_business_action',
      detail: `审批流类型: ${flow.type}, 业务ID: ${newRow.target_id}`,
      created_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ success: true, message: '业务动作已自动执行' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}); 