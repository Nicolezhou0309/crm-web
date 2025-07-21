import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

serve(async (req) => {
  console.log('[activate-user] 收到请求:', req.method, req.url);
  if (req.method === 'OPTIONS') {
    console.log('[activate-user] 处理 CORS 预检请求');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, user_id, template_type, template_vars, notification } = await req.json();
    console.log('[activate-user] 解析请求体:', { email, user_id, template_type, template_vars, notification });
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const NOTIFICATION_SYSTEM_URL = Deno.env.get('NOTIFICATION_SYSTEM_URL') || `${SUPABASE_URL}/functions/v1/notification-system`;

    if (!email || !user_id) {
      console.warn('[activate-user] 缺少 email 或 user_id:', { email, user_id });
      return new Response(JSON.stringify({ error: '缺少email或user_id' }), { status: 400, headers: corsHeaders });
    }

    console.log('[activate-user] 创建 Supabase 管理员客户端');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. 激活邮箱
    console.log('[activate-user] 尝试激活邮箱:', { user_id });
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(user_id, {
      email_confirmed_at: new Date().toISOString()
    });
    if (updateUserError) {
      console.error('[activate-user] 激活邮箱失败:', updateUserError);
      return new Response(JSON.stringify({ error: '激活邮箱失败', details: updateUserError.message }), { status: 500, headers: corsHeaders });
    }
    console.log('[activate-user] 邮箱激活成功:', { user_id });

    // 2. 补全 users_profile 的 user_id
    console.log('[activate-user] 更新 users_profile:', { email, user_id });
    const { data: profile, error: profileError } = await adminClient
      .from('users_profile')
      .update({ user_id: user_id, status: 'active' })
      .eq('email', email)
      .select()
      .single();
    if (profileError || !profile) {
      console.error('[activate-user] 补全用户档案失败:', profileError);
      return new Response(JSON.stringify({ error: '补全用户档案失败', details: profileError?.message }), { status: 500, headers: corsHeaders });
    }
    console.log('[activate-user] 用户档案更新成功:', profile);

    // 3. 查询通知模板并渲染
    let notify = notification;
    if (!notify && template_type) {
      console.log('[activate-user] 查询通知模板:', { template_type });
      const { data: template, error: templateError } = await adminClient
        .from('notification_templates')
        .select('*')
        .eq('type', template_type)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (templateError || !template) {
        console.error('[activate-user] 未找到通知模板:', templateError);
        return new Response(JSON.stringify({ error: '未找到通知模板', details: templateError?.message }), { status: 500, headers: corsHeaders });
      }
      // 简单变量替换
      function render(str, vars) {
        return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars?.[k] ?? '');
      }
      notify = {
        type: template.type,
        title: render(template.title, template_vars),
        content: render(template.content, template_vars),
        metadata: template.metadata,
        priority: template.priority || 0
      };
      console.log('[activate-user] 渲染后的通知内容:', notify);
    }

    // 4. 发送通知
    if (notify) {
      console.log('[activate-user] 发送通知:', { target_user_id: profile.id, ...notify });
      const resp = await fetch(NOTIFICATION_SYSTEM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          action: 'create_notification',
          target_user_id: profile.id,
          ...notify
        })
      });
      const notifyResult = await resp.json();
      if (!resp.ok) {
        console.error('[activate-user] 发送通知失败:', notifyResult);
        return new Response(JSON.stringify({ error: '发送通知失败', details: notifyResult }), { status: 500, headers: corsHeaders });
      }
      console.log('[activate-user] 通知发送成功:', notifyResult);
    }

    console.log('[activate-user] 激活流程全部完成');
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error('[activate-user] 激活用户异常:', e);
    return new Response(JSON.stringify({ error: '激活用户异常', details: e.message }), { status: 500, headers: corsHeaders });
  }
}); 