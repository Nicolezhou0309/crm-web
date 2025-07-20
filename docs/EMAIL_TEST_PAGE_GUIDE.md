# 邮件测试页面使用指南

## 📧 概述

邮件测试页面是系统管理模块中的一个重要功能，用于测试Supabase Edge Function的邮件发送功能。该页面提供了友好的用户界面，让管理员可以方便地测试Resend SMTP配置是否正常工作。

## 🚀 功能特性

### 1. 邮件发送测试
- **自定义收件人**：支持输入任意收件人邮箱地址
- **自定义主题**：可以设置邮件主题
- **自定义内容**：支持输入多行邮件内容
- **实时反馈**：显示发送结果和错误信息

### 2. 快速测试功能
- **一键测试**：使用预设参数快速发送测试邮件
- **默认配置**：自动填充测试邮箱和内容
- **即时结果**：立即显示发送状态

### 3. 用户友好界面
- **表单验证**：邮箱格式验证和必填项检查
- **加载状态**：发送过程中显示加载动画
- **结果展示**：清晰的成功/失败状态显示
- **使用说明**：详细的操作指南

## 📍 页面位置

邮件测试页面位于系统管理模块下：

```
系统管理 → 邮件测试
```

### 导航路径
1. 点击左侧导航菜单中的"系统管理"
2. 在子菜单中选择"邮件测试"
3. 页面路径：`/email-test`

## 🎯 使用方法

### 1. 基本测试
1. 在"收件人邮箱"字段输入测试邮箱（推荐：`delivered@resend.dev`）
2. 在"邮件主题"字段输入邮件主题
3. 在"邮件内容"字段输入邮件内容
4. 点击"发送测试邮件"按钮

### 2. 快速测试
1. 点击"快速测试"按钮
2. 系统将自动填充测试参数
3. 自动发送测试邮件

### 3. 查看结果
- **成功**：显示邮件ID和发送时间
- **失败**：显示详细错误信息

## ⚙️ 技术实现

### 前端组件
- **文件位置**：`src/pages/EmailTest.tsx`
- **UI框架**：Ant Design
- **状态管理**：React Hooks
- **表单处理**：Ant Design Form

### 后端服务
- **Edge Function**：`supabase/functions/test-email/index.ts`
- **邮件服务**：Resend SMTP
- **认证方式**：Supabase JWT

### API调用
```typescript
const { data, error } = await supabase.functions.invoke('test-email', {
  body: {
    to: 'delivered@resend.dev',
    subject: '测试邮件',
    content: '邮件内容'
  }
});
```

## 🔧 配置要求

### 1. 环境变量
```bash
# Supabase项目设置
RESEND_API_KEY=re_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz
```

### 2. Edge Function部署
```bash
# 部署邮件测试Edge Function
supabase functions deploy test-email
```

### 3. 权限要求
- 需要登录Supabase账户
- 需要有效的JWT令牌
- 建议管理员权限

## 📊 测试邮箱说明

### Resend测试邮箱
- **推荐邮箱**：`delivered@resend.dev`
- **其他选项**：`bounce@resend.dev`, `complaint@resend.dev`
- **限制说明**：开发环境只能发送到Resend允许的测试邮箱

### 生产环境
- 需要验证发件人域名
- 可以发送到任意邮箱地址
- 需要配置SPF、DKIM等DNS记录

## 🐛 常见问题

### 1. 401认证错误
**问题**：`Invalid JWT` 或 `Missing authorization header`
**解决**：
- 确保用户已登录
- 刷新页面重新获取令牌
- 检查Supabase客户端配置

### 2. 422验证错误
**问题**：`Invalid 'to' field`
**解决**：
- 使用Resend允许的测试邮箱
- 检查邮箱格式是否正确

### 3. 500服务器错误
**问题**：`RESEND_API_KEY is not configured`
**解决**：
- 检查环境变量是否正确设置
- 重新部署Edge Function
- 验证API密钥是否有效

## 📈 测试建议

### 1. 功能测试
- 测试不同邮箱格式
- 测试长邮件内容
- 测试特殊字符处理
- 测试网络异常情况

### 2. 性能测试
- 测试并发发送
- 测试大量邮件发送
- 测试响应时间

### 3. 安全测试
- 测试XSS防护
- 测试SQL注入防护
- 测试权限控制

## 🔗 相关文件

- `src/pages/EmailTest.tsx` - 邮件测试页面组件
- `supabase/functions/test-email/index.ts` - 邮件发送Edge Function
- `src/components/NavigationMenu.tsx` - 导航菜单配置
- `src/App.tsx` - 路由配置

## 📚 更多资源

- [Resend官方文档](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Ant Design表单组件](https://ant.design/components/form)
- [React Hooks文档](https://reactjs.org/docs/hooks-intro.html) 