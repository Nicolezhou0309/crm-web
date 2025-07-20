import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 递归检查用户是否有权限管理组织
async function checkOrgPermission(client, orgId, userId) {
  try {
    console.log('开始检查权限:', { orgId, userId });
    const { data: org, error: orgError } = await client.from('organizations').select('id, parent_id, admin').eq('id', orgId).single();
    
    if (orgError) {
      console.error('查询组织失败:', orgError);
      return false;
    }
    
    if (!org) {
      console.log('组织不存在:', orgId);
      return false;
    }
    
    console.log('组织信息:', org);
    
    // 如果当前部门的管理员是当前用户，返回true
    if (org.admin === userId) {
      console.log('用户是直接管理员');
      return true;
    }
    
    // 如果有父部门，递归检查父部门
    if (org.parent_id) {
      console.log('检查父部门权限:', org.parent_id);
      return await checkOrgPermission(client, org.parent_id, userId);
    }
    
    console.log('用户不是管理员');
    return false;
  } catch (error) {
    console.error('权限检查异常:', error);
    return false;
  }
}

// 使用Resend发送邀请邮件
async function sendInviteEmail(email, name, organizationName, inviteUrl) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

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

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'noreply@resend.dev',
      to: email,
      subject: `邀请加入 ${organizationName} - 长租公寓CRM系统`,
      html: emailHtml
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend API错误:', data);
    throw new Error(`发送邮件失败: ${data.message || '未知错误'}`);
  }

  console.log('邀请邮件发送成功:', data);
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
    console.log('收到邀请用户请求:', req.method, req.url);
    
    // 验证环境变量
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://crm-web-ncioles-projects.vercel.app';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    console.log('环境变量检查:', {
      FRONTEND_URL,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasResendKey: !!RESEND_API_KEY
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

    if (!RESEND_API_KEY) {
      console.error('缺少Resend API密钥');
      return new Response(JSON.stringify({
        error: '邮件服务配置错误，缺少Resend API密钥'
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
    
    const { email, name, organizationId, redirectTo } = body;
    
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
    
    // 获取组织信息
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
      
    if (orgError) {
      console.error('获取组织信息失败:', orgError);
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
    
    // 检查邮箱是否已被使用
    const { data: existingProfile, error: profileError } = await adminClient
      .from('users_profile')
      .select('user_id, status, email, nickname')
      .eq('email', email)
      .maybeSingle();
      
    if (profileError) {
      console.error('查询用户档案失败:', profileError);
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
        console.log('用户已注册:', email);
        return new Response(
          JSON.stringify({ error: '该邮箱已被注册，无法重复邀请' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (existingProfile.status === 'invited' || existingProfile.status === 'pending') {
        console.log('用户已被邀请但未注册，更新profile:', email);
        const { error: updateError } = await adminClient
          .from('users_profile')
          .update({ 
            nickname: name || existingProfile.nickname,
            organization_id: organizationId,
            status: 'pending'
          })
          .eq('email', email);
          
        if (updateError) {
          console.error('更新用户档案失败:', updateError);
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
      console.log('创建新用户档案:', email);
      const { error: insertError } = await adminClient
        .from('users_profile')
        .insert({ 
          email: email,
          nickname: name || email.split('@')[0],
          organization_id: organizationId,
          status: 'pending'
        });
        
      if (insertError) {
        console.error('创建用户档案失败:', insertError);
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
    
    // 设置重定向URL
    const redirectURL = redirectTo || `${FRONTEND_URL}/set-password`;
    console.log('使用重定向URL:', redirectURL);
    
    // 使用Resend发送邀请邮件
    console.log('发送邀请邮件:', email);
    try {
      const emailResult = await sendInviteEmail(
        email, 
        name || email.split('@')[0], 
        organization?.name || '团队',
        redirectURL
      );
      
      console.log('邀请邮件发送成功:', emailResult);
      return new Response(JSON.stringify({
        success: true,
        message: '邀请邮件已发送',
        data: {
          email: email,
          organization_id: organizationId,
          organization_name: organization?.name,
          invite_sent_at: new Date().toISOString(),
          redirect_url: redirectURL,
          email_id: emailResult.id
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
      
    } catch (emailError) {
      console.error('发送邀请邮件失败:', emailError);
      return new Response(JSON.stringify({
        error: '发送邀请邮件失败',
        details: emailError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
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
