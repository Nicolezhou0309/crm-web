# 🔄 企业微信登录流程修改指南

## 🎯 修改目标

将企业微信登录流程从直接操作 `users_profile` 表改为：
1. **先创建** `auth.users` 记录
2. **利用触发器** 自动同步到 `users_profile` 表

## 📋 修改内容概览

### 1. 更新同步函数 (`create_profile_sync_function.sql`)
- ✅ 支持企业微信用户信息同步
- ✅ 添加企业微信相关字段处理
- ✅ 优化用户查找逻辑（优先通过企业微信ID）
- ✅ 新增企业微信用户专用同步函数

### 2. 修改企业微信登录服务 (`wecomAuthService.js`)
- ✅ 调用方式从 `createOrUpdateWecomUserProfile` 改为 `createWecomAuthUser`
- ✅ 登录流程：企业微信 → `auth.users` → 触发器 → `users_profile`

### 3. 更新Supabase服务 (`supabaseService.js`)
- ✅ 新增 `createWecomAuthUser` 方法
- ✅ 保留原有方法作为备用
- ✅ 支持企业微信用户元数据管理

## 🚀 部署步骤

### 步骤1：执行同步函数SQL脚本
在 Supabase SQL 编辑器中执行：
```sql
-- 复制并执行 sql-scripts/setup/create_profile_sync_function.sql 的全部内容
```

### 步骤2：验证函数部署
```sql
-- 检查同步函数是否存在
SELECT proname, prosrc FROM pg_proc WHERE proname IN (
  'sync_user_profile_on_auth_insert',
  'sync_user_profile_on_email_confirmed',
  'sync_user_profile_on_metadata_update',
  'manual_sync_all_users_profile',
  'check_profile_sync_status',
  'sync_wechat_work_users'
);

-- 检查触发器是否创建成功
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'sync_profile_%';
```

### 步骤3：测试企业微信用户同步
```sql
-- 同步现有企业微信用户到 auth.users 表
SELECT sync_wechat_work_users();

-- 检查同步状态
SELECT * FROM check_profile_sync_status();
```

## 🚨 常见错误及解决方案

### 错误1：函数返回类型冲突
```
ERROR: 42P13: cannot change return type of existing function
DETAIL: Row type defined by OUT parameters is different.
HINT: Use DROP FUNCTION check_profile_sync_status(text) first.
```

**解决方案**：
1. 先执行修复脚本 `fix-wecom-auth-sync-error.sql`
2. 或者手动删除旧函数：
```sql
-- 删除旧函数和触发器
DROP TRIGGER IF EXISTS sync_profile_on_auth_insert ON auth.users;
DROP TRIGGER IF EXISTS sync_profile_on_email_confirmed ON auth.users;
DROP TRIGGER IF EXISTS sync_profile_on_metadata_update ON auth.users;

DROP FUNCTION IF EXISTS public.sync_user_profile_on_auth_insert() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_profile_on_email_confirmed() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_profile_on_metadata_update() CASCADE;
DROP FUNCTION IF EXISTS public.manual_sync_all_users_profile() CASCADE;
DROP FUNCTION IF EXISTS public.check_profile_sync_status(text) CASCADE;
DROP FUNCTION IF EXISTS public.sync_wechat_work_users() CASCADE;
```

3. 然后重新执行完整的 `create_profile_sync_function.sql`

### 错误2：权限不足
```
ERROR: permission denied for table auth.users
```

**解决方案**：
- 确保使用 `service_role` 密钥执行SQL脚本
- 检查数据库用户权限设置

### 错误3：触发器创建失败
```
ERROR: trigger "sync_profile_on_auth_insert" for relation "auth.users" already exists
```

**解决方案**：
- 脚本中已包含 `DROP TRIGGER IF EXISTS` 语句
- 如果仍有问题，手动删除触发器后重新执行

## 🔧 技术实现细节

### 1. 数据流向
```
企业微信登录 → 获取用户信息 → 创建 auth.users 记录 → 触发器自动执行 → 同步到 users_profile 表
```

### 2. 关键字段映射
| 企业微信字段 | auth.users 元数据 | users_profile 字段 |
|-------------|------------------|-------------------|
| UserId | wechat_work_userid | wechat_work_userid |
| name | name, wechat_work_name | wechat_work_name |
| mobile | wechat_work_mobile | wechat_work_mobile |
| avatar | wechat_work_avatar | wechat_work_avatar |
| department | wechat_work_department | wechat_work_department |
| position | wechat_work_position | wechat_work_position |
| corpId | wechat_work_corpid | wechat_work_corpid |

