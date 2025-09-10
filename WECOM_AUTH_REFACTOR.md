# 企业微信认证逻辑重构说明

## 修改概述

本次重构修改了企业微信认证逻辑，将原来前端使用 Service Role 建立对话的方式改为后端直接处理认证并建立对话。

## 主要变更

### 后端变更 (backend/server.js)

1. **添加 Supabase 依赖**
   - 引入 `@supabase/supabase-js` 包
   - 创建 Supabase 客户端连接

2. **新增数据库操作函数**
   - `handleWecomUserInDatabase()`: 处理企业微信用户的数据库操作
   - 检查用户是否存在，不存在则创建，存在则更新元数据
   - 生成用户会话并返回完整的用户和会话信息

3. **修改回调处理逻辑**
   - GET 和 POST 回调都增加了数据库操作步骤
   - 后端收到 code 后直接连接数据库建立用户会话
   - 将完整的用户信息和会话数据打包传给前端

### 前端变更

1. **简化 wecomAuthManager.ts**
   - 移除所有 Service Role 相关代码
   - 移除用户创建、更新等数据库操作
   - 简化为直接使用后端返回的会话信息设置会话

2. **修改 useAuth.ts**
   - 简化企业微信登录逻辑
   - 直接传入完整的用户信息给 wecomAuthManager

3. **更新 WecomCallback.tsx**
   - 直接使用后端返回的完整用户信息进行登录

## 新的认证流程

1. **前端生成二维码** → 后端返回 authUrl 和 state
2. **用户扫码授权** → 企业微信重定向到后端回调
3. **后端处理回调**：
   - 获取企业微信 access_token
   - 通过 code 获取用户信息
   - 连接数据库检查/创建用户
   - 生成用户会话
   - 返回完整的用户和会话信息给前端
4. **前端接收数据** → 直接使用会话信息设置登录状态

## 环境变量要求

后端需要以下环境变量：

```env
# 企业微信配置
WECOM_CORP_ID=your_corp_id
WECOM_AGENT_ID=your_agent_id
WECOM_SECRET=your_secret
WECOM_REDIRECT_URI=your_redirect_uri

# Supabase配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 部署步骤

1. **安装后端依赖**
   ```bash
   cd backend
   npm install
   ```

2. **配置环境变量**
   - 确保所有必需的环境变量都已设置

3. **启动后端服务**
   ```bash
   npm start
   ```

4. **测试认证流程**
   ```bash
   node test-wecom-auth.js
   ```

## 优势

1. **安全性提升**: 敏感操作都在后端处理，前端不直接操作数据库
2. **代码简化**: 前端逻辑更简单，减少了 Service Role 的使用
3. **统一管理**: 所有认证逻辑集中在后端，便于维护
4. **错误处理**: 后端可以更好地处理各种异常情况

## 注意事项

1. 确保后端有正确的 Supabase Service Role 权限
2. 测试时需要使用真实的企业微信 code，测试 code 会失败
3. 确保环境变量配置正确
4. 建议在生产环境使用 Redis 替代内存存储

## 测试

运行测试脚本验证修改：

```bash
node test-wecom-auth.js
```

测试脚本会验证：
- 二维码生成功能
- 回调处理逻辑
- 状态检查功能
