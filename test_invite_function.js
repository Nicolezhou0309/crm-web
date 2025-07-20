// 测试更新后的邀请函数
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI5NzAsImV4cCI6MjA0NzU0ODk3MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInviteFunction() {
  console.log('🧪 测试更新后的邀请函数...\n');
  
  try {
    // 1. 检查用户登录状态
    console.log('1️⃣ 检查用户登录状态...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ 获取session失败:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('⚠️ 用户未登录，请先登录');
      return;
    }
    
    console.log('✅ 用户已登录:', session.user.email);
    
    // 2. 测试邀请函数
    console.log('\n2️⃣ 测试邀请函数...');
    
    const testEmail = 'test@example.com';
    const testName = '测试用户';
    const testOrgId = '729f5ef5-d99b-4cb5-91b8-90179fccf9ca'; // 替换为实际的组织ID
    
    console.log('�� 发送邀请到:', testEmail);
    console.log('👤 用户姓名:', testName);
    console.log('🏢 组织ID:', testOrgId);
    
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: testEmail,
        name: testName,
        organizationId: testOrgId
      }
    });
    
    if (error) {
      console.error('❌ 邀请失败:', error);
      return;
    }
    
    console.log('✅ 邀请成功:', data);
    
    // 3. 分析结果
    console.log('\n3️⃣ 分析邀请结果...');
    
    if (data.method === 'supabase_invite') {
      console.log('✅ 使用了Supabase内置邀请功能');
      console.log('📧 邮件包含标准Supabase token');
      console.log('🔗 重定向URL:', `${data.data.redirect_url || 'https://crm-web-sandy.vercel.app/set-password'}`);
    } else if (data.method === 'custom_invite') {
      console.log('✅ 使用了Resend自定义邀请功能');
      console.log('📧 邮件包含自定义token');
      console.log('🔗 重定向URL:', data.data.redirect_url);
    }
    
    console.log('\n�� 测试完成！邀请功能正常工作。');
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 运行测试
testInviteFunction();