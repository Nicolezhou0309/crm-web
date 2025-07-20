# 真实邮箱邀请指南

## 🔍 问题分析

使用真实用户邮箱进行邀请时，可能会遇到以下问题：

### 1. Resend开发环境限制

#### 📧 验证邮箱要求
- **开发环境**：只能发送到已验证的邮箱地址
- **生产环境**：可以发送到任何邮箱地址
- **当前状态**：项目处于开发环境

#### ✅ 已验证的邮箱
- `zhoulingxin0309@gmail.com` - 已验证
- `delivered@resend.dev` - 测试邮箱
- 其他在Resend控制台中验证过的邮箱

#### ❌ 未验证的邮箱
- 任何未在Resend控制台中验证的邮箱
- 新添加的邮箱地址
- 临时邮箱地址

### 2. 可能的错误情况

#### 🔴 500错误 - 邮箱未验证
```
错误信息：Invalid `to` field. Please use our testing email address instead of domains like `example.com`.
```

#### 🔴 400错误 - 邮箱格式问题
```
错误信息：Invalid email format
```

#### 🔴 422错误 - 域名限制
```
错误信息：Domain not allowed in development mode
```

## 🛠️ 解决方案

### 1. 立即解决方案

#### 📧 使用已验证邮箱测试
```javascript
// 使用已验证的邮箱进行测试
const verifiedEmails = [
  'zhoulingxin0309@gmail.com',
  'delivered@resend.dev'
];
```

#### 🔧 临时邀请方案
1. **使用已验证邮箱**：先用已验证邮箱测试功能
2. **手动邀请**：通过其他方式发送邀请链接
3. **升级到生产环境**：配置自定义域名

### 2. 长期解决方案

#### 🌐 配置自定义域名
1. **购买域名**：如 `yourcompany.com`
2. **配置DNS记录**：
   ```
   TXT: v=spf1 include:_spf.resend.com ~all
   TXT: resend-verification=your-verification-code
   ```
3. **在Resend中验证域名**
4. **更新发件人地址**：使用 `noreply@yourcompany.com`

#### 🔄 升级到生产环境
1. **配置生产环境变量**
2. **验证所有必要的邮箱**
3. **设置邮件模板**
4. **测试邮件发送**

### 3. 临时工作流程

#### 📱 手动邀请流程
1. **生成邀请链接**：
   ```javascript
   const inviteUrl = `${FRONTEND_URL}/set-password?token=${inviteToken}`;
   ```

2. **通过其他方式发送**：
   - 微信/QQ消息
   - 短信通知
   - 电话邀请
   - 面对面分享

3. **用户注册流程**：
   - 用户点击邀请链接
   - 设置密码
   - 完善个人信息

#### 🔗 直接链接分享
```javascript
// 生成邀请链接
const generateInviteLink = (email, organizationId) => {
  const baseUrl = 'https://crm-web-ncioles-projects.vercel.app/set-password';
  const params = new URLSearchParams({
    email: email,
    org: organizationId,
    invite: 'true'
  });
  return `${baseUrl}?${params.toString()}`;
};
```

## 📋 实施步骤

### 1. 立即行动
- [ ] 使用已验证邮箱测试邀请功能
- [ ] 检查当前邮箱是否已验证
- [ ] 准备手动邀请流程

### 2. 短期计划
- [ ] 配置自定义域名
- [ ] 验证生产环境设置
- [ ] 测试邮件发送

### 3. 长期计划
- [ ] 完善邮件模板
- [ ] 设置邮件监控
- [ ] 优化用户体验

## 🎯 测试建议

### 1. 使用已验证邮箱
```javascript
// 测试邀请功能
const testEmail = 'zhoulingxin0309@gmail.com';
const testName = '测试用户';
```

### 2. 检查邮箱验证状态
```javascript
// 检查邮箱是否已验证
const checkEmailVerification = async (email) => {
  // 在Resend控制台中检查
  console.log('请在Resend控制台中检查邮箱验证状态');
};
```

### 3. 备用邀请方式
```javascript
// 生成邀请链接
const inviteLink = generateInviteLink(email, organizationId);
console.log('邀请链接:', inviteLink);
```

## 📞 技术支持

### 1. Resend支持
- [Resend文档](https://resend.com/docs)
- [邮箱验证指南](https://resend.com/docs/domains)
- [开发环境限制](https://resend.com/docs/development)

### 2. 常见问题
1. **邮箱未验证**：在Resend控制台中验证邮箱
2. **域名限制**：配置自定义域名
3. **发送失败**：检查API密钥和配置

### 3. 联系支持
如果问题持续存在：
1. 收集错误日志
2. 记录邮箱地址
3. 联系Resend技术支持

## 📚 相关资源

- [Resend邮箱验证](https://resend.com/docs/domains)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [邮件发送最佳实践](https://resend.com/docs/best-practices)
- [开发环境配置](https://resend.com/docs/development) 