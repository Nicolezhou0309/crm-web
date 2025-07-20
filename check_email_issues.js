// 检查邮件发送问题的详细诊断
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI5NzAsImV4cCI6MjA0NzU0ODk3MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEmailIssues() {
  console.log('🔍 详细检查邮件发送问题...\n');
  
  // 1. 检查Resend API状态
  console.log('1️⃣ 检查Resend API状态...');
  const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';
  
  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Resend API连接正常');
      console.log('📊 域名列表:', data.data || []);
    } else {
      console.log('❌ Resend API连接失败:', response.status);
    }
  } catch (error) {
    console.log('❌ 检查Resend API失败:', error.message);
  }
  
  // 2. 测试不同邮箱类型
  console.log('\n2️⃣ 测试不同邮箱类型...');
  
  const testEmails = [
    'zhoulingxin0309@gmail.com', // 已验证邮箱
    'test@example.com', // 测试邮箱
    'delivered@resend.dev' // Resend测试邮箱
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
          subject: `邮件测试 - ${new Date().toLocaleString('zh-CN')}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1677ff;">📧 邮件测试</h1>
              <p>这是一封测试邮件，用于验证邮件发送功能。</p>
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
                如果您收到这封邮件，说明邮件发送功能正常。
              </p>
            </div>
          `
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ 发送成功 - 邮件ID: ${data.id}`);
      } else {
        console.log(`❌ 发送失败:`, data.message);
        
        // 分析错误
        if (data.message?.includes('testing email address')) {
          console.log('   🔍 原因: Resend开发环境限制');
          console.log('   💡 解决方案: 使用已验证邮箱或配置自定义域名');
        } else if (data.message?.includes('domain')) {
          console.log('   🔍 原因: 域名配置问题');
          console.log('   💡 解决方案: 在Resend中验证域名');
        }
      }
    } catch (error) {
      console.log(`❌ 发送异常:`, error.message);
    }
  }
  
  // 3. 检查Edge Function状态
  console.log('\n3️⃣ 检查Edge Function状态...');
  
  try {
    const { data, error } = await supabase.functions.invoke('test-email', {
      body: {
        to: 'zhoulingxin0309@gmail.com',
        subject: 'Edge Function测试',
        content: '这是通过Edge Function发送的测试邮件'
      }
    });
    
    if (error) {
      console.log('❌ Edge Function测试失败:', error);
    } else {
      console.log('✅ Edge Function测试成功:', data);
    }
  } catch (error) {
    console.log('❌ Edge Function调用失败:', error.message);
  }
  
  // 4. 提供解决方案
  console.log('\n4️⃣ 解决方案建议:');
  console.log('\n📧 如果邮件发送成功但收不到:');
  console.log('1. 检查垃圾邮件文件夹');
  console.log('2. 检查邮件过滤设置');
  console.log('3. 将发件人添加到联系人');
  console.log('4. 搜索关键词: "邀请", "团队", "CRM"');
  
  console.log('\n🔧 如果邮件发送失败:');
  console.log('1. 使用已验证的邮箱地址');
  console.log('2. 配置自定义域名');
  console.log('3. 检查API密钥配置');
  console.log('4. 升级到Resend生产环境');
  
  console.log('\n✅ 诊断完成！');
}

// 运行诊断
checkEmailIssues(); 