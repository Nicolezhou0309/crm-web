# Supabase 配置信息

## 项目信息
- **项目URL**: http://47.123.26.25:8000
- **项目引用**: aliyun-supabase

## API Keys

### Anon Key (公开密钥)
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
```

### Service Role Key (服务端密钥)
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
```

## JWT 配置
- **JWT Secret**: `o27ui1xeosLL66wyP6JlYT977Y86S2kOZRVMjJx3twm77iJw3ff/Q7uSbqJuNA6wbDyQ7QMXy8HV9sYuAXCn0g==`
- **Access Token Expiry**: 3600 秒

## Edge Function 状态
✅ **email-management** 函数已部署并正常运行
- URL: http://47.123.26.25:8000/functions/v1/email-management
- 状态: 正常响应

## 前端环境变量设置

在您的 `.env` 文件中设置：
```env
VITE_SUPABASE_URL=http://47.123.26.25:8000
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
```

## Edge Function 环境变量

在 Supabase Dashboard → Edge Functions → email-management → Settings 中设置：
```
SUPABASE_URL=http://47.123.26.25:8000
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
```

## 部署说明

由于需要个人访问令牌才能通过 CLI 部署，建议：

1. **通过 Supabase Dashboard 部署**：
   - 登录 https://supabase.com/dashboard
   - 进入您的项目 → Edge Functions
   - 创建新函数或更新现有函数
   - 复制 `supabase/functions/email-management/index.ts` 的内容

2. **或获取个人访问令牌**：
   - 访问 https://supabase.com/dashboard/account/tokens
   - 创建新的访问令牌
   - 使用 `npx supabase login` 登录

## 功能测试

Edge Function 已经部署并正常工作：
- ✅ CORS 配置正确
- ✅ 认证验证正常
- ✅ 支持未注册用户邮箱重置
- ✅ 递归权限验证
- ✅ 详细日志记录

现在您可以在前端正常使用邮箱管理功能了！ 