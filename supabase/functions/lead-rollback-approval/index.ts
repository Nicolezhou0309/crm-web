import { serve } from "https://deno.land/std@0.202.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(async (req) => {
  try {
    const { leadid, reason, evidence, applicant_id } = await req.json();
    
    console.log('[Lead Rollback] 开始处理线索回退申请:', {
      leadid,
      reason,
      evidence: evidence?.length,
      applicant_id
    });

    if (!leadid || !reason || !evidence || !applicant_id) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. 查找审批流模板
    const { data: flow, error: flowError } = await supabase
      .from('approval_flows')
      .select('*')
      .eq('type', 'lead_rollback')
      .maybeSingle();

    if (flowError || !flow) {
      console.log('[Error] 未找到线索回退审批流模板:', flowError);
      return new Response(
        JSON.stringify({ error: '未找到审批流模板' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. 创建审批实例
    const { data: instance, error: instanceError } = await supabase
      .from('approval_instances')
      .insert({
        flow_id: flow.id,
        type: 'lead_rollback',
        target_table: 'leads',
        target_id: leadid,
        status: 'pending',
        created_by: applicant_id,
        config: {
          reason,
          evidence,
          leadid,
          applicant_id
        }
      })
      .select()
      .single();

    if (instanceError) {
      console.log('[Error] 创建审批实例失败:', instanceError);
      return new Response(
        JSON.stringify({ error: '创建审批实例失败: ' + instanceError.message }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Success] 线索回退申请已创建:', instance.id);

    // 3. 返回成功响应
    return new Response(
      JSON.stringify({ 
        success: true, 
        instance_id: instance.id,
        message: '线索回退申请已提交，等待审批'
      }), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.log('[Function Error]', error);
    return new Response(
      JSON.stringify({ error: '处理失败: ' + error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
