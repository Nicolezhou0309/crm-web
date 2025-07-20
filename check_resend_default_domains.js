// 检查Resend默认域名
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function checkResendDefaultDomains() {
  console.log('🔍 检查Resend默认域名...\n');
  
  try {
    // 1. 检查当前可用的域名
    console.log('1️⃣ 检查当前域名...');
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 域名列表:', data.data || []);
      
      if (data.data && data.data.length > 0) {
        console.log('📋 可用的域名:');
        data.data.forEach(domain => {
          console.log(`   - ${domain.name} (状态: ${domain.status})`);
        });
      } else {
        console.log('⚠️ 没有配置的域名');
      }
    } else {
      console.log('❌ 获取域名列表失败');
    }
    
    // 2. 测试使用默认域名发送邮件
    console.log('\n2️⃣ 测试默认域名发送...');
    
    const testEmails = [
      'test@example.com',
      'user@gmail.com',
      'newuser@outlook.com'
    ];
    
    // 尝试使用不同的发件人地址
    const fromAddresses = [
      'noreply@resend.dev',
      'hello@resend.dev',
      'info@resend.dev'
    ];
    
    for (const fromAddress of fromAddresses) {
      console.log(`\n📧 测试发件人: ${fromAddress}`);
      
      for (const email of testEmails) {
        console.log(`   发送到: ${email}`);
        
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: fromAddress,
              to: email,
              subject: '默认域名测试邮件',
              html: '<p>这是一封测试邮件，用于验证默认域名配置。</p>'
            })
          });

          const data = await response.json();
          
          if (response.ok) {
            console.log(`   ✅ 发送成功 - 邮件ID: ${data.id}`);
            console.log('🎉 默认域名配置正常！');
            return; // 找到可用的配置，退出测试
          } else {
            console.log(`   ❌ 发送失败:`, data.message);
          }
        } catch (error) {
          console.log(`   ❌ 发送异常:`, error.message);
        }
      }
    }
    
    // 3. 提供配置建议
    console.log('\n3️⃣ 配置建议:');
    console.log('📋 如果默认域名不可用，建议:');
    console.log('   1. 使用已验证的邮箱地址');
    console.log('   2. 配置自定义域名');
    console.log('   3. 使用其他邮件服务');
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  }
}

// 运行检查
checkResendDefaultDomains(); 