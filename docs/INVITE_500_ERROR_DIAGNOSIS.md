# Invite-User 500错误诊断指南

## 🔍 问题描述

前端调用 `invite-user` Edge Function 时返回 500 错误：
```
POST https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/invite-user 500 (Internal Server Error)
```

## 🛠️ 诊断步骤

### 1. 立即检查步骤

#### 📋 检查用户登录状态
1. 确保用户已正确登录
2. 检查浏览器控制台是否有认证错误
3. 验证用户token是否有效

#### 🔐 检查权限设置
1. 确认用户是否有管理组织的权限
2. 检查用户是否为组织管理员
3. 验证组织ID是否正确

#### 📧 检查邮箱地址
1. 确保邮箱地址格式正确
2. 检查邮箱是否已被注册
3. 验证邮箱是否在允许的域名列表中

### 2. 技术修复方案

#### 🔧 重新部署Edge Function
```bash
# 重新部署invite-user函数
supabase functions deploy invite-user
```

#### 🔑 检查环境变量
```bash
# 检查环境变量配置
supabase secrets list
```

确保以下环境变量已正确配置：
- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`

#### 📝 更新函数代码
如果问题持续存在，可能需要更新函数代码：

1. **添加更详细的错误日志**
2. **改进错误处理**
3. **优化权限检查逻辑**

### 3. 调试步骤

#### 🔍 运行诊断脚本
```bash
# 运行详细诊断
node debug_invite_500_error.js
```

#### 📊 检查函数日志
在Supabase控制台中查看函数日志：
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目 `wteqgprgiylmxzszcnws`
3. 点击 "Edge Functions"
4. 查看 `invite-user` 函数的日志

#### 🧪 测试函数调用
使用测试脚本验证函数：
```bash
# 运行简化测试
node test_invite_simple_fix.js
```

### 4. 常见错误及解决方案

#### ❌ 错误：500 Internal Server Error
**可能原因：**
- 环境变量未正确配置
- 函数代码有语法错误
- 数据库连接问题

**解决方案：**
1. 检查环境变量配置
2. 重新部署函数
3. 验证数据库连接

#### ❌ 错误：401 Unauthorized
**可能原因：**
- 用户未登录
- JWT token无效或过期
- Authorization header缺失

**解决方案：**
1. 确保用户已登录
2. 刷新页面重新获取token
3. 检查Authorization header

#### ❌ 错误：403 Forbidden
**可能原因：**
- 用户无权管理该组织
- 组织权限配置问题

**解决方案：**
1. 检查用户是否为组织管理员
2. 验证组织权限设置
3. 确认组织ID正确

### 5. 环境变量检查

#### 🔍 必需的环境变量
```bash
SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
FRONTEND_URL=https://crm-web-ncioles-projects.vercel.app
```

#### 📝 检查环境变量
```bash
# 列出所有环境变量
supabase secrets list

# 设置环境变量（如果需要）
supabase secrets set SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set FRONTEND_URL=https://crm-web-ncioles-projects.vercel.app
```

### 6. 数据库连接检查

#### 🔍 检查数据库表
确保以下表存在且结构正确：
- `organizations` - 组织表
- `users_profile` - 用户档案表
- `auth.users` - 认证用户表

#### 📊 检查权限策略
确保RLS策略正确配置：
```sql
-- 检查organizations表的RLS策略
SELECT * FROM pg_policies WHERE tablename = 'organizations';

-- 检查users_profile表的RLS策略
SELECT * FROM pg_policies WHERE tablename = 'users_profile';
```

### 7. 函数代码优化

#### 🔧 添加详细日志
在函数中添加更多日志输出：
```typescript
console.log('🔍 环境变量检查:', {
  FRONTEND_URL,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
  hasResendKey: !!RESEND_API_KEY
});
```

#### 🛡️ 改进错误处理
```typescript
try {
  // 函数逻辑
} catch (error) {
  console.error('❌ 邀请用户异常:', error);
  return new Response(JSON.stringify({
    error: '邀请用户失败',
    details: error.message
  }), {
    status: 500,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
```

### 8. 测试流程

#### 🧪 完整测试流程
1. **用户登录测试**
   - 确保用户已登录
   - 验证token有效性

2. **权限验证测试**
   - 检查用户是否为组织管理员
   - 验证组织权限

3. **邀请功能测试**
   - 使用测试邮箱发送邀请
   - 验证邮件发送成功

4. **错误处理测试**
   - 测试各种错误情况
   - 验证错误响应

### 9. 监控和维护

#### 📊 监控指标
- 函数调用成功率
- 平均响应时间
- 错误率统计

#### 🔄 定期维护
- 定期检查环境变量
- 更新函数代码
- 监控函数日志

## 🎯 总结

通过以上步骤，您应该能够：
1. 识别500错误的具体原因
2. 修复环境变量配置问题
3. 优化函数代码和错误处理
4. 建立有效的监控和维护流程

如果问题仍然存在，请：
1. 检查Supabase控制台的函数日志
2. 运行诊断脚本获取详细错误信息
3. 联系技术支持获取进一步帮助 