import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 简化的权限检查函数
async function checkOrgPermission(client, orgId, userId) {
  try {
    console.log('🔍 开始检查权限:', { orgId, userId });
    
    // 首先检查用户是否是该组织的管理员
    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id, parent_id, admin, name')
      .eq('id', orgId)
      .single();
    
    if (orgError) {
      console.error('❌ 查询组织失败:', orgError);
      return false;
    }
    
    if (!org) {
      console.log('❌ 组织不存在:', orgId);
      return false;
    }
    
    console.log('✅ 组织信息:', org);
    
    // 如果当前部门的管理员是当前用户，返回true
    if (org.admin === userId) {
      console.log('✅ 用户是直接管理员');
      return true;
    }
    
    // 如果有父部门，递归检查父部门
    if (org.parent_id) {
      console.log('🔍 检查父部门权限:', org.parent_id);
      return await checkOrgPermission(client, org.parent_id, userId);
    }
    
    console.log('❌ 用户不是管理员');
    return false;
  } catch (error) {
    console.error('❌ 权限检查异常:', error);
    return false;
  }
}

// 使用Supabase内置邀请功能发送邀请邮件
async function sendSupabaseInvite(email, name, organizationId, organizationName) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://crm-web-sandy.vercel.app';
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  // 创建服务端客户端
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('📧 发送Supabase邀请邮件:', {
    email,
    name,
    organizationId,
    organizationName,
    redirectUrl: `${FRONTEND_URL}/set-password`
  });
  // 新增详细日志
  console.log('[DEBUG] inviteUserByEmail 参数:', {
    email,
    name,
    organization_id: organizationId,
    organization_name: organizationName,
    redirectTo: `${FRONTEND_URL}/set-password`,
    typeof_email: typeof email,
    typeof_name: typeof name,
    typeof_organization_id: typeof organizationId,
    typeof_organization_name: typeof organizationName
  });

  // 使用Supabase内置邀请功能
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name: name,
      organization_id: organizationId,
      organization_name: organizationName
    },
    redirectTo: `${FRONTEND_URL}/set-password`
  });
  // 新增详细日志
  if (error) {
    console.error('[DEBUG] inviteUserByEmail 返回 error:', error);
  } else {
    console.log('[DEBUG] inviteUserByEmail 返回 data:', data);
  }

  if (error) {
    console.error('❌ Supabase邀请失败:', error);
    throw new Error(`邀请失败: ${error.message}`);
  }

  console.log('✅ Supabase邀请成功:', data);
  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    console.log('🚀 收到邀请用户请求:', req.method, req.url);
    
    // 验证环境变量
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://crm-web-sandy.vercel.app';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔍 环境变量检查:', {
      FRONTEND_URL,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
    });
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ 缺少必要的Supabase环境变量');
      return new Response(JSON.stringify({
        error: '服务器配置错误，缺少必要的Supabase环境变量'
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
    console.log('📋 请求体:', body);
    
    const { email, name, organizationId, redirectTo } = body;
    
    // 验证必要参数
    if (!email) {
      console.log('❌ 缺少邮箱地址');
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
      console.log('❌ 缺少部门ID');
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
    console.log('🔍 Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    
    if (!authHeader) {
      console.log('❌ 缺少Authorization header');
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
    console.log('🔍 验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('🔍 用户验证结果:', {
      user: requestUser?.user?.id,
      email: requestUser?.user?.email,
      error: authError
    });
    
    if (authError || !requestUser?.user) {
      console.log('❌ 用户未授权:', authError);
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
    
    console.log('✅ 用户已授权:', requestUser.user.id);
    
    // 验证请求者是否有权限管理该组织
    console.log('🔍 验证组织权限:', organizationId);
    const hasPermission = await checkOrgPermission(userClient, organizationId, requestUser.user.id);
    console.log('🔍 权限检查结果:', hasPermission);
    
    if (!hasPermission) {
      console.log('❌ 无权管理此组织');
      return new Response(JSON.stringify({
        error: '无权管理此组织',
        details: '您没有权限邀请用户到此组织'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('✅ 权限验证通过，开始邀请用户');
    
    // 获取组织信息
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
      
    if (orgError) {
      console.error('❌ 获取组织信息失败:', orgError);
      return new Response(JSON.stringify({
        error: '获取组织信息失败',
        details: orgError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('✅ 组织信息:', organization);
    
    // 检查邮箱是否已被使用
    const { data: existingProfile, error: profileError } = await adminClient
      .from('users_profile')
      .select('user_id, status, email, nickname')
      .eq('email', email)
      .maybeSingle();
      
    if (profileError) {
      console.error('❌ 查询用户档案失败:', profileError);
      return new Response(JSON.stringify({
        error: '查询用户信息失败',
        details: profileError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (existingProfile && existingProfile.user_id) {
      // 已注册
      console.log('❌ 用户已注册:', email);
      return new Response(
        JSON.stringify({ error: '该邮箱已被注册，无法重复邀请' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (existingProfile && (existingProfile.status === 'invited' || existingProfile.status === 'pending')) {
      // 已被邀请但未注册，可以更新部门/昵称
      const { error: updateError } = await adminClient
        .from('users_profile')
        .update({ 
          nickname: name || existingProfile.nickname,
          organization_id: organizationId,
          status: 'pending'
        })
        .eq('email', email);
        
      if (updateError) {
        console.error('❌ 更新用户档案失败:', updateError);
        return new Response(JSON.stringify({
          error: '更新用户信息失败',
          details: updateError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // 不再主动 insert profile
    
    // 只用Supabase默认邀请
    try {
      const redirectToUrl = `${FRONTEND_URL}/set-password`;
      console.log('🔄 使用Supabase默认邀请邮件...');
      console.log('📢 实际使用的 redirectTo:', redirectToUrl);
      const supabaseInviteResult = await sendSupabaseInvite(
        email, 
        name || email.split('@')[0], 
        organizationId, 
        organization.name
      );
      console.log('✅ Supabase邀请成功');
      return new Response(JSON.stringify({
        success: true,
        method: 'supabase_invite',
        data: {
          email_id: supabaseInviteResult.id,
          invite_sent_at: new Date().toISOString(),
          redirect_url: redirectToUrl
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (supabaseError) {
      console.error('❌ Supabase邀请失败:', supabaseError);
      // 新增：如果错误为已注册，自动发送重置密码邮件
      if (supabaseError.message && supabaseError.message.includes('already been registered')) {
        try {
          const resetRedirectTo = `${FRONTEND_URL}/set-password`;
          console.log('🔄 用户已注册，尝试发送重置密码邮件...');
          console.log('📢 实际使用的 reset redirectTo:', resetRedirectTo);
          const { data: resetData, error: resetError } = await adminClient.auth.admin.resetPasswordForEmail(email, {
            redirectTo: resetRedirectTo
          });
          if (resetError) {
            console.error('❌ 发送重置密码邮件失败:', resetError);
            return new Response(JSON.stringify({
              error: '发送重置密码邮件失败',
              details: resetError.message
            }), {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          console.log('✅ 重置密码邮件已发送:', resetData);
          return new Response(JSON.stringify({
            success: true,
            method: 'reset_password',
            data: {
              reset_sent_at: new Date().toISOString(),
              redirect_url: resetRedirectTo
            }
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (resetCatchError) {
          console.error('❌ 发送重置密码邮件异常:', resetCatchError);
          return new Response(JSON.stringify({
            error: '发送重置密码邮件异常',
            details: resetCatchError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // 其它错误原样返回
      return new Response(JSON.stringify({
        error: '邀请发送失败',
        details: supabaseError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('❌ 邀请用户异常:', error);
    return new Response(JSON.stringify({
      error: '邀请用户失败',
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
