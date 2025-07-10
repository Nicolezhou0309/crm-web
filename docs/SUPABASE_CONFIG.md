# Supabase 配置信息

## 项目信息
- **项目URL**: https://wteqgprgiylmxzszcnws.supabase.co
- **项目引用**: wteqgprgiylmxzszcnws

## API Keys

### Anon Key (公开密钥)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI
```

### Service Role Key (服务端密钥)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTE3Nzk4MSwiZXhwIjoyMDY2NzUzOTgxfQ.Mm3-pQUxKFvrQ96K_R8uxaLPjm3iPrrTlB2oVXli1Mc
```

## JWT 配置
- **JWT Secret**: `o27ui1xeosLL66wyP6JlYT977Y86S2kOZRVMjJx3twm77iJw3ff/Q7uSbqJuNA6wbDyQ7QMXy8HV9sYuAXCn0g==`
- **Access Token Expiry**: 3600 秒

## Edge Function 状态
✅ **email-management** 函数已部署并正常运行
- URL: https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/email-management
- 状态: 正常响应

## 前端环境变量设置

在您的 `.env` 文件中设置：
```env
VITE_SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI
```

## Edge Function 环境变量

在 Supabase Dashboard → Edge Functions → email-management → Settings 中设置：
```
SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTE3Nzk4MSwiZXhwIjoyMDY2NzUzOTgxfQ.Mm3-pQUxKFvrQ96K_R8uxaLPjm3iPrrTlB2oVXli1Mc
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