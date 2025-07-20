// 调试invite-user Edge Function
const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const SUPABASE_URL = 'https://wteqgprgiylmxzszcnws.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI5NzQsImV4cCI6MjA0NzU0ODk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInviteUser() {
  console.log('🔍 开始测试invite-user函数...\n');
  
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
    
    // 2. 获取用户信息
    console.log('\n2️⃣ 获取用户信息...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ 获取用户信息失败:', userError);
      return;
    }
    
    console.log('✅ 用户信息:', {
      id: user.id,
      email: user.email
    });
    
    // 3. 获取用户档案
    console.log('\n3️⃣ 获取用户档案...');
    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ 获取用户档案失败:', profileError);
      return;
    }
    
    console.log('✅ 用户档案:', {
      id: profile.id,
      organization_id: profile.organization_id,
      nickname: profile.nickname
    });
    
    // 4. 获取组织信息
    console.log('\n4️⃣ 获取组织信息...');
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
      admin: organization.admin
    });
    
    // 5. 测试邀请用户
    console.log('\n5️⃣ 测试邀请用户...');
    
    const testEmail = 'test@example.com'; // 使用测试邮箱
    const testName = '测试用户';
    
    console.log('📧 邀请信息:', {
      email: testEmail,
      name: testName,
      organizationId: profile.organization_id
    });
    
    // 调用invite-user函数
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
        statusText: inviteError.statusText
      });
      return;
    }
    
    console.log('✅ 邀请用户成功:', inviteResult);
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 运行测试
testInviteUser(); 