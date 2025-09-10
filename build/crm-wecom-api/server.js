const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://lead.vld.com.cn',
  credentials: true
}));
app.use(express.json());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// 企业微信配置
const WECOM_CONFIG = {
  corpId: process.env.WECOM_CORP_ID,
  agentId: process.env.WECOM_AGENT_ID,
  secret: process.env.WECOM_SECRET,
  redirectUri: process.env.WECOM_REDIRECT_URI,
};

// 验证配置
if (!WECOM_CONFIG.corpId || !WECOM_CONFIG.agentId || !WECOM_CONFIG.secret) {
  console.error('❌ 企业微信配置不完整，请检查环境变量');
  process.exit(1);
}

// 存储状态和用户信息的临时存储（生产环境应使用Redis）
const stateStorage = new Map();

// 清理过期状态的定时任务
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStorage.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      stateStorage.delete(state);
    }
  }
}, 60000); // 每分钟清理一次

// 1. 获取企业微信授权URL
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

// 2. 获取企业微信二维码
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

// 3. 处理企业微信回调
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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '企业微信认证API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 企业微信认证API服务运行在端口 ${PORT}`);
  console.log(`📋 配置信息:`);
  console.log(`  企业ID: ${WECOM_CONFIG.corpId}`);
  console.log(`  应用ID: ${WECOM_CONFIG.agentId}`);
  console.log(`  回调地址: ${WECOM_CONFIG.redirectUri}`);
  console.log(`  前端地址: ${process.env.FRONTEND_URL || 'https://lead.vld.com.cn'}`);
});

module.exports = app;
