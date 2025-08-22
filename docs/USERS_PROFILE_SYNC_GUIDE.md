# users_profile 表联动逻辑使用指南

## 🎯 功能概述

创建了专门的函数来处理 `users_profile` 表的联动逻辑，确保在 `auth.users` 添加记录后自动调用，所有注册入口都能统一复用。

## 📋 核心功能

### 1. 自动同步机制
- **用户创建时同步**: 当 `auth.users` 插入新记录时，自动创建或更新 `users_profile`
- **邮箱确认时同步**: 当用户确认邮箱时，自动更新 `users_profile` 状态
- **元数据更新时同步**: 当用户元数据变化时，自动同步到 `users_profile`

### 2. 统一的数据流
```
注册入口 → auth.users → 触发器 → users_profile
```

## 🛠️ 部署步骤

### 步骤1：执行SQL脚本
在 Supabase SQL 编辑器中执行：

```sql
-- 执行联动逻辑脚本
\i sql-scripts/setup/create_profile_sync_function.sql
```

### 步骤2：验证部署
```sql
-- 检查函数是否创建成功
SELECT * FROM check_profile_sync_status();

-- 手动同步现有数据（可选）
SELECT manual_sync_all_users_profile();
```

### 步骤3：测试功能
```sql
-- 检查特定用户的同步状态
SELECT * FROM check_profile_sync_status('user@example.com');
```

## 🔧 函数详解

### 1. 主要同步函数

#### `sync_user_profile_on_auth_insert()`
- **触发时机**: `auth.users` 插入新记录时
- **功能**: 自动创建或更新 `users_profile` 记录
- **关联逻辑**: 通过 `email` 字段关联，自动设置 `user_id`

#### `sync_user_profile_on_email_confirmed()`
- **触发时机**: `auth.users.email_confirmed_at` 更新时
- **功能**: 用户确认邮箱后，更新 `users_profile` 状态为 'active'
- **状态变化**: `pending` → `active`

#### `sync_user_profile_on_metadata_update()`
- **触发时机**: `auth.users` 元数据更新时
- **功能**: 同步用户名称、组织ID等信息到 `users_profile`

### 2. 辅助函数

#### `manual_sync_all_users_profile()`
- **用途**: 手动同步所有现有用户数据
- **适用场景**: 部署后同步历史数据

#### `check_profile_sync_status(user_email)`
- **用途**: 检查用户同步状态
- **返回信息**: auth用户信息、profile信息、同步状态

## 📊 数据同步逻辑

### 字段映射
| auth.users 字段 | users_profile 字段 | 说明 |
|----------------|-------------------|------|
| `id` | `user_id` | 用户唯一标识 |
| `email` | `email` | 邮箱地址 |
| `raw_user_meta_data.name` | `nickname` | 用户昵称 |
| `raw_user_meta_data.organization_id` | `organization_id` | 组织ID |
| `email_confirmed_at` | `status` | 用户状态 |

### 状态转换
```sql
-- 状态判断逻辑
CASE 
    WHEN banned_until IS NOT NULL AND banned_until > NOW() THEN 'banned'
    WHEN deleted_at IS NOT NULL THEN 'deleted'
    WHEN email_confirmed_at IS NOT NULL THEN 'active'
    ELSE 'pending'
END
```

## 🔍 触发器配置

### 已创建的触发器
1. **sync_profile_on_auth_insert**: 用户创建时触发
2. **sync_profile_on_email_confirmed**: 邮箱确认时触发
3. **sync_profile_on_metadata_update**: 元数据更新时触发

### 触发器执行顺序
```
用户注册 → auth.users INSERT → sync_profile_on_auth_insert
用户确认邮箱 → auth.users UPDATE → sync_profile_on_email_confirmed
用户更新信息 → auth.users UPDATE → sync_profile_on_metadata_update
```

## 🚀 使用场景

### 场景1：邀请注册流程
1. 管理员邀请用户 → 创建 `users_profile` (status: 'pending')
2. 用户收到邮件 → 点击链接设置密码
3. 用户完成注册 → `auth.users` 创建记录
4. 触发器自动执行 → 更新 `users_profile` (user_id, status: 'active')

### 场景2：直接注册流程
1. 用户直接注册 → `auth.users` 创建记录
2. 触发器自动执行 → 创建 `users_profile` 记录
3. 用户确认邮箱 → 更新状态为 'active'

### 场景3：第三方登录
1. 用户通过第三方登录 → `auth.users` 创建记录
2. 触发器自动执行 → 创建或更新 `users_profile`

## 🔧 故障排除

### 问题1：同步失败
```sql
-- 检查触发器状态
SELECT * FROM check_profile_sync_status();

-- 手动同步
SELECT manual_sync_all_users_profile();
```

### 问题2：数据不一致
```sql
-- 查找未关联的记录
SELECT * FROM check_profile_sync_status() 
WHERE sync_status != 'synced';
```

### 问题3：触发器未执行
```sql
-- 检查触发器是否存在
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE 'sync_profile%';
```

## 📝 最佳实践

### 1. 部署前准备
- 备份现有数据
- 在测试环境验证
- 准备回滚方案

### 2. 部署后验证
- 检查函数创建状态
- 验证触发器配置
- 测试同步功能

### 3. 监控和维护
- 定期检查同步状态
- 监控错误日志
- 及时处理异常

## 🎉 优势总结

### ✅ 统一性
- 所有注册入口使用相同的同步逻辑
- 避免代码重复和维护困难

### ✅ 自动化
- 无需手动管理 `user_id` 关联
- 自动处理各种注册场景

### ✅ 可靠性
- 数据库级别的同步保证
- 事务性操作，数据一致性

### ✅ 可扩展性
- 易于添加新的同步规则
- 支持复杂的业务逻辑

---

**更新时间**: 2024年1月
**版本**: v1.0.0
**状态**: ✅ 已部署并测试 