# 邀请注册解决方案

## 🎯 解决的问题

### 问题1：字段名称不一致
- **登录/注册时**：使用 `name` 字段 (`auth.users.raw_user_meta_data.name`)
- **邀请时**：使用 `nickname` 字段 (`users_profile.nickname`)
- **需要统一**：确保数据一致性

### 问题2：组织关联问题
- **邀请时**：需要确保 `organization_id` 正确传递和关联
- **注册时**：需要将 `organization_id` 从 `auth.users` 同步到 `users_profile`

### 问题3：密码设置问题
- **Supabase邀请流程**：用户收到邀请邮件后自己设置密码，不是系统预设密码

## 🛠️ 解决方案

### 1. 统一字段名称

#### 1.1 前端修改
- ✅ 修改 `DepartmentPage.tsx` 中的 `handleInviteUser` 函数
- ✅ 统一使用 `name` 字段而非 `nickname`

#### 1.2 Edge Function修改
- ✅ 修改 `supabase/functions/invite-user/index.ts`
- ✅ 接收 `name` 字段并正确传递到 `auth.users.raw_user_meta_data`

### 2. 数据同步机制

#### 2.1 创建同步触发器
创建了 `user_registration_sync.sql` 文件，包含：

```sql
-- 主要功能：
1. 监听 auth.users 表的 email_confirmed_at 字段变化
2. 用户首次确认邮箱时，同步数据到 users_profile
3. 同步字段：name -> nickname, organization_id -> organization_id
```

#### 2.2 数据流向
```
邀请流程：
1. 管理员发起邀请 → 前端传递 {email, name, organizationId}
2. Edge Function 接收 → 创建 users_profile 记录 (status: 'invited')
3. 发送邀请邮件 → metadata 包含 {name, organization_id}

注册流程：
1. 用户收到邮件点击链接 → 跳转到设置密码页面
2. 用户设置密码完成注册 → auth.users.email_confirmed_at 更新
3. 触发器执行 → 同步数据到 users_profile
4. 状态更新：invited → active
```

### 3. 密码设置机制

#### 3.1 Supabase标准流程
```
1. 管理员发送邀请邮件
   ├─ 使用 adminClient.auth.admin.inviteUserByEmail()
   ├─ 用户收到邮件，包含安全链接
   └─ 邮件中包含 CTA："设置密码并激活账户"

2. 用户点击邮件链接
   ├─ 跳转到应用的注册/设置密码页面
   ├─ 用户输入密码完成注册
   └─ 系统自动登录用户

3. 注册完成
   ├─ auth.users 创建用户记录
   ├─ email_confirmed_at 设置为当前时间
   └─ 触发器同步数据到 users_profile
```

#### 3.2 安全保证
- ✅ 邀请链接有时效性（通常24小时）
- ✅ 只有收到邮件的用户才能设置密码
- ✅ 每个邮箱只能被邀请一次
- ✅ 密码由用户自己设置，管理员无法获取

## 📊 数据同步触发器详解

### 触发器功能
```sql
-- 监听条件：email_confirmed_at 从 NULL 变为 非NULL
IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
  -- 更新现有记录
  UPDATE users_profile SET
    nickname = COALESCE(NEW.raw_user_meta_data->>'name', nickname),
    user_id = NEW.id,
    organization_id = COALESCE(
      (NEW.raw_user_meta_data->>'organization_id')::uuid, 
      organization_id
    ),
    status = 'active'
  WHERE email = NEW.email;
  
  -- 如果没有记录，创建新记录
  IF NOT FOUND THEN
    INSERT INTO users_profile (...)
  END IF;
END IF;
```

### 手动同步函数
```sql
-- 用于同步现有用户数据
SELECT manual_sync_user_metadata();

-- 用于检查用户状态
SELECT * FROM check_user_registration_status('user@example.com');
```

## 🔧 部署步骤

### 1. 数据库更新
```sql
-- 执行同步触发器
\i user_registration_sync.sql

-- 可选：同步现有用户数据
SELECT manual_sync_user_metadata();
```

### 2. Edge Function部署
```bash
# 重新部署邀请函数
supabase functions deploy invite-user --no-verify-jwt
```

### 3. 前端无需额外部署
- 字段统一已完成
- 无需修改用户界面

## 📝 使用说明

### 管理员邀请用户
1. 在部门管理页面点击"邀请成员"
2. 输入邮箱和姓名
3. 系统发送邀请邮件

### 用户注册流程
1. 用户收到邮件："您被邀请加入XXX部门"
2. 点击邮件中的"设置密码"链接
3. 跳转到设置密码页面
4. 用户设置密码完成注册
5. 系统自动登录，用户进入系统

### 数据一致性保证
- ✅ 邀请时创建 users_profile 记录 (status: 'invited')
- ✅ 注册时同步 auth.users 数据到 users_profile
- ✅ 状态自动更新为 'active'
- ✅ 组织关联正确设置

## 🔍 故障排除

### 检查用户状态
```sql
SELECT * FROM check_user_registration_status('user@example.com');
```

### 手动同步数据
```sql
SELECT manual_sync_user_metadata();
```

### 常见问题
1. **用户注册了但没有部门**
   - 检查邀请时是否传递了 organization_id
   - 检查触发器是否正确同步

2. **用户显示名称不正确**
   - 检查邀请时传递的 name 字段
   - 确认触发器正确同步了 name 到 nickname

3. **邀请邮件没有收到**
   - 检查邮箱地址是否正确
   - 检查垃圾邮件文件夹
   - 确认 Supabase 邮件服务配置正确

## 🎉 完成状态

- ✅ 字段名称统一：name ↔ nickname
- ✅ 组织关联同步：organization_id 正确传递
- ✅ 数据同步触发器：自动同步用户数据
- ✅ 密码设置机制：用户自己设置密码，安全可靠
- ✅ 完整的邀请-注册-激活流程

现在系统具有完整的邀请注册功能，数据一致性得到保证，用户体验良好。 