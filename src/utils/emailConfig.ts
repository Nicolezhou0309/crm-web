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