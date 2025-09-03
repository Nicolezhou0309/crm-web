# 🔐 "User not allowed" 权限问题解决方案

## 问题描述

在使用Supabase内置邮件功能时遇到"User not allowed"错误，这是因为尝试使用了需要Admin权限的API，但客户端使用的是`anon_key`而不是`service_role`密钥。

## 根本原因

### 问题API
```typescript
// ❌ 这些API需要service_role权限
await supabase.auth.admin.inviteUserByEmail()
await supabase.auth.admin.updateUserById()
await supabase.auth.admin.getUserById()
```

### 权限限制
- **anon_key**: 只能执行基本的用户操作（注册、登录、修改自己的信息）
- **service_role**: 可以执行管理员操作（管理其他用户、发送邀请邮件等）

## 解决方案

### 1. 邀请用户注册 → 提供注册链接
```typescript
// ❌ 原来的实现（需要Admin权限）
await supabase.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: selectedDept?.id }
});

// ✅ 新的实现（无需特殊权限）
const handleInviteUser = async (email: string) => {
  const { data: existingProfile } = await supabase
    .from('users_profile')
    .select('user_id, status')
    .eq('email', email)
    .single();

  if (existingProfile && existingProfile.user_id) {
    message.info('用户已注册，请使用"发送密码重置"功能');
  } else {
    Modal.confirm({
      title: '邀请新用户',
      content: `请将注册链接发送给用户：${window.location.origin}/login`
    });
  }
};
```

### 2. 密码重置 → 使用基础用户API
```typescript
// ✅ 这个API基础用户可以调用
const handleResetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  message.success('密码重置邮件已发送！');
};
```

### 3. 邮箱重置 → 提供操作指引
```typescript
// ❌ 原来的实现（需要Admin权限）
await supabase.auth.admin.updateUserById(userId, {
  email: newEmail
});

// ✅ 新的实现（提供指引）
const handleChangeEmail = async (userId: string, newEmail: string) => {
  // 检查邮箱唯一性
  const { data: existingUser } = await supabase
    .from('users_profile')
    .select('user_id')
    .eq('email', newEmail)
    .limit(1);
  
  if (existingUser && existingUser.length > 0) {
    message.error('该邮箱已被使用，请选择其他邮箱');
    return;
  }

  // 显示操作指引
  Modal.confirm({
    title: '重置用户邮箱',
    content: (
      <div>
        <p>由于安全限制，管理员无法直接重置其他用户的邮箱。</p>
        <p>建议的操作方式：</p>
        <ol>
          <li>通知用户前往个人资料页面自行修改邮箱</li>
          <li>或者用户可以使用"忘记密码"功能重置账户</li>
          <li>如需强制重置，请联系系统管理员</li>
        </ol>
      </div>
    )
  });
};
```

## UI更新

### 菜单项重命名
- "邀请用户/重发验证" → "邀请用户注册"
- "重置邮箱" → "邮箱重置指引"
- "发送密码重置" → 保持不变

### 弹窗更新
- 重置邮箱弹窗标题：从"重置用户邮箱"改为"邮箱重置指引"
- 按钮文本：从"重置"改为"查看指引"
- 输入框标签：从"新邮箱地址"改为"目标邮箱地址"

## 优势

### 1. 安全性
- 遵循Supabase的安全模型
- 避免在前端暴露service_role密钥
- 让用户自行管理敏感信息

### 2. 用户体验
- 提供清晰的操作指引
- 避免权限错误导致的困惑
- 引导用户使用正确的流程

### 3. 维护性
- 无需管理复杂的权限配置
- 减少了对Admin API的依赖
- 代码更简洁易懂

## 替代方案

如果确实需要Admin功能，可以考虑：

### 1. 使用Edge Function
```typescript
// 在Edge Function中使用service_role
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

await supabaseAdmin.auth.admin.inviteUserByEmail(email);
```

### 2. 后端API
- 创建专门的后端服务
- 使用service_role密钥
- 提供RESTful API供前端调用

### 3. RLS策略
- 配置Row Level Security
- 允许特定角色执行管理操作
- 需要复杂的权限管理

## 总结

通过避免使用需要Admin权限的API，我们成功解决了"User not allowed"的问题。虽然功能有所调整，但提供了更安全、更符合最佳实践的解决方案。

用户现在可以：
- 获取新用户的注册链接
- 为已注册用户发送密码重置邮件
- 获取邮箱重置的操作指引

这种方式既保证了安全性，又提供了良好的用户体验。 