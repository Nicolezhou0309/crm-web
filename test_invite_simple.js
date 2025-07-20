// 简化测试invite-user函数
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
      nickname: profile.nickname
    });
    
    // 3. 测试邀请用户
    console.log('\n3️⃣ 测试邀请用户...');
    
    const testEmail = 'zhoulingxin0309@gmail.com'; // 使用验证过的邮箱
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
        statusText: inviteError.statusText,
        name: inviteError.name
      });
      
      // 尝试获取更多错误信息
      if (inviteError.context) {
        console.log('错误上下文:', inviteError.context);
      }
      
      return;
    }
    
    console.log('✅ 邀请用户成功:', inviteResult);
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
    console.log('错误堆栈:', error.stack);
  }
}

// 运行测试
testInviteUser(); 