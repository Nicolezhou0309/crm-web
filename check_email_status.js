// 检查邮件发送状态
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function checkEmailStatus() {
  console.log('🔍 检查邮件发送状态...');
  
  try {
    // 检查Resend API状态
    const response = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Resend API连接正常');
      console.log('📊 邮件统计:', data);
    } else {
      console.log('❌ Resend API连接失败:', response.status);
    }

  } catch (error) {
    console.error('❌ 检查邮件状态失败:', error);
  }
}

// 发送测试邮件到真实邮箱
async function sendToRealEmail() {
  console.log('\n📧 尝试发送到真实邮箱...');
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: 'zhoulingxin0309@gmail.com', // 使用Resend账户的验证邮箱
        subject: '真实邮箱测试 - Supabase邮件系统',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1677ff;">📧 真实邮箱测试成功！</h1>
            <p>这是一封发送到您真实邮箱的测试邮件。</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>测试信息：</h3>
              <ul>
                <li><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
                <li><strong>发件人：</strong>noreply@resend.dev</li>
                <li><strong>收件人：</strong>zhoulingxin0309@gmail.com</li>
                <li><strong>服务商：</strong>Resend</li>
                <li><strong>测试类型：</strong>真实邮箱测试</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
              💡 如果您收到这封邮件，说明邮件系统配置正确！
            </p>
          </div>
        `
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ 邮件发送成功！');
      console.log('邮件ID:', data.id);
      console.log('📧 请检查您的邮箱: zhoulingxin0309@gmail.com');
      console.log('💡 提示：请检查垃圾邮件文件夹');
    } else {
      console.log('❌ 邮件发送失败:', data);
    }

  } catch (error) {
    console.error('❌ 发送邮件失败:', error);
  }
}

// 运行检查
checkEmailStatus().then(() => {
  sendToRealEmail();
}); 