# JustAuth 后端实现指南

## 🎯 概述

本文档提供了符合JustAuth最佳实践的企业微信登录后端实现方案。所有敏感操作都在后端处理，前端只负责用户交互。

## 🏗️ 后端API设计

### 1. 环境变量配置

```bash
# 后端环境变量 (.env)
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_secret_here
WECOM_REDIRECT_URI=https://yourdomain.com/auth/wecom/callback
```

### 2. API端点设计

#### 2.1 获取授权URL
```
GET /api/auth/wecom/url
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=...",
    "state": "wecom_auth_1234567890"
  }
}
```

#### 2.2 获取二维码
```
GET /api/auth/wecom/qrcode
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=...",
    "state": "qrcode_1234567890_abc123"
  }
}
```

#### 2.3 处理回调
```
POST /api/auth/wecom/callback
Content-Type: application/json

{
  "code": "auth_code_from_wecom",
  "state": "state_parameter"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "userInfo": {
      "UserId": "zhangsan",
      "name": "张三",
      "mobile": "13800138000",
      "email": "zhangsan@company.com",
      "department": "技术部",
      "position": "工程师",
      "corpId": "ww68a125fce698cb59",
      "avatar": "https://..."
    },
    "redirectUrl": "/dashboard"
  }
}
```

#### 2.4 检查登录状态
```
GET /api/auth/wecom/status?state=state_parameter
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "status": "pending|success|expired",
    "userInfo": { ... } // 仅在status为success时返回
  }
}
```

## 🔧 后端实现代码

### Node.js + Express 实现

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 企业微信配置
const WECOM_CONFIG = {
  corpId: process.env.WECOM_CORP_ID,
  agentId: process.env.WECOM_AGENT_ID,
  secret: process.env.WECOM_SECRET,
  redirectUri: process.env.WECOM_REDIRECT_URI,
};

// 存储状态和用户信息的临时存储（生产环境应使用Redis）
const stateStorage = new Map();

// 1. 获取授权URL
app.get('/api/auth/wecom/url', (req, res) => {
  try {
    const state = 'wecom_auth_' + Date.now();
    const params = new URLSearchParams({
      appid: WECOM_CONFIG.corpId,
      redirect_uri: encodeURIComponent(WECOM_CONFIG.redirectUri),
      response_type: 'code',
      scope: 'snsapi_base',
      state: state,
      agentid: WECOM_CONFIG.agentId
    });
    
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
    
    // 存储状态
    stateStorage.set(state, { status: 'pending', createdAt: Date.now() });
    
    res.json({
      success: true,
      data: { authUrl, state }
    });
  } catch (error) {
    console.error('生成授权URL失败:', error);
    res.status(500).json({
      success: false,
      error: '生成授权URL失败'
    });
  }
});

// 2. 获取二维码
app.get('/api/auth/wecom/qrcode', (req, res) => {
  try {
    const state = 'qrcode_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const params = new URLSearchParams({
      appid: WECOM_CONFIG.corpId,
      redirect_uri: encodeURIComponent(WECOM_CONFIG.redirectUri),
      response_type: 'code',
      scope: 'snsapi_base',
      state: state,
      agentid: WECOM_CONFIG.agentId
    });
    
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
    
    // 存储状态
    stateStorage.set(state, { status: 'pending', createdAt: Date.now() });
    
    res.json({
      success: true,
      data: { authUrl, state }
    });
  } catch (error) {
    console.error('生成二维码失败:', error);
    res.status(500).json({
      success: false,
      error: '生成二维码失败'
    });
  }
});

