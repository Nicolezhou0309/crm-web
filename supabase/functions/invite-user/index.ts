import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// 递归获取所有可管理的部门ID（含自己和所有子部门）
async function getAllManageableOrgIds(adminClient: any, rootOrgId: string): Promise<string[]> {
  const result = [rootOrgId];
  
  async function findChildren(parentId: string) {
    const { data: children } = await adminClient
      .from('organizations')
      .select('id')
      .eq('parent_id', parentId);
      
    if (children && children.length > 0) {
      for (const child of children) {
        result.push(child.id);
        await findChildren(child.id);
      }
    }
  }
  
  await findChildren(rootOrgId);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('收到邀请用户请求:', req.method, req.url);
    
    // 解析请求体
    const body = await req.json();
    console.log('请求体:', body);
    
    const { 
      email,           // 邀请用户的邮箱地址
      name,            // 用户姓名（统一使用name字段）
      organizationId,  // 部门ID
      redirectTo       // 邀请链接重定向地址（可选）
    } = body;
    
    // 验证必要参数
    if (!email) {
      console.log('缺少邮箱地址');
      return new Response(
        JSON.stringify({ error: '缺少邮箱地址' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      console.log('缺少部门ID');
      return new Response(
        JSON.stringify({ error: '缺少部门ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    
    if (!authHeader) {
      console.log('缺少Authorization header');
      return new Response(
        JSON.stringify({ error: '未授权', details: '缺少Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 创建带有请求者身份的客户端
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );
    
    // 创建服务端客户端（具有管理员权限）
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // 验证请求者是否已登录
    console.log('验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('用户验证结果:', { user: requestUser?.user?.id, error: authError });
    
    if (authError || !requestUser?.user) {
      console.log('用户未授权:', authError);
      return new Response(
        JSON.stringify({ error: '未授权', details: authError?.message || '无有效用户会话' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('用户已授权:', requestUser.user.id);
    
    // 验证请求者是否有权限管理该组织
    console.log('验证组织权限:', organizationId);
    
    // 首先检查是否为超级管理员
    const { data: { session } } = await userClient.auth.getSession();
    const isSuperAdmin = session?.access_token ? 
      JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
    
    if (isSuperAdmin) {
      console.log('用户是超级管理员，权限验证通过');
    } else {
      // 检查是否为直接管理员或通过递归权限管理该部门
      const checkRecursivePermission = async (orgId: string): Promise<boolean> => {
        const { data: org } = await userClient
          .from('organizations')
          .select('id, parent_id, admin')
          .eq('id', orgId)
          .single();
          
        if (!org) return false;
        
        // 如果当前部门的管理员是当前用户，返回true
        if (org.admin === requestUser.user.id) return true;
        
        // 如果有父部门，递归检查父部门
        if (org.parent_id) {
          return await checkRecursivePermission(org.parent_id);
        }
        
        return false;
      };
      
      const hasPermission = await checkRecursivePermission(organizationId);
      console.log('递归权限检查结果:', hasPermission);
      
      if (!hasPermission) {
        console.log('无权管理此组织');
        return new Response(
          JSON.stringify({ error: '无权管理此组织' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('权限验证通过，开始邀请用户');
    
    // 检查邮箱是否已被使用
    const { data: existingProfile } = await adminClient
      .from('users_profile')
      .select('user_id, status, email, nickname')
      .eq('email', email)
      .single();
    
    if (existingProfile) {
      if (existingProfile.user_id) {
        console.log('用户已注册:', email);
        return new Response(
          JSON.stringify({ error: '该邮箱已被注册，无法重复邀请' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (existingProfile.status === 'invited' || existingProfile.status === 'pending') {
        console.log('用户已被邀请但未注册，更新为pending并重新发送邀请:', email);
        await adminClient
          .from('users_profile')
          .update({ 
            nickname: name || existingProfile.nickname,
            organization_id: organizationId,
            status: 'pending'
          })
          .eq('email', email);
      }
    } else {
      // 如果不存在profile记录，创建一个新的
      console.log('创建新的用户资料记录:', email);
      await adminClient
        .from('users_profile')
        .insert({
          email: email,
          nickname: name || email.split('@')[0],
          organization_id: organizationId,
          status: 'invited'
        });
    }
    
    // 使用Admin API发送邀请邮件
    console.log('发送邀请邮件:', email);
    
    // 方法1：使用generateLink生成邀请链接
    try {
      console.log('🔄 尝试使用generateLink方法...');
      
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          data: {
            organization_id: organizationId,
            name: name || email.split('@')[0]
          },
          redirectTo: redirectTo || 'https://wteqgprgiylmxzszcnws.supabase.co/set-password'
        }
      });

      if (linkError) {
        console.error('generateLink失败:', linkError);
        throw linkError;
      }

      console.log('✅ generateLink成功:', linkData);
      
      // 发送邀请邮件
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            organization_id: organizationId,
            name: name || email.split('@')[0]
          },
          redirectTo: redirectTo || 'https://wteqgprgiylmxzszcnws.supabase.co/set-password'
        }
      );

      if (inviteError) {
        console.error('发送邀请邮件失败:', inviteError);
        return new Response(
          JSON.stringify({ error: '发送邀请邮件失败', details: inviteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('邀请邮件发送成功:', inviteData);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '邀请邮件已发送',
          data: {
            email: email,
            organization_id: organizationId,
            invite_sent_at: new Date().toISOString(),
            invite_link: linkData?.properties?.action_link // 返回生成的邀请链接
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (linkError) {
      console.warn('generateLink失败，使用传统方法:', linkError);
      
      // 方法2：使用传统的inviteUserByEmail方法
      const inviteOptions: any = {
        data: {
          organization_id: organizationId,
          name: name || email.split('@')[0]
        }
      };
      
      // 设置重定向URL
      if (redirectTo) {
        console.log('设置重定向URL:', redirectTo);
        inviteOptions.redirectTo = redirectTo;
      } else {
        console.log('使用默认重定向URL');
        inviteOptions.redirectTo = 'https://wteqgprgiylmxzszcnws.supabase.co/set-password';
      }
      
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        inviteOptions
      );
    
      if (inviteError) {
        console.error('发送邀请邮件失败:', inviteError);
        return new Response(
          JSON.stringify({ error: '发送邀请邮件失败', details: inviteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    
      console.log('邀请邮件发送成功:', inviteData);
    
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '邀请邮件已发送',
          data: {
            email: email,
            organization_id: organizationId,
            invite_sent_at: new Date().toISOString()
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: any) {
    console.error('处理请求时出错:', error);
    return new Response(
      JSON.stringify({ error: '处理请求时出错', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 