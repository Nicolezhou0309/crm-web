// 直接测试邀请邮件发送功能
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function testInviteEmail() {
  try {
    console.log('🧪 测试邀请邮件发送功能...');
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1677ff; margin: 0; font-size: 28px;">🎉 邀请加入团队</h1>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              您好！您收到了来自 <strong>测试团队</strong> 的团队邀请。
            </p>
            
            <div style="background-color: #e6f7ff; border-left: 4px solid #1677ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1677ff; margin: 0 0 15px 0;">📋 邀请详情</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333;">
                <li><strong>邀请人：</strong>系统管理员</li>
                <li><strong>团队：</strong>测试团队</li>
                <li><strong>邀请时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
              </ul>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://crm-web-ncioles-projects.vercel.app/set-password" 
               style="display: inline-block; background-color: #1677ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(22, 119, 255, 0.3);">
              🚀 立即加入团队
            </a>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #666; margin: 0 0 10px 0;">💡 使用说明</h4>
            <ol style="margin: 0; padding-left: 20px; color: #666; line-height: 1.6;">
              <li>点击上方按钮进入注册页面</li>
              <li>设置您的账户密码</li>
              <li>完善个人信息</li>
              <li>开始使用系统</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              如果您没有收到此邀请，请忽略此邮件。<br>
              此邀请链接将在7天后失效。
            </p>
          </div>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: 'zhoulingxin0309@gmail.com',
        subject: '邀请加入测试团队 - 长租公寓CRM系统',
        html: emailHtml
      })
    });

    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', data);

    if (response.ok) {
      console.log('✅ 邀请邮件发送成功！');
      console.log('邮件ID:', data.id);
      console.log('📧 请检查邮箱: zhoulingxin0309@gmail.com');
    } else {
      console.log('❌ 邀请邮件发送失败:', data);
    }

  } catch (error) {
    console.error('❌ 发送邀请邮件失败:', error);
  }
}

// 运行测试
testInviteEmail(); 