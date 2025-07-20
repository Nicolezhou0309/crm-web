import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
// 递归检查用户是否有权限管理组织
async function checkOrgPermission(client, orgId, userId) {
  const { data: org } = await client.from('organizations').select('id, parent_id, admin').eq('id', orgId).single();
  if (!org) return false;
  // 如果当前部门的管理员是当前用户，返回true
  if (org.admin === userId) return true;
  // 如果有父部门，递归检查父部门
  if (org.parent_id) {
    return await checkOrgPermission(client, org.parent_id, userId);
  }
  return false;
}
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    console.log('收到邀请用户请求:', req.method, req.url);
    // 验证环境变量
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://crm-web-ncioles-projects.vercel.app';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('环境变量检查:', {
      FRONTEND_URL,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
    });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('缺少必要的环境变量');
      return new Response(JSON.stringify({
        error: '服务器配置错误，缺少必要的环境变量'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 解析请求体
    const body = await req.json();
    console.log('请求体:', body);
    const { email, name, organizationId, redirectTo// 邀请链接重定向地址（可选）
     } = body;
    // 验证必要参数
    if (!email) {
      console.log('缺少邮箱地址');
      return new Response(JSON.stringify({
        error: '缺少邮箱地址'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!organizationId) {
      console.log('缺少部门ID');
      return new Response(JSON.stringify({
        error: '缺少部门ID'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    if (!authHeader) {
      console.log('缺少Authorization header');
      return new Response(JSON.stringify({
        error: '未授权',
        details: '缺少Authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 创建带有请求者身份的客户端
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // 创建服务端客户端（具有管理员权限）
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // 验证请求者是否已登录
    console.log('验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('用户验证结果:', {
      user: requestUser?.user?.id,
      error: authError
    });
    if (authError || !requestUser?.user) {
      console.log('用户未授权:', authError);
      return new Response(JSON.stringify({
        error: '未授权',
        details: authError?.message || '无有效用户会话'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('用户已授权:', requestUser.user.id);
    // 验证请求者是否有权限管理该组织
    console.log('验证组织权限:', organizationId);
    // 检查是否为直接管理员或通过递归权限管理该部门
    const hasPermission = await checkOrgPermission(userClient, organizationId, requestUser.user.id);
    console.log('权限检查结果:', hasPermission);
    if (!hasPermission) {
      console.log('无权管理此组织');
      return new Response(JSON.stringify({
        error: '无权管理此组织'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('权限验证通过，开始邀请用户');
    // 检查邮箱是否已被使用
    const { data: existingProfile } = await adminClient.from('users_profile').select('user_id, status, email, nickname').eq('email', email).maybeSingle();
    if (existingProfile) {
      if (existingProfile.user_id) {
        console.log('用户已注册:', email);
        return new Response(
          JSON.stringify({ error: '该邮箱已被注册，无法重复邀请' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (existingProfile.status === 'invited' || existingProfile.status === 'pending') {
        console.log('用户已被邀请但未注册，插入新profile:', email);
        await adminClient
          .from('users_profile')
          .insert({ 
            email: email,
            nickname: name || existingProfile.nickname,
            organization_id: organizationId,
            status: 'pending'
          });
      }
    }
    
    // 设置重定向URL
    const redirectURL = redirectTo || `${FRONTEND_URL}/set-password`;
    console.log('使用重定向URL:', redirectURL);
    // 发送邀请邮件
    console.log('发送邀请邮件:', email);
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        organization_id: organizationId,
        name: name || email.split('@')[0]
      },
      redirectTo: redirectURL
    });
    if (inviteError) {
      console.error('发送邀请邮件失败:', inviteError);
      return new Response(JSON.stringify({
        error: '发送邀请邮件失败',
        details: inviteError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('邀请邮件发送成功:', inviteData);
    return new Response(JSON.stringify({
      success: true,
      message: '邀请邮件已发送',
      data: {
        email: email,
        organization_id: organizationId,
        invite_sent_at: new Date().toISOString(),
        redirect_url: redirectURL
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
