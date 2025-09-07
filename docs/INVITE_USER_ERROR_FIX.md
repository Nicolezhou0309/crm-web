# Invite-User 函数错误修复指南

## 🔍 问题描述

前端调用 `invite-user` Edge Function 时返回 500 错误：
```
POST https://lead-service.vld.com.cn/supabase/functions/v1/invite-user 500 (Internal Server Error)
```

## 🛠️ 解决方案

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
node debug_invite_error.js
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
node test_invite_simple.js
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
3. 查看函数日志获取详细错误信息

#### ❌ 错误：401 Unauthorized
**可能原因：**
- 用户未登录
- Token已过期
- Authorization header缺失

**解决方案：**
1. 确保用户已登录
2. 刷新页面重新获取token
3. 检查Authorization header

#### ❌ 错误：403 Forbidden
**可能原因：**
- 用户没有管理权限
- 组织ID不正确
- 权限检查失败

**解决方案：**
1. 检查用户是否为组织管理员
2. 验证组织ID
3. 确认权限设置

#### ❌ 错误：409 Conflict
**可能原因：**
- 邮箱已被注册
- 用户已存在

**解决方案：**
1. 使用不同的邮箱地址
2. 检查用户是否已存在
3. 使用密码重置功能

### 5. 预防措施

#### 🔒 权限管理
1. 定期检查用户权限
2. 确保管理员设置正确
3. 验证组织层级结构

#### 📧 邮件服务
1. 监控Resend API状态
2. 检查邮件发送成功率
3. 验证邮箱地址有效性

#### 🔄 系统监控
1. 监控函数调用频率
2. 检查错误率
3. 设置告警机制

### 6. 备用方案

#### 📱 手动邀请
如果自动邀请功能暂时不可用：
1. 手动创建用户账户
2. 发送邀请链接
3. 使用其他通讯方式

#### 🔗 直接链接
提供直接的注册链接：
1. 生成邀请链接
2. 通过其他方式分享
3. 指导用户注册

### 7. 联系支持

如果问题持续存在：
1. 收集错误日志
2. 记录复现步骤
3. 联系技术支持

## 📋 检查清单

### ✅ 已完成
- [x] 重新部署invite-user函数
- [x] 检查环境变量配置
- [x] 创建诊断脚本
- [x] 更新错误处理

### 🔄 需要检查
- [ ] 用户登录状态
- [ ] 权限设置
- [ ] 邮箱地址格式
- [ ] 组织ID正确性
- [ ] 函数日志详情

### 📝 下一步行动
1. **运行诊断脚本** - 获取详细错误信息
2. **检查函数日志** - 查看服务器端错误
3. **测试权限设置** - 验证用户权限
4. **更新前端代码** - 改进错误处理

## 🎯 预期结果

### 成功情况
- 邀请邮件发送成功
- 用户收到注册邀请
- 前端显示成功消息
- 无错误日志

### 失败情况
- 显示具体错误信息
- 提供解决建议
- 记录错误日志
- 启用备用方案

## 📚 相关资源

- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [Resend API 文档](https://resend.com/docs)
- [Supabase 认证文档](https://supabase.com/docs/guides/auth)
- [错误处理最佳实践](https://supabase.com/docs/guides/functions/troubleshooting) 