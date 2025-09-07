# 邀请功能日志查看指南

## 🔍 问题描述

邀请用户时出现错误：`Edge Function returned a non-2xx status code`

## 📊 日志增强

已为 `invite-user` 函数添加了详细的日志输出，包括：

### 1. 函数执行日志
- ✅ 函数开始执行时间
- ✅ 请求URL和方法
- ✅ 环境变量检查
- ✅ 请求参数验证

### 2. 权限检查日志
- ✅ 用户身份验证
- ✅ 组织权限验证
- ✅ 权限检查结果

### 3. 数据库操作日志
- ✅ 组织信息查询
- ✅ 用户档案检查
- ✅ 数据库操作结果

### 4. 邮件发送日志
- ✅ Supabase邀请配置
- ✅ Resend邮件配置
- ✅ 邮件发送状态
- ✅ API响应详情

### 5. 错误处理日志
- ✅ 详细错误信息
- ✅ 错误堆栈跟踪
- ✅ 错误分类分析

## 🛠️ 查看日志的方法

### 方法1：Supabase控制台（推荐）

1. **访问Supabase控制台**
   - 登录 [Supabase Dashboard](https://supabase.com/dashboard)
   - 进入项目 `wteqgprgiylmxzszcnws`

2. **查看Edge Functions日志**
   - 点击左侧菜单 "Edge Functions"
   - 找到 `invite-user` 函数
   - 点击 "Logs" 标签页

3. **实时监控日志**
   - 日志会实时更新
   - 可以看到详细的执行过程
   - 包含所有错误信息

### 方法2：使用测试脚本

运行测试脚本查看详细日志：

```bash
node test_invite_with_logs.js
```

### 方法3：直接调用函数

使用curl命令直接调用函数：

```bash
curl -X POST http://47.123.26.25:8000/functions/v1/invite-user \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","organizationId":"your-org-id"}'
```

## 📋 日志分析步骤

### 1. 检查函数启动日志
```
🚀 ===== 邀请用户函数开始执行 =====
📅 执行时间: 2024-01-20T10:30:00.000Z
🌐 请求URL: http://47.123.26.25:8000/functions/v1/invite-user
📋 请求方法: POST
```

### 2. 检查环境变量
```
🔍 环境变量检查: {
  FRONTEND_URL: "https://crm-web-ncioles-projects.vercel.app",
  hasSupabaseUrl: true,
  hasAnonKey: true,
  hasServiceKey: true,
  hasResendKey: true
}
```

### 3. 检查请求参数
```
📋 请求体: {
  email: "test@example.com",
  name: "Test User",
  organizationId: "org-id"
}
✅ 请求参数验证通过
```

### 4. 检查用户认证
```
🔍 用户验证结果: {
  user: "user-id",
  email: "user@example.com",
  error: null
}
✅ 用户已授权
```

### 5. 检查权限验证
```
🔍 开始检查权限: { orgId: "org-id", userId: "user-id" }
✅ 组织信息: { id: "org-id", admin: "user-id", name: "组织名称" }
✅ 用户是直接管理员
🔍 权限检查结果: true
```

### 6. 检查邮件发送
```
📧 开始发送Supabase邀请邮件...
🔧 Supabase邀请配置: {
  hasSupabaseUrl: true,
  hasServiceKey: true,
  frontendUrl: "https://crm-web-ncioles-projects.vercel.app"
}
✅ Supabase邀请成功
```

## 🚨 常见错误分析

### 500错误 - 内部服务器错误
```
❌ 邀请用户异常: Error: 错误信息
❌ 错误堆栈: Error stack trace
```

**可能原因：**
- 环境变量配置错误
- 数据库连接失败
- 权限检查异常
- 邮件发送失败

### 401错误 - 未授权
```
❌ 用户未授权: 错误信息
```

**可能原因：**
- 用户未登录
- JWT token过期
- Authorization header缺失

### 403错误 - 禁止访问
```
❌ 无权管理此组织
```

**可能原因：**
- 用户不是组织管理员
- 组织权限配置错误

### 400错误 - 请求错误
```
❌ 缺少邮箱地址
❌ 缺少部门ID
```

**可能原因：**
- 请求参数不完整
- 参数格式错误

## 🔧 故障排除步骤

### 1. 立即检查
1. **查看Supabase控制台日志**
2. **运行测试脚本**
3. **检查环境变量配置**

### 2. 环境变量检查
```bash
supabase secrets list
```

确保以下变量已配置：
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

### 3. 重新部署函数
```bash
supabase functions deploy invite-user
```

### 4. 测试函数
```bash
node test_invite_with_logs.js
```

## 📞 获取帮助

如果问题仍然存在：

1. **收集日志信息**
   - 复制Supabase控制台的完整日志
   - 记录错误发生的时间
   - 保存测试脚本的输出

2. **检查配置**
   - 验证环境变量设置
   - 确认用户权限
   - 检查组织配置

3. **联系支持**
   - 提供详细的错误日志
   - 说明复现步骤
   - 附上相关配置信息

## 🎯 预期结果

成功执行后应该看到：

```
✅ 邀请成功: {
  success: true,
  method: "supabase_invite",
  data: {
    email_id: "email-id",
    invite_sent_at: "2024-01-20T10:30:00.000Z",
    redirect_url: "https://crm-web-ncioles-projects.vercel.app/set-password"
  }
}
```

---

**更新时间**: 2024年1月
**版本**: v2.0.0
**状态**: ✅ 已增强日志功能 