// 3. 处理回调
app.post('/api/auth/wecom/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    // 验证state
    const storedState = stateStorage.get(state);
    if (!storedState) {
      return res.status(400).json({
        success: false,
        error: '无效的state参数'
      });
    }
    
    // 检查state是否过期（5分钟）
    if (Date.now() - storedState.createdAt > 5 * 60 * 1000) {
      stateStorage.delete(state);
      return res.status(400).json({
        success: false,
        error: 'state已过期'
      });
    }
    
    // 1. 获取访问令牌
    const tokenResponse = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/gettoken', {
      params: {
        corpid: WECOM_CONFIG.corpId,
        corpsecret: WECOM_CONFIG.secret
      }
    });
    
    if (tokenResponse.data.errcode !== 0) {
      throw new Error(`获取访问令牌失败: ${tokenResponse.data.errmsg}`);
    }
    
    const accessToken = tokenResponse.data.access_token;
    
    // 2. 通过code获取用户ID
    const userResponse = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo', {
      params: {
        access_token: accessToken,
        code: code
      }
    });
    
    if (userResponse.data.errcode !== 0) {
      throw new Error(`获取用户信息失败: ${userResponse.data.errmsg}`);
    }
    
    const userId = userResponse.data.UserId;
    
    // 3. 获取用户详细信息
    const detailResponse = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/user/get', {
      params: {
        access_token: accessToken,
        userid: userId
      }
    });
    
    if (detailResponse.data.errcode !== 0) {
      throw new Error(`获取用户详细信息失败: ${detailResponse.data.errmsg}`);
    }
    
    const userDetail = detailResponse.data;
    
    // 4. 构建用户信息
    const userInfo = {
      UserId: userDetail.userid,
      name: userDetail.name,
      mobile: userDetail.mobile,
      email: userDetail.email || `${userDetail.userid}@wecom.local`,
      department: userDetail.department?.join(',') || '',
      position: userDetail.position || '',
      corpId: WECOM_CONFIG.corpId,
      avatar: userDetail.avatar || ''
    };
    
    // 5. 更新状态
    stateStorage.set(state, { 
      status: 'success', 
      userInfo, 
      createdAt: storedState.createdAt 
    });
    
    res.json({
      success: true,
      data: {
        userInfo,
        redirectUrl: '/dashboard'
      }
    });
    
  } catch (error) {
    console.error('处理企业微信回调失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理回调失败'
    });
  }
});

// 4. 检查登录状态
app.get('/api/auth/wecom/status', (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        error: '缺少state参数'
      });
    }
    
    const storedState = stateStorage.get(state);
    if (!storedState) {
      return res.status(404).json({
        success: false,
        error: '状态不存在或已过期'
      });
    }
    
    // 检查是否过期
    if (Date.now() - storedState.createdAt > 5 * 60 * 1000) {
      stateStorage.delete(state);
      return res.status(410).json({
        success: false,
        error: '状态已过期'
      });
    }
    
    res.json({
      success: true,
      data: {
        status: storedState.status,
        userInfo: storedState.userInfo || null
      }
    });
    
  } catch (error) {
    console.error('检查登录状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查状态失败'
    });
  }
});

// 清理过期状态的定时任务
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStorage.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      stateStorage.delete(state);
    }
  }
}, 60000); // 每分钟清理一次

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`企业微信认证服务运行在端口 ${PORT}`);
});
```

## 🔒 安全考虑

### 1. 环境变量安全
- 所有敏感配置都通过环境变量管理
- 生产环境使用安全的密钥管理服务

### 2. State参数验证
- 使用随机生成的state参数防止CSRF攻击
- 设置合理的过期时间（5分钟）
- 定期清理过期的state

### 3. 错误处理
- 不暴露敏感的错误信息
- 记录详细的错误日志用于调试
- 返回用户友好的错误消息

### 4. 生产环境建议
- 使用Redis替代内存存储
- 添加请求频率限制
- 使用HTTPS传输
- 添加API认证和授权

## 📝 部署说明

### 1. 环境变量配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

### 2. 安装依赖
```bash
npm install express axios
```

### 3. 启动服务
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 4. 反向代理配置
```nginx
# Nginx配置示例
location /api/auth/wecom/ {
    proxy_pass http://localhost:3001/api/auth/wecom/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 🧪 测试验证

### 1. 单元测试
```javascript
// 测试授权URL生成
describe('Wecom Auth', () => {
  test('should generate valid auth URL', async () => {
    const response = await request(app)
      .get('/api/auth/wecom/url')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.authUrl).toContain('open.weixin.qq.com');
  });
});
```

### 2. 集成测试
- 测试完整的OAuth流程
- 验证state参数的安全性
- 测试错误处理机制

## 📚 参考资源

- [JustAuth官方文档](https://justauth.cn/)
- [企业微信OAuth文档](https://developer.work.weixin.qq.com/document/path/91120)
- [OAuth 2.0安全最佳实践](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
