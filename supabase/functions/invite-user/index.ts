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

  // 使用Supabase内置邀请功能
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name: name,
      organization_id: organizationId,
      organization_name: organizationName
    },
    redirectTo: `${FRONTEND_URL}/set-password`
  });

  if (error) {
    console.error('❌ Supabase邀请失败:', error);
    throw new Error(`邀请失败: ${error.message}`);
  }

  console.log('✅ Supabase邀请成功:', data);
  return data;
}

// 使用Resend发送自定义邀请邮件（备用方案）
async function sendCustomInviteEmail(email, name, organizationName, inviteUrl) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const RESEND_FROM_DOMAIN = Deno.env.get('RESEND_FROM_DOMAIN') || 'resend.dev';
  
  console.log('🔍 Resend配置检查:', {
    hasApiKey: !!RESEND_API_KEY,
    apiKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0,
    domain: RESEND_FROM_DOMAIN,
    email: email,
    inviteUrl: inviteUrl
  });
  
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY 未配置');
  }

  // 动态构建发件人地址
  const fromAddress = `noreply@${RESEND_FROM_DOMAIN}`;
  
  console.log('📧 邮件配置:', {
    fromAddress,
    domain: RESEND_FROM_DOMAIN,
    isProduction: RESEND_FROM_DOMAIN !== 'resend.dev'
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1677ff; margin: 0; font-size: 28px;">🎉 邀请加入团队</h1>
        </div>
        
        <div style="margin-bottom: 30px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
            您好！您收到了来自 <strong>${organizationName}</strong> 的团队邀请。
          </p>
          
          <div style="background-color: #e6f7ff; border-left: 4px solid #1677ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1677ff; margin: 0 0 15px 0;">📋 邀请详情</h3>
            <ul style="margin: 0; padding-left: 20px; color: #333;">
              <li><strong>邀请人：</strong>${name || email.split('@')[0]}</li>
              <li><strong>团队：</strong>${organizationName}</li>
              <li><strong>邀请时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" 
             style="display: inline-block; background-color: #1677ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(22, 119, 255, 0.3);">
            🚀 立即加入团队
          </a>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #666; margin: 0 0 10px 0;">💡 使用说明</h4>
          <ol style="margin: 0; padding-left: 20px; color: #666; line-height: 1.6;">
            <li>点击上方按钮进入注册页面</li>
            <li>设置您的账户密码</li>
            <li>完善个人信息</li>
            <li>开始使用系统</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            如果您没有收到此邀请，请忽略此邮件。<br>
            此邀请链接将在7天后失效。
          </p>
        </div>
      </div>
    </div>
  `;

  const requestBody = {
    from: fromAddress,
    to: email,
    subject: `邀请加入 ${organizationName} - 长租公寓CRM系统`,
    html: emailHtml
  };

  console.log('📤 发送Resend请求:', {
    url: 'https://api.resend.com/emails',
    from: fromAddress,
    to: email,
    subject: requestBody.subject,
    hasHtml: !!requestBody.html
  });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Resend响应状态:', response.status, response.statusText);

    const data = await response.json();
    console.log('📥 Resend响应数据:', data);

    if (!response.ok) {
      console.error('❌ Resend API错误:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
      throw new Error(`Resend API错误 (${response.status}): ${data.message || data.error || '未知错误'}`);
    }

    console.log('✅ 邀请邮件发送成功:', data);
    return data;
  } catch (error) {
    console.error('❌ Resend请求异常:', error);
    throw new Error(`Resend请求失败: ${error.message}`);
  }
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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    console.log('🔍 环境变量检查:', {
      FRONTEND_URL,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasResendKey: !!RESEND_API_KEY,
      resendKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0
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
    
    if (!RESEND_API_KEY) {
      console.error('❌ 缺少RESEND_API_KEY环境变量');
      return new Response(JSON.stringify({
        error: '服务器配置错误，缺少RESEND_API_KEY环境变量'
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
    
    if (existingProfile) {
      if (existingProfile.user_id) {
        console.log('❌ 用户已注册:', email);
        return new Response(
          JSON.stringify({ error: '该邮箱已被注册，无法重复邀请' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (existingProfile.status === 'invited' || existingProfile.status === 'pending') {
        console.log('📝 用户已被邀请但未注册，更新profile:', email);
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
    } else {
      // 创建新的用户档案
      console.log('📝 创建新的用户档案:', email);
      const { error: insertError } = await adminClient
        .from('users_profile')
        .insert({
          email: email,
          nickname: name || email.split('@')[0],
          organization_id: organizationId,
          status: 'pending'
        });
        
      if (insertError) {
        console.error('❌ 创建用户档案失败:', insertError);
        return new Response(JSON.stringify({
          error: '创建用户信息失败',
          details: insertError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // 优先使用Resend发送邀请邮件
    try {
      console.log('🔄 优先使用Resend发送邀请邮件...');
      
      // 检查Resend API密钥是否配置
      if (!RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY 未配置，无法发送邀请邮件');
      }
      
      // 生成自定义邀请链接 - 使用UTF-8安全的base64编码
      const inviteData = {
        email: email,
        organization_id: organizationId,
        organization_name: organization.name,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
      };
      
      // 使用UTF-8安全的base64编码
      const inviteToken = btoa(unescape(encodeURIComponent(JSON.stringify(inviteData))));
      
      const inviteUrl = `${FRONTEND_URL}/set-password?token=${inviteToken}&type=custom_invite`;
      
      const resendResult = await sendCustomInviteEmail(
        email,
        name || email.split('@')[0],
        organization.name,
        inviteUrl
      );
      
      console.log('✅ Resend邀请成功');
      
      return new Response(JSON.stringify({
        success: true,
        method: 'resend_invite',
        data: {
          email_id: resendResult.id,
          invite_sent_at: new Date().toISOString(),
          redirect_url: inviteUrl
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
      
    } catch (resendError) {
      console.error('❌ Resend邀请失败，尝试Supabase备用方案:', resendError);
      
      // 如果Resend邀请失败，使用Supabase备用方案
      try {
        console.log('🔄 尝试使用Supabase备用方案...');
        
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
            redirect_url: `${FRONTEND_URL}/set-password`
          }
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
        
      } catch (supabaseError) {
        console.error('❌ Supabase邀请也失败:', supabaseError);
        
        return new Response(JSON.stringify({
          error: '邀请发送失败',
          details: `Resend邀请失败: ${resendError.message}, Supabase邀请失败: ${supabaseError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
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
