// 诊断邮件发送问题
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI5NzAsImV4cCI6MjA0NzU0ODk3MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseEmailSending() {
  console.log('🔍 开始诊断邮件发送问题...\n');
  
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
    
    console.log('📧 发送邀请到:', testEmail);
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
      
      // 分析错误类型
      if (error.message?.includes('500')) {
        console.log('🔍 可能的原因:');
        console.log('   - Edge Function内部错误');
        console.log('   - 环境变量配置问题');
        console.log('   - 权限验证失败');
      } else if (error.message?.includes('401')) {
        console.log('🔍 可能的原因:');
        console.log('   - 用户未授权');
        console.log('   - JWT token无效');
      } else if (error.message?.includes('403')) {
        console.log('🔍 可能的原因:');
        console.log('   - 用户无权管理该组织');
        console.log('   - 组织权限配置问题');
      }
      
      return;
    }
    
    console.log('✅ 邀请成功:', data);
    
    // 3. 分析邀请结果
    console.log('\n3️⃣ 分析邀请结果...');
    
    if (data.method === 'supabase_invite') {
      console.log('✅ 使用了Supabase内置邀请功能');
      console.log('📧 邮件应该包含标准Supabase token');
      console.log('🔗 重定向URL:', `${data.data.redirect_url || 'https://crm-web-sandy.vercel.app/set-password'}`);
    } else if (data.method === 'custom_invite') {
      console.log('✅ 使用了Resend自定义邀请功能');
      console.log('📧 邮件包含自定义token');
      console.log('🔗 重定向URL:', data.data.redirect_url);
    }
    
    // 4. 检查邮件发送状态
    console.log('\n4️⃣ 检查邮件发送状态...');
    console.log('📊 邮件ID:', data.data.email_id);
    console.log('📅 发送时间:', data.data.invite_sent_at);
    
    // 5. 提供检查建议
    console.log('\n5️⃣ 检查建议:');
    console.log('📧 检查邮箱:');
    console.log('   - 收件箱');
    console.log('   - 垃圾邮件文件夹');
    console.log('   - 促销邮件文件夹');
    console.log('   - 搜索关键词: "邀请", "团队", "CRM"');
    
    console.log('\n🔍 如果没收到邮件，可能的原因:');
    console.log('   - Resend开发环境限制（只能发送到验证邮箱）');
    console.log('   - 邮件被标记为垃圾邮件');
    console.log('   - 域名配置问题');
    console.log('   - API密钥配置问题');
    
    console.log('\n✅ 诊断完成！');
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
  }
}

// 运行诊断
diagnoseEmailSending(); 