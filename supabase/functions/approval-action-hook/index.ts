import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  try {
    const event = await req.json();
    console.log('[Webhook Triggered] event:', JSON.stringify(event));
    if (!event || event.type !== 'UPDATE' || !event.record) {
      console.log('[Skip] 非UPDATE事件或无record:', event);
      return new Response(JSON.stringify({ error: '无效事件' }), { status: 400 });
    }
    const newRow = event.record;
    const oldRow = event.old_record;
    console.log('[Record] newRow:', JSON.stringify(newRow), 'oldRow:', JSON.stringify(oldRow));
    if (!newRow || newRow.status !== 'approved' || oldRow?.status === 'approved') {
      console.log('[Skip] 状态无需处理:', { newRowStatus: newRow?.status, oldRowStatus: oldRow?.status });
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
      console.log('[Error] 审批流模板不存在:', flowError, flow);
      return new Response(JSON.stringify({ error: '审批流模板不存在' }), { status: 404 });
    }
    console.log('[Flow Loaded]', flow.id, flow.type);

    // 获取所有审批节点
    const { data: steps } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('instance_id', newRow.id);
    console.log('[Steps Loaded]', steps?.length);

    // 业务联动：线索回退审批流
    if (flow.type === 'lead_rollback' || newRow.type === 'lead_rollback') {
      const leadid = newRow.target_id;
      const applicant_id = newRow.created_by;
      const config = newRow.config || {};
      console.log('[Lead Rollback] leadid:', leadid, 'applicant_id:', applicant_id, 'config:', config);
      
      // 查询线索分配时的积分扣除记录
      const { data: pointsRecord, error: pointsError } = await supabase
        .from('user_points_transactions')
        .select('*')
        .eq('source_type', 'ALLOCATION_LEAD')
        .eq('source_id', leadid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      console.log('[Points Record]', pointsRecord, pointsError);
      
      if (pointsRecord && pointsRecord.points_change && pointsRecord.points_change < 0) {
        // 返还积分（取绝对值）
        const refundPoints = Math.abs(pointsRecord.points_change);
        console.log('[Refund Points]', refundPoints);
        
        // 更新用户积分钱包
        const { data: wallet, error: walletError } = await supabase
          .from('user_points_wallet')
          .select('*')
          .eq('user_id', applicant_id)
          .single();
        console.log('[Wallet]', wallet, walletError);
        
        if (wallet) {
          const { error: updateWalletError } = await supabase
            .from('user_points_wallet')
            .update({
              total_points: wallet.total_points + refundPoints,
              total_earned_points: wallet.total_earned_points + refundPoints,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', applicant_id);
          console.log('[Wallet Updated]', updateWalletError);
        }
        
        // 插入积分返还交易记录
        const { error: insertRefundError } = await supabase.from('user_points_transactions').insert({
          user_id: applicant_id,
          points_change: refundPoints,
          balance_after: (wallet?.total_points || 0) + refundPoints,
          transaction_type: 'EARN',
          source_type: 'ROLLBACK_REFUND',
          source_id: leadid,
          description: `线索回退返还积分：${leadid}`
        });
        console.log('[Insert Refund Transaction]', insertRefundError);
      }
      
      // 标记线索为无效
      const { error: updateFollowupError } = await supabase.from('followups').update({ invalid: true }).eq('leadid', leadid);
      console.log('[Followup Invalid Updated]', updateFollowupError);
      
      // 发送通知
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: applicant_id,
        type: 'lead_rollback_success',
        title: '线索回退成功',
        content: `线索${leadid}回退成功，积分已返还`,
        status: 'unread',
        priority: 1,
        related_table: 'leads',
        related_id: leadid, // 字段已为 text 类型，直接存储字符串主键
        created_at: new Date().toISOString(),
      });
      console.log('[Notification Sent]', notifyError);
      
      console.log('[Lead Rollback Approval Processed]', { leadid, applicant_id });
    }

    // 业务联动：积分调整审批流
    if (flow.type === 'points_adjust' || newRow.type === 'points_adjust') {
      // 1. 解析config字段，获取user_id、points、remark
      const config = newRow.config || {};
      const user_id = config.user_id;
      const points = config.points;
      const remark = config.remark || '';
      if (!user_id || !points) {
        console.log('[Points Adjust] 缺少必要参数', config);
        return new Response(JSON.stringify({ error: '参数不完整' }), { status: 400 });
      }

      // 2. 调用数据库函数insert_user_points_transaction进行积分调整
      const { data, error } = await supabase.rpc('insert_user_points_transaction', {
        p_user_id: user_id,
        p_points_change: points,
        p_transaction_type: points > 0 ? 'EARN' : 'CONSUME',
        p_source_type: 'POINTS_ADJUST',
        p_source_id: newRow.id,
        p_description: remark || '审批流积分调整',
        p_created_by: newRow.created_by
      });
      if (error) {
        console.log('[Points Adjust] insert_user_points_transaction失败', error);
        return new Response(JSON.stringify({ error: '积分调整失败', details: error.message }), { status: 500 });
      }

      console.log('[Points Adjust Approval Processed][DB func]', { user_id, points, remark });
    }

    // 记录操作日志（使用现有表或创建新表）
    try {
      const { error: logInsertError } = await supabase.from('simple_allocation_logs').insert({
        leadid: newRow.target_id,
        processing_details: {
          action: 'approval_business_action',
          approval_instance_id: newRow.id,
          flow_type: flow.type,
          business_id: newRow.target_id,
          created_at: new Date().toISOString()
        }
      });
      console.log('[Log Inserted]', logInsertError);
    } catch (logError) {
      console.log('[Log Insert Error]:', logError);
    }

    console.log('[Done] 审批流业务动作已自动执行');
    return new Response(JSON.stringify({ success: true, message: '业务动作已自动执行' }), { status: 200 });
  } catch (e) {
    console.log('[Catch Error]', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}); 