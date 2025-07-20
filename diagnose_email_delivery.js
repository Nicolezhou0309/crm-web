// 诊断邮件投递问题
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function diagnoseEmailDelivery() {
  console.log('🔍 开始诊断邮件投递问题...\n');
  
  // 1. 检查Resend API状态
  console.log('1️⃣ 检查Resend API状态...');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Resend API连接正常');
      console.log('📊 最近邮件记录:', data.data?.slice(0, 3));
    } else {
      console.log('❌ Resend API连接失败:', response.status);
    }
  } catch (error) {
    console.log('❌ 检查Resend API失败:', error.message);
  }
  
  // 2. 发送测试邮件到不同邮箱
  console.log('\n2️⃣ 发送测试邮件到不同邮箱...');
  
  const testEmails = [
    'zhoulingxin0309@gmail.com', // Resend验证邮箱
    'test@example.com', // 测试邮箱
    'delivered@resend.dev' // Resend测试邮箱
  ];
  
  for (const email of testEmails) {
    console.log(`\n📧 发送到: ${email}`);
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'noreply@resend.dev',
          to: email,
          subject: `邮件投递测试 - ${new Date().toLocaleString('zh-CN')}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1677ff;">📧 邮件投递测试</h1>
              <p>这是一封测试邮件，用于诊断邮件投递问题。</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3>测试信息：</h3>
                <ul>
                  <li><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
                  <li><strong>收件人：</strong>${email}</li>
                  <li><strong>发件人：</strong>noreply@resend.dev</li>
                  <li><strong>服务商：</strong>Resend</li>
                </ul>
              </div>
              <p style="color: #666; font-size: 14px;">
                如果您收到这封邮件，说明邮件投递正常。
              </p>
            </div>
          `
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ 发送成功 - 邮件ID: ${data.id}`);
      } else {
        console.log(`❌ 发送失败:`, data);
      }
    } catch (error) {
      console.log(`❌ 发送异常:`, error.message);
    }
  }
  
  // 3. 检查邮件状态
  console.log('\n3️⃣ 检查邮件发送状态...');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const recentEmails = data.data?.slice(0, 5) || [];
      
      console.log('📋 最近5封邮件状态:');
      recentEmails.forEach((email, index) => {
        console.log(`${index + 1}. ID: ${email.id}`);
        console.log(`   收件人: ${email.to}`);
        console.log(`   主题: ${email.subject}`);
        console.log(`   状态: ${email.status || 'unknown'}`);
        console.log(`   时间: ${email.created_at}`);
        console.log('---');
      });
    }
  } catch (error) {
    console.log('❌ 检查邮件状态失败:', error.message);
  }
  
  // 4. 提供解决方案
  console.log('\n4️⃣ 解决方案建议:');
  console.log('📧 检查以下位置:');
  console.log('   - 收件箱');
  console.log('   - 垃圾邮件文件夹');
  console.log('   - 促销邮件文件夹');
  console.log('   - 其他文件夹');
  
  console.log('\n🔧 技术建议:');
  console.log('   - 检查Resend控制台的邮件日志');
  console.log('   - 验证发件人域名');
  console.log('   - 配置SPF、DKIM等DNS记录');
  console.log('   - 联系邮箱服务商');
  
  console.log('\n📞 下一步操作:');
  console.log('   1. 登录Resend控制台查看详细日志');
  console.log('   2. 检查邮箱的垃圾邮件设置');
  console.log('   3. 尝试发送到其他邮箱地址');
  console.log('   4. 联系Resend技术支持');
}

// 运行诊断
diagnoseEmailDelivery(); 