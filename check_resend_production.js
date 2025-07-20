// 检查Resend生产环境状态
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function checkResendProduction() {
  console.log('🔍 检查Resend生产环境状态...\n');
  
  try {
    // 1. 检查API密钥状态
    console.log('1️⃣ 检查API密钥状态...');
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API密钥有效');
      console.log('📊 域名列表:', data.data || []);
    } else {
      console.log('❌ API密钥无效或权限不足');
    }
    
    // 2. 测试发送邮件到任意邮箱
    console.log('\n2️⃣ 测试发送邮件到任意邮箱...');
    
    const testEmails = [
      'test@example.com',
      'user@gmail.com',
      'newuser@outlook.com'
    ];
    
    for (const email of testEmails) {
      console.log(`\n📧 测试发送到: ${email}`);
      
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
            subject: '生产环境测试邮件',
            html: '<p>这是一封测试邮件，用于验证生产环境配置。</p>'
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          console.log(`✅ 发送成功 - 邮件ID: ${data.id}`);
          console.log('🎉 生产环境配置正常！');
        } else {
          console.log(`❌ 发送失败:`, data);
          
          // 分析错误类型
          if (data.message?.includes('testing email address')) {
            console.log('⚠️ 仍在开发环境模式');
          } else if (data.message?.includes('domain')) {
            console.log('⚠️ 域名配置问题');
          } else {
            console.log('⚠️ 其他配置问题');
          }
        }
      } catch (error) {
        console.log(`❌ 发送异常:`, error.message);
      }
    }
    
    // 3. 提供升级建议
    console.log('\n3️⃣ 升级到生产环境的步骤:');
    console.log('📋 需要完成的步骤:');
    console.log('   1. 购买域名 (如 yourcompany.com)');
    console.log('   2. 配置DNS记录');
    console.log('   3. 在Resend中验证域名');
    console.log('   4. 更新发件人地址');
    console.log('   5. 测试邮件发送');
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  }
}

// 运行检查
checkResendProduction(); 