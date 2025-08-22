
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 全局邮件配置工具
export interface EmailConfig {
  fromDomain: string;
  fromAddress: string;
  apiKey: string;
  isProduction: boolean;
}

// 获取动态邮件配置
export const getEmailConfig = (): EmailConfig => {
  // 从环境变量获取域名配置
  const fromDomain = Deno.env.get('RESEND_FROM_DOMAIN') || 'resend.dev';
  const apiKey = Deno.env.get('RESEND_API_KEY') || '';
  
  // 构建发件人地址
  const fromAddress = `noreply@${fromDomain}`;
  
  // 判断是否为生产环境
  const isProduction = fromDomain !== 'resend.dev';
  
  return {
    fromDomain,
    fromAddress,
    apiKey,
    isProduction
  };
};

// 验证邮件配置
export const validateEmailConfig = (config: EmailConfig): boolean => {
  return !!(config.apiKey && config.fromAddress);
};

// 获取邮件发送参数
export const getEmailSendParams = (config: EmailConfig, to: string, subject: string, html: string) => {
  return {
    from: config.fromAddress,
    to,
    subject,
    html
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const RESEND_FROM_DOMAIN = Deno.env.get('RESEND_FROM_DOMAIN') || 'resend.dev';
  
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ 
      error: 'RESEND_API_KEY is not configured' 
    }), { status: 500 })
  }

  // 动态构建发件人地址
  const fromAddress = `noreply@${RESEND_FROM_DOMAIN}`;

  try {
    // 解析请求体获取邮件参数
    let to = 'delivered@resend.dev'; // 使用Resend测试邮箱
    let subject = 'Supabase SMTP测试邮件';
    let content = '这是一封来自Supabase和Resend的测试邮件。';
    
    try {
      const body = await req.json();
      to = body.to || to;
      subject = body.subject || subject;
      content = body.content || content;
    } catch (e) {
      console.log('使用默认邮件参数');
    }

    console.log('发送测试邮件到:', to);
    console.log('邮件主题:', subject);
    console.log('发件人地址:', fromAddress);
    console.log('使用Resend API密钥:', RESEND_API_KEY.substring(0, 10) + '...');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: fromAddress, // 使用动态域名
        to: to,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1677ff;">📧 ${subject}</h1>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>邮件内容：</h3>
              <div style="white-space: pre-wrap; line-height: 1.6;">
                ${content}
              </div>
            </div>
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1677ff;">
              <h4>📋 邮件信息</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</li>
                <li><strong>发件人：</strong>${fromAddress}</li>
                <li><strong>收件人：</strong>${to}</li>
                <li><strong>服务商：</strong>Resend</li>
                <li><strong>测试方式：</strong>Supabase Edge Function</li>
                <li><strong>域名配置：</strong>${RESEND_FROM_DOMAIN}</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
              💡 如果您收到这封邮件，说明您的Resend SMTP配置已经正常工作！
            </p>
          </div>
        `
      })
    })

    const data = await res.json()
    console.log('Resend API响应状态:', res.status);
    console.log('Resend API响应数据:', data);

    if (!res.ok) {
      console.error('Resend API错误:', data);
      return new Response(JSON.stringify({ 
        error: '发送邮件失败',
        status: res.status,
        details: data
      }), { 
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: data,
      config: {
        fromAddress,
        domain: RESEND_FROM_DOMAIN,
        isProduction: RESEND_FROM_DOMAIN !== 'resend.dev'
      }
    }), { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: '发送邮件失败',
      details: err.message 
    }), { 
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}) 