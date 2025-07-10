# Supabase部署指南

## 概述

本指南将帮助您将CRM系统部署到Supabase平台。Supabase提供了完整的后端服务，包括数据库、认证、存储和Edge Functions。

## 准备工作

### 1. 安装Supabase CLI

```bash
# 使用官方安装脚本
curl -fsSL https://supabase.com/install.sh | sh

# 或者使用npm（如果可用）
npm install -g supabase
```

### 2. 登录Supabase

```bash
supabase login
```

### 3. 检查项目状态

```bash
supabase status
```

## 部署步骤

### 步骤1：构建项目

```bash
npm run build
```

### 步骤2：链接到Supabase项目

```bash
# 替换YOUR_PROJECT_REF为您的实际项目引用
supabase link --project-ref wteqgprgiylmxzszcnws
```

### 步骤3：部署Edge Functions

```bash
# 部署所有Edge Functions
supabase functions deploy invite-user
supabase functions deploy check-department-admin
supabase functions deploy email-management
supabase functions deploy manage-department-admins
supabase functions deploy role-permission-management
```

### 步骤4：配置环境变量

在Supabase控制台中设置以下环境变量：

1. 访问 https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api
2. 复制以下值：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 步骤5：配置重定向URL

在Supabase控制台中配置重定向URL：

1. 访问 https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/url-configuration
2. 添加以下URL到"Redirect URLs"：
   - `https://your-domain.supabase.co/set-password`
   - `https://your-domain.vercel.app/set-password`（如果使用Vercel）

## 使用部署脚本

我们提供了一个自动化部署脚本：

```bash
./deploy-to-supabase.sh
```

这个脚本会自动：
- 构建项目
- 检查Supabase登录状态
- 部署所有Edge Functions
- 创建部署配置

## 配置生产域名

### 选项1：使用Supabase Hosting（推荐）

Supabase提供了免费的前端托管服务：

1. 在Supabase控制台中启用Hosting
2. 上传构建后的`dist`文件夹
3. 配置自定义域名（可选）

### 选项2：使用Vercel

1. 部署到Vercel
2. 在Supabase中配置重定向URL为Vercel域名

### 选项3：使用Netlify

1. 部署到Netlify
2. 在Supabase中配置重定向URL为Netlify域名

## 更新Edge Function重定向URL

部署完成后，需要更新Edge Function中的重定向URL：

1. 编辑 `supabase/functions/invite-user/index.ts`
2. 将重定向URL更新为您的生产域名：

```typescript
// 将这两行中的URL更新为您的生产域名
redirectTo: redirectTo || 'https://your-domain.supabase.co/set-password'
inviteOptions.redirectTo = 'https://your-domain.supabase.co/set-password';
```

3. 重新部署Edge Function：

```bash
supabase functions deploy invite-user
```

## 验证部署

### 1. 测试Edge Functions

```bash
# 测试邀请功能
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/invite-user \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","organizationId":"your-org-id"}'
```

### 2. 测试前端应用

1. 访问您的生产域名
2. 测试用户注册和登录
3. 测试邀请功能
4. 验证邮件重定向

### 3. 检查日志

在Supabase控制台中查看Edge Function日志：
https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions

## 环境变量配置

确保在生产环境中正确设置以下环境变量：

```bash
# 前端环境变量
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Edge Function环境变量
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 故障排除

### 常见问题

1. **重定向失败**
   - 检查重定向URL是否正确配置
   - 确保域名在Supabase允许列表中

2. **Edge Function部署失败**
   - 检查Supabase CLI版本
   - 确保已正确登录
   - 检查项目引用是否正确

3. **环境变量未加载**
   - 确保在Supabase控制台中正确设置了环境变量
   - 重新部署Edge Functions

4. **CORS错误**
   - 在Supabase控制台中添加您的域名到允许列表
   - 检查Edge Function的CORS配置

### 调试步骤

1. **检查Supabase状态**：
```bash
supabase status
```

2. **查看Edge Function日志**：
```bash
supabase functions logs invite-user
```

3. **测试本地开发**：
```bash
supabase start
```

4. **检查数据库连接**：
```bash
supabase db reset
```

## 生产环境最佳实践

1. **安全性**
   - 使用HTTPS
   - 设置适当的CORS策略
   - 定期轮换密钥

2. **性能**
   - 启用数据库连接池
   - 使用CDN加速静态资源
   - 优化Edge Function代码

3. **监控**
   - 设置错误监控
   - 监控API使用量
   - 设置性能警报

4. **备份**
   - 定期备份数据库
   - 备份Edge Function代码
   - 保存环境变量配置

## 有用的命令

```bash
# 查看项目状态
supabase status

# 启动本地开发环境
supabase start

# 停止本地开发环境
supabase stop

# 查看Edge Function日志
supabase functions logs

# 重置数据库
supabase db reset

# 生成数据库类型
supabase gen types typescript --local > src/types/database.types.ts
```

## 支持

如果遇到问题，可以：

1. 查看Supabase文档：https://supabase.com/docs
2. 访问Supabase社区：https://github.com/supabase/supabase/discussions
3. 联系Supabase支持：https://supabase.com/support 