// 测试邮件测试页面功能
const testEmailPage = async () => {
  console.log('🧪 测试邮件测试页面功能...');
  
  try {
    // 模拟发送测试邮件
    const response = await fetch('https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5NzI5NywiZXhwIjoyMDUwMTczMjk3fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
      },
      body: JSON.stringify({
        to: 'delivered@resend.dev',
        subject: '系统邮件测试',
        content: '这是一封来自系统管理模块的测试邮件。\n\n发送时间：' + new Date().toLocaleString('zh-CN')
      })
    });

    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', data);

    if (response.ok && data.success) {
      console.log('✅ 邮件测试页面功能正常！');
      console.log('邮件ID:', data.data?.id);
    } else {
      console.log('❌ 邮件测试失败:', data.error || data.message);
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
};

// 运行测试
testEmailPage(); 