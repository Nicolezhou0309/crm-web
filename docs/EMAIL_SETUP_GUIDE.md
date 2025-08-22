# 📧 Supabase 邮件配置指南

## 问题诊断

如果您的用户收不到Supabase发送的邮件，通常是以下原因：

### 1. 默认SMTP限制
- **发送限制**：每小时仅2-3封邮件
- **收件人限制**：只能发送给项目团队成员
- **无生产保证**：默认SMTP不适合生产环境

### 2. 邮件被拦截
- 邮件被标记为垃圾邮件
- 域名信誉问题
- SPF/DKIM/DMARC配置缺失

## 解决方案

### 🚀 方案1：配置专业SMTP服务（推荐）

#### 1.1 选择SMTP服务商
推荐的服务商：
- **Resend**（推荐，对开发者友好）
- **SendGrid**（功能强大）
- **Mailgun**（价格合理）
- **Postmark**（高送达率）

#### 1.2 配置步骤

**步骤1：在Supabase Dashboard中配置**
1. 登录 https://supabase.com/dashboard
2. 进入您的项目
3. 导航到 `Authentication` → `Settings` → `SMTP Settings`
4. 启用 `Enable Custom SMTP`
5. 填入SMTP服务商提供的配置

**步骤2：典型配置示例**

**使用Resend（推荐）：**
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [您的Resend API密钥]
Sender Email: noreply@yourdomain.com
Sender Name: 您的应用名称
```

**使用SendGrid：**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [您的SendGrid API密钥]
Sender Email: noreply@yourdomain.com
Sender Name: 您的应用名称
```

**使用Mailgun：**
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: [您的Mailgun用户名]
SMTP Password: [您的Mailgun密码]
Sender Email: noreply@yourdomain.com
Sender Name: 您的应用名称
```

### 🧪 方案2：使用测试邮件服务

对于开发和测试环境，可以使用Mailtrap：

```
SMTP Host: sandbox.smtp.mailtrap.io
SMTP Port: 587
SMTP User: [您的Mailtrap用户名]
SMTP Password: [您的Mailtrap密码]
```

### 📋 方案3：检查邮件模板

确保您的邮件模板配置正确：

1. 在Supabase Dashboard中
2. 进入 `Authentication` → `Email Templates`
3. 检查并自定义邮件模板：
   - 确认注册
   - 邀请用户
   - 密码重置
   - 邮箱变更确认

## 🔧 故障排除

### 检查清单

- [ ] SMTP配置是否正确
- [ ] 发件人邮箱是否已验证
- [ ] 域名DNS记录是否正确（SPF/DKIM/DMARC）
- [ ] 邮件是否被标记为垃圾邮件
- [ ] 收件人邮箱是否有效
- [ ] 是否超过了发送限制

### 常见错误

**1. "Email address not authorized"**
- 原因：使用默认SMTP且收件人不在项目团队中
- 解决：配置自定义SMTP服务

**2. "SMTP Authentication failed"**
- 原因：SMTP凭据错误
- 解决：检查用户名和密码是否正确

**3. "Rate limit exceeded"**
- 原因：超过了发送限制
- 解决：升级到自定义SMTP服务或等待限制重置

**4. 邮件进入垃圾箱**
- 原因：域名信誉问题或缺少DNS记录
- 解决：配置SPF/DKIM/DMARC记录

## 🎯 推荐配置

### 生产环境
1. 使用专业SMTP服务（如Resend）
2. 配置自定义域名
3. 设置SPF/DKIM/DMARC记录
4. 自定义邮件模板
5. 监控邮件送达率

### 开发环境
1. 使用Mailtrap测试邮件
2. 配置本地SMTP服务
3. 使用默认模板进行测试

## 📞 获取帮助

如果问题仍然存在：
1. 检查Supabase项目日志
2. 查看SMTP服务商的发送日志
3. 联系SMTP服务商技术支持
4. 参考Supabase官方文档

## 🔗 相关资源

- [Supabase SMTP配置文档](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend集成指南](https://resend.com/docs/send-with-supabase)
- [SendGrid集成指南](https://docs.sendgrid.com/for-developers/sending-email/supabase)
- [邮件送达率最佳实践](https://supabase.com/docs/guides/auth/auth-smtp#dealing-with-abuse-how-to-maintain-the-sending-reputation-of-your-smtp-server) 