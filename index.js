import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// ES模块中获取__dirname的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// 企业微信配置
const WECOM_CONFIG = {
  corpId: process.env.VITE_WECOM_CORP_ID || 'ww68a125fce698cb59',
  agentId: process.env.VITE_WECOM_AGENT_ID || '1000002',
  secret: process.env.VITE_WECOM_SECRET,
  redirectUri: process.env.VITE_WECOM_REDIRECT_URI || 'https://lead-service.vld.com.cn/auth/wecom/callback'
};

// 企业微信API处理
// 获取企业微信访问令牌
async function getWecomAccessToken() {
  try {
    const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECOM_CONFIG.corpId}&corpsecret=${WECOM_CONFIG.secret}`);
    const data = await response.json();
    
    if (data.errcode !== 0) {
      throw new Error(`获取访问令牌失败: ${data.errmsg}`);
    }
    
    return {
      access_token: data.access_token,
      expires_in: data.expires_in
    };
  } catch (error) {
    console.error('获取企业微信访问令牌失败:', error);
    throw error;
  }
}

// 通过code获取用户信息
async function getWecomUserInfo(code) {
  try {
    // 1. 获取访问令牌
    const { access_token } = await getWecomAccessToken();
    
    // 2. 通过code获取用户ID
    const userResponse = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${access_token}&code=${code}`);
    const userData = await userResponse.json();
    
    if (userData.errcode !== 0) {
      throw new Error(`获取用户信息失败: ${userData.errmsg}`);
    }
    
    // 3. 获取用户详细信息
    const detailResponse = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${access_token}&userid=${userData.UserId}`);
    const detailData = await detailResponse.json();
    
    if (detailData.errcode !== 0) {
      throw new Error(`获取用户详细信息失败: ${detailData.errmsg}`);
    }
    
    return {
      UserId: detailData.userid,
      name: detailData.name,
      mobile: detailData.mobile,
      email: detailData.email || `${detailData.userid}@wecom.local`,
      department: detailData.department?.join(',') || '',
      position: detailData.position || '',
      corpId: WECOM_CONFIG.corpId
    };
  } catch (error) {
    console.error('获取企业微信用户信息失败:', error);
    throw error;
  }
}

// 企业微信回调处理API
app.get('/auth/wecom/callback', async (req, res) => {
  try {
    const { code, state, appid } = req.query;
    
    console.log('企业微信回调参数:', { code, state, appid });
    
    if (!code) {
      return res.redirect(`/?error=授权码缺失&state=${state || ''}`);
    }
    
    // 验证appid
    if (appid !== WECOM_CONFIG.corpId) {
      return res.redirect(`/?error=应用ID不匹配&state=${state || ''}`);
    }
    
    // 获取用户信息
    const userInfo = await getWecomUserInfo(code);
    
    // 将用户信息编码后重定向到前端
    const userInfoEncoded = encodeURIComponent(JSON.stringify(userInfo));
    const stateEncoded = encodeURIComponent(state || '');
    
    // 重定向到前端页面，携带用户信息
    res.redirect(`/?wecom_success=true&user_info=${userInfoEncoded}&state=${stateEncoded}`);
    
  } catch (error) {
    console.error('处理企业微信回调失败:', error);
    res.redirect(`/?error=${encodeURIComponent(error.message)}&state=${req.query.state || ''}`);
  }
});

// 企业微信用户信息API（供前端调用）
app.post('/api/wecom/user-info', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: '授权码缺失' });
    }
    
    const userInfo = await getWecomUserInfo(code);
    
    res.json({
      success: true,
      data: { userInfo }
    });
    
  } catch (error) {
    console.error('获取企业微信用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SPA路由支持 - 所有其他路由都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM Web Application running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// 导出处理函数（函数计算需要）
export const handler = (event, context, callback) => {
  // 这里可以添加函数计算特定的处理逻辑
  // 对于静态网站，主要依赖Express服务器
  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: 'CRM Web Application is running'
  });
};
