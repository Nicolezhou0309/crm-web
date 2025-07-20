# Resend邀请邮件调试指南

## 问题分析

根据错误日志，Supabase内置邀请功能失败，错误信息为"Error sending invite email"。我们已经修改了邀请函数，现在优先使用Resend发送邮件。

## 修改内容

### 1. 优先级调整
- **之前**: Supabase内置邀请 → Resend备用方案
- **现在**: Resend主要方案 → Supabase备用方案

### 2. 增强的错误处理
- 添加了详细的Resend配置检查
- 增加了API请求和响应的详细日志
- 改进了错误信息的可读性

### 3. 环境变量验证
- 在函数开始时严格检查`RESEND_API_KEY`
- 提供更明确的错误信息

## 调试步骤

### 1. 检查环境变量
```bash
npx supabase secrets list
```
确保`RESEND_API_KEY`已正确配置。

### 2. 查看函数日志
在Supabase Dashboard中查看函数日志：
1. 访问 https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/functions
2. 点击`invite-user`函数
3. 查看"Logs"标签页

### 3. 测试邀请功能
使用前端界面发送邀请，观察控制台日志。

## 预期的日志输出

### 成功情况
```
🔍 环境变量检查: {
  FRONTEND_URL: 'https://crm-web-sandy.vercel.app',
  hasSupabaseUrl: true,
  hasAnonKey: true,
  hasServiceKey: true,
  hasResendKey: true,
  resendKeyLength: 51
}

🔄 优先使用Resend发送邀请邮件...

🔍 Resend配置检查: {
  hasApiKey: true,
  apiKeyLength: 51,
  domain: 'resend.dev',
  email: 'test@example.com',
  inviteUrl: 'https://crm-web-sandy.vercel.app/set-password?token=...'
}

📧 邮件配置: {
  fromAddress: 'noreply@resend.dev',
  domain: 'resend.dev',
  isProduction: false
}

📤 发送Resend请求: {
  url: 'https://api.resend.com/emails',
  from: 'noreply@resend.dev',
  to: 'test@example.com',
  subject: '邀请加入 测试团队 - 长租公寓CRM系统',
  hasHtml: true
}

📥 Resend响应状态: 200 OK
📥 Resend响应数据: { id: 'abc123...' }
✅ 邀请邮件发送成功: { id: 'abc123...' }
```

### 失败情况
如果Resend失败，会看到：
```
❌ Resend邀请失败，尝试Supabase备用方案: Error: Resend API错误 (401): Unauthorized
🔄 尝试使用Supabase备用方案...
```

## 常见问题

### 1. RESEND_API_KEY未配置
**错误**: `RESEND_API_KEY 未配置，无法发送邀请邮件`
**解决**: 在Supabase Dashboard中设置环境变量

### 2. Resend API密钥无效
**错误**: `Resend API错误 (401): Unauthorized`
**解决**: 检查Resend API密钥是否正确

### 3. 域名未验证
**错误**: `Resend API错误 (400): Domain not verified`
**解决**: 在Resend Dashboard中验证发件人域名

### 4. 网络连接问题
**错误**: `Resend请求失败: fetch failed`
**解决**: 检查网络连接和防火墙设置

## 下一步

1. 测试邀请功能，观察新的日志输出
2. 如果仍有问题，请提供详细的错误日志
3. 根据日志信息进一步调试

## 联系支持

如果问题持续存在，请提供：
- 完整的函数日志
- 错误发生时的具体操作步骤
- 环境变量配置截图（隐藏敏感信息） 