### 3. 用户状态管理
- **企业微信用户**：默认 `email_confirmed_at` 已设置，状态为 `active`
- **标准用户**：需要邮箱确认，状态从 `pending` 到 `active`

## 📊 同步函数功能说明

### 1. `sync_user_profile_on_auth_insert()`
- **触发时机**：`auth.users` 插入新记录时
- **功能**：自动创建或更新 `users_profile` 记录
- **企业微信支持**：优先通过企业微信ID查找，其次通过邮箱

### 2. `sync_user_profile_on_email_confirmed()`
- **触发时机**：`auth.users.email_confirmed_at` 更新时
- **功能**：用户确认邮箱后，更新 `users_profile` 状态为 'active'
- **企业微信支持**：同步企业微信相关信息

### 3. `sync_user_profile_on_metadata_update()`
- **触发时机**：`auth.users` 元数据更新时
- **功能**：同步用户名称、组织ID、企业微信信息等到 `users_profile`

### 4. `sync_wechat_work_users()`
- **用途**：手动同步现有企业微信用户到 `auth.users` 表
- **适用场景**：部署后同步历史数据

## 🧪 测试验证

### 1. 企业微信登录测试
```bash
# 访问企业微信登录页面
curl http://your-domain/auth/wecom/test

# 完成扫码登录流程
# 检查数据库记录
```

### 2. 数据同步验证
```sql
-- 检查企业微信用户是否在 auth.users 表中
SELECT id, email, raw_user_meta_data->>'wechat_work_userid' as wechat_id
FROM auth.users 
WHERE raw_user_meta_data->>'wechat_work_userid' IS NOT NULL;

-- 检查 users_profile 表同步状态
SELECT up.*, au.email as auth_email
FROM users_profile up
LEFT JOIN auth.users au ON up.user_id = au.id
WHERE up.wechat_work_userid IS NOT NULL;
```

### 3. 触发器验证
```sql
-- 手动插入测试用户，观察触发器执行
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@wecom.local',
  '',
  NOW(),
  NOW(),
  NOW(),
  '{"name": "测试用户", "wechat_work_userid": "test_001", "wechat_work_name": "测试用户"}'
);
```

## 🚨 注意事项

### 1. 权限要求
- 执行SQL脚本需要 `service_role` 密钥
- 确保有足够的数据库权限创建函数和触发器

### 2. 数据一致性
- 企业微信用户优先通过 `wechat_work_userid` 关联
- 邮箱作为备用关联字段
- 避免重复创建用户记录

### 3. 回滚方案
如果遇到问题，可以：
```sql
-- 删除触发器
DROP TRIGGER IF EXISTS sync_profile_on_auth_insert ON auth.users;
DROP TRIGGER IF EXISTS sync_profile_on_email_confirmed ON auth.users;
DROP TRIGGER IF EXISTS sync_profile_on_metadata_update ON auth.users;

-- 删除函数
DROP FUNCTION IF EXISTS public.sync_user_profile_on_auth_insert();
DROP FUNCTION IF EXISTS public.sync_user_profile_on_email_confirmed();
DROP FUNCTION IF EXISTS public.sync_user_profile_on_metadata_update();
DROP FUNCTION IF EXISTS public.sync_wechat_work_users();
```

## 📈 性能优化

### 1. 索引建议
```sql
-- 为企业微信相关字段添加索引
CREATE INDEX IF NOT EXISTS idx_users_profile_wechat_work_userid ON users_profile(wechat_work_userid);
CREATE INDEX IF NOT EXISTS idx_auth_users_wechat_work_userid ON auth.users USING GIN ((raw_user_meta_data->>'wechat_work_userid'));
```

### 2. 批量同步
对于大量企业微信用户，可以使用批量同步：
```sql
-- 分批同步用户
SELECT sync_wechat_work_users_batch(100); -- 每次同步100个用户
```

## 🎉 完成状态

- ✅ 同步函数更新完成
- ✅ 企业微信登录服务修改完成
- ✅ Supabase服务更新完成
- ✅ 部署脚本创建完成
- ✅ 错误修复脚本创建完成
- ✅ 文档说明完成

## 📞 技术支持

如果遇到问题，请检查：
1. SQL脚本执行是否成功
2. 函数和触发器是否创建成功
3. 权限设置是否正确
4. 企业微信配置是否有效

### 快速修复命令
```bash
# 如果遇到函数类型冲突，执行修复脚本
./deploy-wecom-auth-sync-simple.sh

# 或者手动执行修复SQL
# 在 Supabase SQL 编辑器中执行 fix-wecom-auth-sync-error.sql
```

---

**更新时间**: 2025年1月
**版本**: 1.1.0
**状态**: 已完成（包含错误修复）
