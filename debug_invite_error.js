// 详细诊断invite-user函数错误
const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const SUPABASE_URL = 'https://wteqgprgiylmxzszcnws.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI5NzQsImV4cCI6MjA0NzU0ODk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugInviteError() {
  console.log('🔍 开始详细诊断invite-user函数错误...\n');
  
  try {
    // 1. 检查用户登录状态
    console.log('1️⃣ 检查用户登录状态...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ 获取session失败:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('⚠️ 用户未登录，需要先登录');
      console.log('请在前端登录后再测试');
      return;
    }
    
    console.log('✅ 用户已登录:', session.user.email);
    console.log('用户ID:', session.user.id);
    
    // 2. 获取用户档案
    console.log('\n2️⃣ 获取用户档案...');
    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ 获取用户档案失败:', profileError);
      return;
    }
    
    console.log('✅ 用户档案:', {
      id: profile.id,
      organization_id: profile.organization_id,
      nickname: profile.nickname,
      status: profile.status
    });
    
    // 3. 获取组织信息
    console.log('\n3️⃣ 获取组织信息...');
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single();
    
    if (orgError) {
      console.error('❌ 获取组织信息失败:', orgError);
      return;
    }
    
    console.log('✅ 组织信息:', {
      id: organization.id,
      name: organization.name,
      admin: organization.admin,
      parent_id: organization.parent_id
    });
    
    // 4. 检查权限
    console.log('\n4️⃣ 检查用户权限...');
    const isAdmin = organization.admin === session.user.id;
    console.log('是否为直接管理员:', isAdmin);
    
    // 5. 测试邀请用户
    console.log('\n5️⃣ 测试邀请用户...');
    
    const testEmail = 'zhoulingxin0309@gmail.com';
    const testName = '测试用户';
    
    console.log('📧 邀请信息:', {
      email: testEmail,
      name: testName,
      organizationId: profile.organization_id
    });
    
    // 6. 直接调用函数并捕获详细错误
    console.log('\n6️⃣ 调用invite-user函数...');
    
    try {
      const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: testEmail,
          name: testName,
          organizationId: profile.organization_id,
          redirectTo: 'https://crm-web-ncioles-projects.vercel.app/set-password'
        }
      });
      
      if (inviteError) {
        console.error('❌ 邀请用户失败:', inviteError);
        console.log('错误详情:', {
          message: inviteError.message,
          status: inviteError.status,
          statusText: inviteError.statusText,
          name: inviteError.name
        });
        
        // 尝试获取更多错误信息
        if (inviteError.context) {
          console.log('错误上下文:', inviteError.context);
        }
        
        // 检查是否是认证问题
        if (inviteError.status === 401) {
          console.log('🔐 认证问题 - 可能需要刷新token');
        }
        
        // 检查是否是权限问题
        if (inviteError.status === 403) {
          console.log('🚫 权限问题 - 用户可能没有管理权限');
        }
        
        // 检查是否是服务器错误
        if (inviteError.status === 500) {
          console.log('🔧 服务器错误 - 可能是Edge Function内部错误');
        }
        
        return;
      }
      
      console.log('✅ 邀请用户成功:', inviteResult);
      
    } catch (invokeError) {
      console.error('❌ 调用函数时出错:', invokeError);
      console.log('错误类型:', invokeError.constructor.name);
      console.log('错误消息:', invokeError.message);
      console.log('错误堆栈:', invokeError.stack);
    }
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
    console.log('错误堆栈:', error.stack);
  }
}

// 运行诊断
debugInviteError(); 