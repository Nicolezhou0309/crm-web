# 快速部署到Supabase

## 🚀 一键部署

运行以下命令即可完成部署：

```bash
./quick-deploy-supabase.sh
```

## 📋 部署前准备

1. **安装Supabase CLI**：
```bash
curl -fsSL https://supabase.com/install.sh | sh
```

2. **登录Supabase**：
```bash
supabase login
```

## 🔧 手动部署步骤

如果自动脚本不工作，可以手动执行以下步骤：

### 1. 构建项目
```bash
npm run build
```

### 2. 链接到Supabase项目
```bash
supabase link --project-ref wteqgprgiylmxzszcnws
```

### 3. 部署Edge Functions
```bash
supabase functions deploy invite-user
supabase functions deploy check-department-admin
supabase functions deploy email-management
supabase functions deploy manage-department-admins
supabase functions deploy role-permission-management
```

## ⚙️ 配置重定向URL

在Supabase控制台中配置重定向URL：

1. 访问：https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/auth/url-configuration
2. 在"Redirect URLs"中添加：
   - `https://wteqgprgiylmxzszcnws.supabase.co/set-password`

## 🧪 测试部署

### 测试Edge Function
```bash
curl -X POST https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/invite-user \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","organizationId":"your-org-id"}'
```

### 测试邀请链接
访问：`https://wteqgprgiylmxzszcnws.supabase.co/set-password?token=test-token`

## 🔗 有用的链接

- **Supabase控制台**: https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws
- **Edge Functions**: https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/functions
- **数据库**: https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/editor
- **认证设置**: https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/auth/url-configuration

## 🐛 故障排除

### 常见问题

1. **Supabase CLI未安装**
   ```bash
   curl -fsSL https://supabase.com/install.sh | sh
   ```

2. **未登录Supabase**
   ```bash
   supabase login
   ```

3. **重定向失败**
   - 检查重定向URL是否正确配置
   - 确保域名在Supabase允许列表中

4. **Edge Function部署失败**
   - 检查项目引用是否正确
   - 确保已正确登录

## 📧 重定向URL配置

当前配置的重定向URL：
- `https://wteqgprgiylmxzszcnws.supabase.co/set-password`

如果需要使用自定义域名，请更新Edge Function中的重定向URL并重新部署。 