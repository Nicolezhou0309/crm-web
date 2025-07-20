// 直接测试Resend API
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function testResendDirect() {
  console.log('🧪 直接测试Resend API...\n');
  
  try {
    // 1. 测试发送到已验证邮箱
    console.log('1️⃣ 测试发送到已验证邮箱...');
    
    const verifiedEmail = 'zhoulingxin0309@gmail.com'; // 使用已验证的邮箱
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: verifiedEmail,
        subject: '邀请测试 - 长租公寓CRM系统',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1677ff; margin: 0; font-size: 28px;">🎉 邀请测试邮件</h1>
              </div>
              
              <div style="margin-bottom: 30px;">
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
                  这是一封测试邮件，用于验证Resend API是否正常工作。
                </p>
                
                <div style="background-color: #e6f7ff; border-left: 4px solid #1677ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1677ff; margin: 0 0 15px 0;">📋 测试信息</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #333;">
                    <li><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
                    <li><strong>发件人：</strong>noreply@resend.dev</li>
                    <li><strong>收件人：</strong>${verifiedEmail}</li>
                    <li><strong>服务商：</strong>Resend</li>
                    <li><strong>测试类型：</strong>直接API调用</li>
                  </ul>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://crm-web-sandy.vercel.app/set-password?token=test_token&type=test" 
                   style="display: inline-block; background-color: #1677ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(22, 119, 255, 0.3);">
                  🚀 测试邀请链接
                </a>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 14px; margin: 0;">
                  如果您收到这封邮件，说明Resend API配置正确！
                </p>
              </div>
            </div>
          </div>
        `
      })
    });

    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', data);
    
    if (response.ok) {
      console.log('✅ 邮件发送成功！');
      console.log('📧 邮件ID:', data.id);
      console.log('📅 发送时间:', new Date().toLocaleString('zh-CN'));
      
      console.log('\n📋 检查建议:');
      console.log('1. 检查邮箱:', verifiedEmail);
      console.log('2. 查看收件箱、垃圾邮件文件夹');
      console.log('3. 搜索关键词: "邀请测试"');
      
    } else {
      console.log('❌ 邮件发送失败');
      console.log('错误信息:', data.message);
      
      // 分析错误
      if (data.message?.includes('testing email address')) {
        console.log('🔍 原因: Resend开发环境限制');
        console.log('💡 解决方案: 使用已验证的邮箱地址');
      } else if (data.message?.includes('domain')) {
        console.log('🔍 原因: 域名配置问题');
        console.log('💡 解决方案: 配置自定义域名');
      } else if (data.message?.includes('API key')) {
        console.log('🔍 原因: API密钥问题');
        console.log('💡 解决方案: 检查API密钥配置');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 运行测试
testResendDirect(); 