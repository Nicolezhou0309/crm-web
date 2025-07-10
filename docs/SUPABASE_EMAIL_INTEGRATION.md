# 📧 Supabase内置邮件功能集成

## 概述

已将原来的Edge Function邮件管理功能替换为Supabase内置的邮件发送机制，简化了实现并提高了可靠性。

## 功能对比

### 原Edge Function方式
- ❌ 复杂的JWT验证和权限校验
- ❌ 邮箱地址格式问题（换行符等）
- ❌ 需要手动部署和维护Edge Function
- ❌ 复杂的错误处理和日志记录

### 新Supabase内置方式
- ✅ 直接使用Supabase Auth API
- ✅ 自动处理邮箱格式和验证
- ✅ 无需额外部署，开箱即用
- ✅ 简化的错误处理

## 实现的功能

### 1. 邀请用户注册
```typescript
const handleInviteUser = async (email: string) => {
  // 检查用户是否已存在
  const { data: existingProfile } = await supabase
    .from('users_profile')
    .select('user_id, status')
    .eq('email', email)
    .single();

  if (existingProfile && existingProfile.user_id) {
    // 已注册用户，提示使用密码重置功能
    message.info('用户已注册，请使用"发送密码重置"功能来发送邮件');
  } else {
    // 未注册用户，显示注册链接
    Modal.confirm({
      title: '邀请新用户',
      content: `请将注册链接发送给用户：${window.location.origin}/login`
    });
  }
};
```

**功能说明：**
- 检查用户是否已在系统中
- 对于未注册用户，提供注册链接
- 对于已注册用户，引导使用密码重置功能
- 避免了需要Admin权限的问题

### 2. 发送密码重置邮件
```typescript
const handleResetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  // 处理结果...
};
```

**功能说明：**
- 使用 `supabase.auth.resetPasswordForEmail()`
- 发送密码重置链接
- 自定义重定向URL
- 适用于所有已注册用户

### 3. 邮箱重置指引
```typescript
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

  // 显示重置指引
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

**功能说明：**
- 检查目标邮箱是否已被使用
- 提供邮箱重置的操作指引
- 由于安全限制，不能直接重置其他用户邮箱
- 引导用户自行修改或联系管理员

## UI更新

### 邮箱管理下拉菜单
```typescript
items: [
  {
    key: 'send-verification',
    label: '邀请用户/重发验证',
    onClick: () => handleInviteUser(record.email)
  },
  {
    key: 'send-password-reset',
    label: '发送密码重置',
    onClick: () => handleResetPassword(record.email)
  },
  {
    key: 'reset-email',
    label: '重置邮箱',
    onClick: () => {
      if (record.user_id) {
        // 打开重置邮箱弹窗
      } else {
        message.error('用户未注册，无法重置邮箱');
      }
    }
  }
]
```

### 用户状态处理
- **未注册用户**：提供注册链接，引导用户自行注册
- **已注册用户**：支持密码重置，邮箱重置需要用户自行操作
- **权限限制**：普通用户只能修改自己的信息，管理员提供操作指引

## 优势

1. **避免权限问题**：不使用需要Admin权限的API
2. **安全性更高**：遵循Supabase的安全模型
3. **用户体验友好**：提供清晰的操作指引
4. **维护简单**：无需复杂的权限管理
5. **符合最佳实践**：让用户自行管理敏感信息

## 注意事项

1. **SMTP配置**：确保Supabase项目已正确配置SMTP服务
2. **邮件模板**：可在Supabase Dashboard中自定义邮件模板
3. **权限管理**：Admin API需要service_role权限
4. **错误处理**：建议添加适当的错误提示和重试机制

## 测试建议

1. 测试邀请新用户
2. 测试重发验证邮件给已注册用户
3. 测试密码重置功能
4. 测试邮箱重置功能
5. 验证邮箱唯一性检查
6. 测试各种错误情况的处理

## 后续优化

1. 添加邮件发送状态反馈
2. 实现批量邮件操作
3. 添加邮件发送历史记录
4. 优化错误提示信息
5. 添加邮件模板自定义功能 