# JustAuth 迁移指南

## 🎯 迁移概述

本指南将帮助您将现有的企业微信登录实现迁移到符合JustAuth最佳实践的安全架构。

## 🔄 迁移前后对比

### 迁移前（存在安全风险）
```typescript
// ❌ 前端直接处理敏感信息
const WECOM_CONFIG = {
  corpId: import.meta.env.VITE_WECOM_CORP_ID,
  agentId: import.meta.env.VITE_WECOM_AGENT_ID,
  secret: import.meta.env.VITE_WECOM_SECRET, // ⚠️ 安全风险
};

// ❌ 前端直接调用企业微信API
const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECOM_CONFIG.corpId}&corpsecret=${WECOM_CONFIG.secret}`);
```

### 迁移后（安全架构）
```typescript
// ✅ 前端只调用后端API
const response = await getWecomAuthUrl();

// ✅ 后端处理所有敏感操作
// 所有企业微信API调用都在后端进行
```

## 📋 迁移步骤

### 1. 更新前端代码

#### 1.1 替换API调用
```typescript
// 旧代码（已删除）
// import { getWecomUserInfo } from '../api/wecomApi';

// 新代码
import { handleWecomCallback } from '../api/wecomAuthApi';
```

#### 1.2 更新组件实现
- `WecomLogin.tsx` - 已更新为调用后端API
- `WecomCallback.tsx` - 已更新为调用后端API
- `wecomApi.ts` - 已删除（废弃文件）

### 2. 环境变量配置

#### 2.1 前端环境变量（.env）
```bash
# 只保留公开配置
VITE_WECOM_CORP_ID=ww68a125fce698cb59
VITE_WECOM_AGENT_ID=1000002
VITE_WECOM_REDIRECT_URI=https://yourdomain.com/auth/wecom/callback
VITE_API_BASE_URL=https://yourdomain.com/api

# 移除敏感配置
# VITE_WECOM_SECRET=your_secret_here  # 已移除
```

#### 2.2 后端环境变量
```bash
# 后端环境变量
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_secret_here
WECOM_REDIRECT_URI=https://yourdomain.com/auth/wecom/callback
```

### 3. 后端实现

参考 `docs/JUSTAUTH_BACKEND_IMPLEMENTATION.md` 实现后端API。

## 🔒 安全改进

### 1. 敏感信息保护
- ✅ Secret等敏感配置移至后端
- ✅ 前端不再直接调用企业微信API
- ✅ 所有OAuth流程在后端处理

### 2. 架构优化
- ✅ 前后端职责分离
- ✅ 统一的安全边界
- ✅ 符合OAuth2.0最佳实践

### 3. 错误处理
- ✅ 统一的错误处理机制
- ✅ 不暴露敏感错误信息
- ✅ 用户友好的错误提示

## 📁 文件变更清单

### 新增文件
- `src/api/wecomAuthApi.ts` - 新的安全API接口
- `docs/JUSTAUTH_BACKEND_IMPLEMENTATION.md` - 后端实现指南
- `env.wecom.justauth.example` - 新的环境变量示例

### 修改文件
- `src/components/WecomLogin.tsx` - 更新为调用后端API
- `src/pages/WecomCallback.tsx` - 更新为调用后端API

### 删除文件
- `src/api/wecomApi.ts` - 已删除（废弃文件）

## 🧪 测试验证

### 1. 功能测试
```bash
# 1. 启动后端服务
npm run start:backend

# 2. 启动前端服务
npm run dev

# 3. 测试企业微信登录流程
# - 访问登录页面
# - 点击企业微信登录
# - 完成授权流程
# - 验证登录成功
```

### 2. 安全测试
- ✅ 检查前端代码中是否还有敏感信息
- ✅ 验证所有API调用都通过后端
- ✅ 确认环境变量配置正确

## 🚀 部署说明

### 1. 前端部署
```bash
# 1. 更新环境变量
cp env.wecom.justauth.example .env

# 2. 构建前端
npm run build

# 3. 部署到CDN或静态服务器
```

### 2. 后端部署
```bash
# 1. 配置后端环境变量
# 2. 部署后端API服务
# 3. 配置反向代理
# 4. 测试API连通性
```

## ⚠️ 注意事项

### 1. 向后兼容性
- 旧的 `wecomApi.ts` 已删除
- 所有调用已迁移到 `wecomAuthApi.ts`

### 2. 环境变量
- 确保后端环境变量正确配置
- 前端环境变量中移除敏感信息

### 3. 测试
- 在测试环境充分验证后再部署生产
- 确保所有登录流程正常工作

## 📞 支持

如果在迁移过程中遇到问题，请：

1. 检查本文档的迁移步骤
2. 参考后端实现指南
3. 查看控制台错误信息
4. 联系开发团队

## 🎉 迁移完成

迁移完成后，您将获得：

- ✅ 更安全的企业微信登录实现
- ✅ 符合OAuth2.0最佳实践的架构
- ✅ 更好的代码组织和维护性
- ✅ 统一的错误处理机制

恭喜您成功迁移到JustAuth最佳实践！🎊
