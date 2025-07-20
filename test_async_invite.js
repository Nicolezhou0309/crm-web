// 异步邀请功能测试脚本
// 用于验证邀请流程的异步处理

const { createClient } = require('@supabase/supabase-js');

// 配置Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wteqgprgiylmxzszcnws.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'your-anon-key'
);

// 模拟异步邀请函数
async function testAsyncInvite() {
  console.log('🚀 开始测试异步邀请功能...');
  
  const testEmail = 'test@example.com';
  const testName = '测试用户';
  const organizationId = 'test-org-id';
  
  try {
    // 1. 显示加载状态
    console.log('📧 正在发送邀请邮件...');
    
    // 2. 异步发送邀请（不等待结果）
    const invitePromise = supabase.functions.invoke('invite-user', {
      body: {
        email: testEmail,
        name: testName,
        organizationId: organizationId,
        redirectTo: 'https://your-app.com/set-password'
      }
    });
    
    // 3. 立即返回，不阻塞界面
    console.log('✅ 邀请请求已发送，界面继续响应...');
    
    // 4. 处理结果（可选）
    invitePromise.then(({ data, error }) => {
      if (error) {
        console.error('❌ 邀请失败:', error);
      } else {
        console.log('✅ 邀请成功:', data);
      }
    }).catch((error) => {
      console.error('❌ 邀请异常:', error);
    });
    
    console.log('🎉 测试完成：邀请已异步处理');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  testAsyncInvite();
}

module.exports = { testAsyncInvite }; 