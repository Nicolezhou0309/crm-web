# �� 全局动态域名配置指南

## �� 概述

本系统已实现全局动态域名支持，可以根据环境变量自动切换发件人域名。

## �� 配置说明

### 环境变量
- `RESEND_FROM_DOMAIN`: 发件人域名配置
- `RESEND_API_KEY`: Resend API密钥

### 域名配置
- **开发环境**: `resend.dev` → `noreply@resend.dev`
- **生产环境**: `yourdomain.com` → `noreply@yourdomain.com`

## �� 快速配置

### 1. 开发环境
```bash
supabase secrets set RESEND_FROM_DOMAIN=resend.dev
```

### 2. 生产环境
```bash
supabase secrets set RESEND_FROM_DOMAIN=yourdomain.com
```

### 3. 重新部署
```bash
supabase functions deploy invite-user
supabase functions deploy test-email
```

## 📧 支持的函数

### invite-user
- 发送邀请邮件
- 动态域名支持
- 权限验证

### test-email
- 邮件测试功能
- 配置验证
- 状态监控

## 🔍 验证配置

### 1. 检查环境变量
```bash
supabase secrets list
```

### 2. 测试邮件发送
- 访问邮件测试页面
- 发送测试邮件
- 检查发件人地址

### 3. 查看日志
```bash
supabase functions logs invite-user
supabase functions logs test-email
```

## ��️ 故障排除

### 常见问题

1. **域名未设置**
   - 错误: `RESEND_FROM_DOMAIN is not configured`
   - 解决: 设置环境变量

2. **API密钥无效**
   - 错误: `RESEND_API_KEY is not configured`
   - 解决: 检查API密钥配置

3. **域名未验证**
   - 错误: `Domain not allowed`
   - 解决: 在Resend控制台验证域名

## 📊 配置状态

### ✅ 已实现
- [x] 动态域名支持
- [x] 环境变量配置
- [x] 自动切换逻辑
- [x] 错误处理
- [x] 日志记录

### �� 待配置
- [ ] 生产环境域名
- [ ] DNS记录配置
- [ ] 域名验证
- [ ] 邮件模板优化

## 🔗 相关文件

- `supabase/functions/invite-user/index.ts` - 邀请邮件函数
- `supabase/functions/test-email/index.ts` - 测试邮件函数
- `src/utils/emailConfig.ts` - 邮件配置工具
- `setup_dynamic_domain.js` - 配置脚本 