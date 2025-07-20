// 直接测试Resend API
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function testResendDirect() {
  try {
    console.log('🚀 直接测试Resend API...');
    console.log('使用API密钥:', RESEND_API_KEY.substring(0, 10) + '...');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: 'delivered@resend.dev', // 使用Resend的测试邮箱
        subject: 'Resend API直接测试邮件',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1677ff;">🎉 Resend API测试成功！</h1>
            <p>这是一封直接通过Resend API发送的测试邮件。</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>测试信息：</h3>
              <ul>
                <li><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
                <li><strong>发件人：</strong>noreply@resend.dev</li>
                <li><strong>收件人：</strong>delivered@resend.dev</li>
                <li><strong>服务商：</strong>Resend</li>
                <li><strong>测试方式：</strong>直接API调用</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 14px;">
              如果您收到这封邮件，说明您的Resend API密钥配置正确！
            </p>
          </div>
        `
      })
    });

    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', data);

    if (response.ok) {
      console.log('✅ 邮件发送成功！');
      console.log('邮件ID:', data.id);
    } else {
      console.log('❌ 邮件发送失败:', data);
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testResendDirect(); 