# 环境变量更新总结

## 📋 更新概述

根据企业微信OAuth2.0官方文档标准和JustAuth最佳实践，已完成环境变量配置的更新。

## 🔧 主要修改

### 1. 前端环境变量 (.env 和 .env.production)

**移除的配置：**
- ❌ `VITE_WECOM_SECRET` - 敏感信息，已移至后端

**保留的配置：**
- ✅ `VITE_WECOM_CORP_ID=ww68a125fce698cb59` - 企业ID（公开信息）
- ✅ `VITE_WECOM_AGENT_ID=1000002` - 应用ID（公开信息）
- ✅ `VITE_WECOM_REDIRECT_URI=https://lead-service.vld.com.cn/auth/wecom/callback` - 回调地址

**新增的配置：**
- ✅ `VITE_API_BASE_URL=https://lead-service.vld.com.cn/api` - 后端API地址

### 2. 后端环境变量 (backend/.env)

**保持不变的配置：**
- ✅ `WECOM_CORP_ID=ww68a125fce698cb59` - 企业ID
- ✅ `WECOM_AGENT_ID=1000002` - 应用ID
- ✅ `WECOM_SECRET=sXQeFCLDQJkwrX5lMWDzBTEIiHK1J7-a2e7chPyqYxY` - 应用密钥（敏感信息）
- ✅ `WECOM_REDIRECT_URI=https://lead-service.vld.com.cn/auth/wecom/callback` - 回调地址

## 🎯 配置说明

### 前端配置 (VITE_*)
- 只包含公开信息，可以安全地暴露给客户端
- 用于构建时的环境变量注入
- 不包含任何敏感信息

### 后端配置 (WECOM_*)
- 包含所有敏感信息，仅在服务器端使用
- 用于OAuth2.0认证流程
- 符合JustAuth最佳实践

## 🔒 安全改进

1. **敏感信息隔离**: 将WECOM_SECRET从前端移至后端
2. **最小权限原则**: 前端只获取必要的公开配置
3. **API分离**: 通过VITE_API_BASE_URL统一管理后端API调用

## 📝 使用说明

### 前端使用
```typescript
// 获取企业微信配置
const corpId = import.meta.env.VITE_WECOM_CORP_ID;
const agentId = import.meta.env.VITE_WECOM_AGENT_ID;
const redirectUri = import.meta.env.VITE_WECOM_REDIRECT_URI;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
```

### 后端使用
```javascript
// 获取企业微信配置
const corpId = process.env.WECOM_CORP_ID;
const agentId = process.env.WECOM_AGENT_ID;
const secret = process.env.WECOM_SECRET; // 敏感信息
const redirectUri = process.env.WECOM_REDIRECT_URI;
```

## ✅ 验证清单

- [x] 前端环境变量不包含敏感信息
- [x] 后端环境变量包含完整的OAuth配置
- [x] API基础URL配置正确
- [x] 生产和开发环境配置一致
- [x] 符合企业微信官方文档标准
- [x] 符合JustAuth最佳实践

## 🚀 下一步

1. 重新构建前端应用
2. 重新部署后端服务
3. 测试企业微信登录功能
4. 验证OAuth2.0流程是否正常

---
更新时间: $(date)
更新原因: 符合企业微信OAuth2.0官方文档标准和JustAuth最佳实践
