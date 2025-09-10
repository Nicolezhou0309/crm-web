const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
// 加载环境变量配置文件
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 信任代理（用于Nginx反向代理）
app.set('trust proxy', 1);

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

// Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.VITE_SUPABASE_JWT_SECRET;

// 调试输出配置信息
console.log('🔧 Supabase配置信息:', {
  supabaseUrl,
  hasServiceRoleKey: !!supabaseServiceRoleKey,
  serviceRoleKeyLength: supabaseServiceRoleKey ? supabaseServiceRoleKey.length : 0,
  hasJwtSecret: !!jwtSecret,
  jwtSecretLength: jwtSecret ? jwtSecret.length : 0
});

// 对于自建Supabase实例，使用正确的service role key
const effectiveServiceRoleKey = supabaseServiceRoleKey || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80';

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, effectiveServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 验证配置
if (!WECOM_CONFIG.corpId || !WECOM_CONFIG.agentId || !WECOM_CONFIG.secret) {
  console.error('❌ 企业微信配置不完整，请检查环境变量');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Supabase配置不完整，请检查环境变量');
  process.exit(1);
}

if (!jwtSecret) {
  console.error('❌ JWT密钥未配置，请设置VITE_SUPABASE_JWT_SECRET环境变量');
  process.exit(1);
}

// 企业微信用户数据库操作函数
async function handleWecomUserInDatabase(userInfo) {
  try {
    console.log('🔄 开始处理企业微信用户数据库操作:', userInfo);
    
    const { UserId, corpId } = userInfo;
    let { email } = userInfo;
    
    // 1. 检查用户是否存在 - 通过users_profile表查找
    console.log('🔍 尝试查询用户...');
    
    let existingUser = null;
    let userId = null;
    
    // 方法1: 通过wechat_work_userid查找users_profile表
    try {
      console.log(`🔍 通过wechat_work_userid查找用户: ${UserId}`);
      const { data: profileData, error: profileError } = await supabase
        .from('users_profile')
        .select('user_id, email, wechat_work_userid, wechat_work_corpid, created_at')
        .eq('wechat_work_userid', UserId)
        .single();
      
      if (!profileError && profileData) {
        userId = profileData.user_id;
        console.log(`✅ 通过users_profile找到用户: ${UserId}, ID: ${userId}`);
        
        // 通过getUserById获取完整用户信息
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (!userError && userData.user) {
          existingUser = userData.user;
          console.log(`✅ 获取到完整用户信息: ${existingUser.email}`);
        }
      } else {
        console.log(`ℹ️ users_profile中未找到用户: ${UserId}`);
      }
    } catch (error) {
      console.log(`ℹ️ users_profile查询失败: ${error.message}`);
    }
    
    // 方法2: 如果方法1失败，尝试通过邮箱查找
    if (!existingUser) {
      try {
        console.log(`🔍 通过邮箱查找用户: ${email}`);
        const { data: profileData, error: profileError } = await supabase
          .from('users_profile')
          .select('user_id, email, wechat_work_userid, wechat_work_corpid, created_at')
          .eq('email', email)
          .single();
        
        if (!profileError && profileData) {
          userId = profileData.user_id;
          console.log(`✅ 通过邮箱找到用户: ${email}, ID: ${userId}`);
          
          // 通过getUserById获取完整用户信息
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (!userError && userData.user) {
            existingUser = userData.user;
            console.log(`✅ 获取到完整用户信息: ${existingUser.email}`);
          }
        } else {
          console.log(`ℹ️ users_profile中未找到用户: ${email}`);
        }
      } catch (error) {
        console.log(`ℹ️ users_profile邮箱查询失败: ${error.message}`);
      }
    }
    
    if (!existingUser) {
      console.log(`ℹ️ 用户不存在，需要创建新用户: ${email}`);
    }
    
    let userData;
    
    if (existingUser) {
      // 用户存在，使用实际邮箱并更新元数据
      console.log(`✅ 用户已存在，使用实际邮箱: ${existingUser.email}`);
      
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          wechat_work_userid: UserId,
          wechat_work_corpid: corpId,
          last_wecom_login: new Date().toISOString()
        }
      });
      
      if (updateError) {
        console.error('❌ 更新用户元数据失败:', updateError);
        throw new Error('更新用户元数据失败');
      }
      
      userId = existingUser.id;
      userData = updateData.user;
      // 使用实际邮箱而不是临时邮箱
      email = existingUser.email;
    } else {
      // 用户不存在，创建新用户
      console.log(`👤 用户不存在，创建新用户: ${email}`);
      
      // 先在auth.users中创建用户
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        user_metadata: {
          wechat_work_userid: UserId,
          wechat_work_corpid: corpId,
          auth_method: 'wecom',
          created_at: new Date().toISOString()
        }
      });
      
      if (createError) {
        console.error('❌ 创建用户失败:', createError);
        throw new Error('创建用户失败');
      }
      
      userId = createData.user.id;
      userData = createData.user;
      
      // 在users_profile表中创建记录
      console.log(`📝 在users_profile中创建用户记录...`);
      const { error: profileError } = await supabase
        .from('users_profile')
        .insert({
          user_id: userId,
          email: email,
          wechat_work_userid: UserId,
          wechat_work_corpid: corpId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.warn('⚠️ 创建users_profile记录失败，但用户已创建:', profileError.message);
      } else {
        console.log('✅ users_profile记录创建成功');
      }
    }
    
    // 2. 生成用户会话 - 使用JWT令牌
    console.log('🔄 生成用户会话...');
    
    // 生成自定义JWT令牌，与Supabase系统兼容
    const jwt = require('jsonwebtoken');
    
    console.log('🔑 使用JWT密钥:', jwtSecret.substring(0, 10) + '...');
    
    // 创建JWT载荷，符合Supabase的格式要求
    const payload = {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
      sub: userId, // 用户ID
      role: 'authenticated',
      email: email, // 使用实际邮箱
      user_metadata: {
        wechat_work_userid: UserId,
        wechat_work_corpid: corpId,
        auth_method: 'wecom'
      }
    };
    
    // 生成访问令牌
    const accessToken = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
    
    // 生成刷新令牌（使用相同的载荷，但过期时间更长）
    const refreshPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 86400, // 24小时后过期
      type: 'refresh'
    };
    const refreshToken = jwt.sign(refreshPayload, jwtSecret, { algorithm: 'HS256' });
    
    const expiresAt = Date.now() + 3600000; // 1小时后过期
    
    console.log('🔑 生成JWT令牌成功');
    console.log('📋 令牌信息:', {
      userId: userId,
      email: email,
      expiresAt: new Date(expiresAt).toISOString()
    });
    
    // 3. 返回完整的用户和会话信息
    const result = {
      user: {
        id: userId,
        email: email,
        user_metadata: {
          wechat_work_userid: UserId,
          wechat_work_corpid: corpId,
          auth_method: 'wecom'
        }
      },
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: 'bearer'
      }
    };
    
    console.log('✅ 企业微信用户数据库操作完成');
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ 企业微信用户数据库操作失败:', error);
    return { success: false, error: error.message };
  }
}

// 存储状态和用户信息的临时存储（生产环境应使用Redis）
const stateStorage = new Map();

// 长轮询等待队列：存储等待状态改变的响应对象
const pollingWaiters = new Map();

// 会话跟踪：存储前端会话信息
const sessionStorage = new Map();

// 清理过期状态的定时任务
setInterval(() => {
  const now = Date.now();
  
  // 清理过期的状态
  for (const [state, data] of stateStorage.entries()) {
    const isExpired = data.expiresAt ? now > data.expiresAt : now - data.createdAt > 10 * 60 * 1000;
    if (isExpired) {
      console.log(`🧹 清理过期状态: ${state}, sessionId: ${data.sessionId}`);
      stateStorage.delete(state);
      
      // 同时清理对应的会话
      if (data.sessionId) {
        sessionStorage.delete(data.sessionId);
      }
    }
  }
  
  // 清理过期的会话
  for (const [sessionId, session] of sessionStorage.entries()) {
    const isExpired = session.expiresAt ? now > session.expiresAt : now - session.createdAt > 10 * 60 * 1000;
    if (isExpired) {
      console.log(`🧹 清理过期会话: ${sessionId}`);
      sessionStorage.delete(sessionId);
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
    // 生成会话ID和状态码
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const state = 'qrcode_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();
    const expiresAt = createdAt + (10 * 60 * 1000); // 10分钟后过期
    
    // 获取客户端信息
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString()
    };
    
    console.log(`📱 生成二维码，sessionId: ${sessionId}, state: ${state}, 客户端: ${clientInfo.ip}`);
    
    const params = new URLSearchParams({
      appid: WECOM_CONFIG.corpId,
      redirect_uri: encodeURIComponent(WECOM_CONFIG.redirectUri),
      response_type: 'code',
      scope: 'snsapi_base',
      state: state,
      agentid: WECOM_CONFIG.agentId
    });
    
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
    
    // 存储状态，包含过期时间和会话信息
    stateStorage.set(state, { 
      status: 'pending', 
      createdAt,
      expiresAt,
      lastChecked: createdAt,
      sessionId: sessionId,
      clientInfo: clientInfo
    });
    
    // 存储会话信息
    sessionStorage.set(sessionId, {
      state: state,
      createdAt: createdAt,
      expiresAt: expiresAt,
      clientInfo: clientInfo,
      status: 'pending'
    });
    
    console.log(`📱 生成二维码，sessionId: ${sessionId}, state: ${state}, 过期时间: ${new Date(expiresAt).toISOString()}`);
    
    res.json({
      success: true,
      data: { 
        authUrl, 
        state,
        sessionId, // 返回会话ID给前端
        expiresAt,
        expiresIn: 10 * 60 * 1000 // 10分钟，毫秒
      }
    });
  } catch (error) {
    console.error('生成二维码失败:', error);
    res.status(500).json({
      success: false,
      error: '生成二维码失败'
    });
  }
});

// 3. 处理企业微信回调 - GET方法（企业微信重定向）
app.get('/api/auth/wecom/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    console.log(`📞 收到企业微信回调（GET），code: ${code}, state: ${state}`);
    
    if (!code || !state) {
      console.error('❌ 缺少必要参数:', { code: !!code, state: !!state });
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    // 验证state
    const storedState = stateStorage.get(state);
    if (!storedState) {
      console.error('❌ 无效的state参数:', state);
      return res.status(400).json({
        success: false,
        error: '无效的state参数'
      });
    }
    
    // 检查state是否过期（10分钟）
    const now = Date.now();
    const isExpired = storedState.expiresAt ? now > storedState.expiresAt : now - storedState.createdAt > 10 * 60 * 1000;
    if (isExpired) {
      stateStorage.delete(state);
      return res.status(400).json({
        success: false,
        error: '二维码已过期'
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
    console.log(`🔑 获取access_token成功: ${accessToken.substring(0, 20)}...`);
    
    // 2. 通过code获取用户信息（静默认证）
    console.log(`🔍 开始获取用户信息，code: ${code}`);
    const userResponse = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo', {
      params: {
        access_token: accessToken,
        code: code
      }
    });
    
    console.log(`📋 企业微信API返回:`, userResponse.data);
    
    if (userResponse.data.errcode !== 0) {
      throw new Error(`获取用户信息失败: ${userResponse.data.errmsg}`);
    }
    
    const responseData = userResponse.data;
    let userId, openId, externalUserId;
    
    // 判断是企业成员还是非企业成员
    if (responseData.userid || responseData.UserId) {
      // 企业成员情况 - 兼容大小写
      userId = responseData.userid || responseData.UserId;
      console.log(`👤 企业成员 - 用户ID: ${userId}`);
    } else if (responseData.openid || responseData.OpenId) {
      // 非企业成员情况 - 兼容大小写
      openId = responseData.openid || responseData.OpenId;
      externalUserId = responseData.external_userid || responseData.ExternalUserId;
      console.log(`👤 非企业成员 - openid: ${openId}, external_userid: ${externalUserId}`);
    } else {
      console.error('企业微信API返回数据:', responseData);
      throw new Error('企业微信API返回数据格式异常：未找到userid或openid字段');
    }
    
    // 3. 构建用户信息（简化版）
    let userInfo = null;
    
    if (userId) {
      // 企业成员：构建简化信息
      console.log(`👤 处理企业成员信息，userid: ${userId}`);
      userInfo = {
        UserId: userId,
        email: `${userId}@wecom.local`,
        corpId: WECOM_CONFIG.corpId
      };
    } else if (openId) {
      // 非企业成员：直接结束流程
      console.log(`👤 非企业成员 - 直接结束流程，openid: ${openId}, external_userid: ${externalUserId}`);
      return res.status(403).json({
        success: false,
        error: '非企业成员，无法访问系统'
      });
    }
    
    console.log(`✅ 构建完成用户信息:`, {
      UserId: userInfo.UserId,
      email: userInfo.email,
      corpId: userInfo.corpId
    });
    
    // 4. 处理用户数据库操作和会话建立
    console.log('🔄 开始处理用户数据库操作...');
    const dbResult = await handleWecomUserInDatabase(userInfo);
    
    if (!dbResult.success) {
      console.error('❌ 数据库操作失败:', dbResult.error);
      return res.status(500).json({
        success: false,
        error: '用户数据库操作失败: ' + dbResult.error
      });
    }
    
    const { user: dbUser, session: dbSession } = dbResult.data;
    console.log('✅ 数据库操作成功，用户ID:', dbUser.id);
    
    // 5. 更新状态，包含完整的用户和会话信息
    const completeUserInfo = {
      ...userInfo,
      id: dbUser.id,
      email: dbUser.email, // 使用数据库中的真实邮箱
      session: dbSession
    };
    
    console.log('🔍 构建完整用户信息:', {
      UserId: completeUserInfo.UserId,
      email: completeUserInfo.email,
      id: completeUserInfo.id,
      hasSession: !!completeUserInfo.session,
      sessionKeys: completeUserInfo.session ? Object.keys(completeUserInfo.session) : []
    });
    
    stateStorage.set(state, { 
      status: 'success', 
      userInfo: completeUserInfo, 
      createdAt: storedState.createdAt,
      expiresAt: storedState.expiresAt
    });

    // 6. 通知等待的长轮询连接
    const waiter = pollingWaiters.get(state);
    if (waiter) {
      clearTimeout(waiter.timeout);
      pollingWaiters.delete(state);
      console.log(`📢 通知长轮询连接登录成功，state: ${state}`);
      console.log(`👤 发送完整用户信息给长轮询连接:`, {
        UserId: completeUserInfo.UserId,
        email: completeUserInfo.email,
        id: completeUserInfo.id,
        hasSession: !!completeUserInfo.session,
        sessionTokenType: completeUserInfo.session?.token_type,
        sessionExpiresAt: completeUserInfo.session?.expires_at
      });
      const responseData = {
        success: true,
        type: 'login_success',
        userInfo: completeUserInfo,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 长轮询响应数据:', {
        success: responseData.success,
        type: responseData.type,
        userInfoKeys: Object.keys(responseData.userInfo),
        hasUserInfoSession: !!responseData.userInfo.session
      });
      
      waiter.res.json(responseData);
    }
    
    res.json({
      success: true,
      data: {
        userInfo: completeUserInfo,
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

// 3.1 处理企业微信回调 - POST方法（前端发送）
app.post('/api/auth/wecom/callback', async (req, res) => {
  try {
    const { code, state, sessionId } = req.body;
    
    // 获取客户端信息
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString()
    };
    
    console.log(`📞 收到企业微信回调（POST），code: ${code}, state: ${state}, sessionId: ${sessionId}, 客户端: ${clientInfo.ip}`);
    
    if (!code || !state) {
      console.error('❌ 缺少必要参数:', { code: !!code, state: !!state });
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    // 验证state
    const storedState = stateStorage.get(state);
    if (!storedState) {
      console.error('❌ 无效的state参数:', state);
      return res.status(400).json({
        success: false,
        error: '无效的state参数'
      });
    }
    
    // 验证会话信息（通过state获取）
    if (storedState.sessionId) {
      const storedSession = sessionStorage.get(storedState.sessionId);
      if (storedSession && storedSession.state === state) {
        console.log(`✅ 会话验证通过，sessionId: ${storedState.sessionId}, 原始客户端: ${storedSession.clientInfo.ip}`);
      } else {
        console.log(`⚠️ 会话信息不完整，但继续处理state: ${state}`);
      }
    }
    
    // 检查state是否过期（10分钟）
    const now = Date.now();
    const isExpired = storedState.expiresAt ? now > storedState.expiresAt : now - storedState.createdAt > 10 * 60 * 1000;
    if (isExpired) {
      stateStorage.delete(state);
      console.error('❌ 二维码已过期:', state);
      return res.status(400).json({
        success: false,
        error: '二维码已过期'
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
    console.log(`🔑 获取access_token成功: ${accessToken.substring(0, 20)}...`);
    
    // 2. 通过code获取用户信息（静默认证）
    console.log(`🔍 开始获取用户信息，code: ${code}`);
    const userResponse = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo', {
      params: {
        access_token: accessToken,
        code: code
      }
    });
    
    console.log(`📋 企业微信API返回:`, userResponse.data);
    
    if (userResponse.data.errcode !== 0) {
      throw new Error(`获取用户信息失败: ${userResponse.data.errmsg}`);
    }
    
    const responseData = userResponse.data;
    let userId, openId, externalUserId;
    
    // 判断是企业成员还是非企业成员
    if (responseData.userid || responseData.UserId) {
      // 企业成员情况 - 兼容大小写
      userId = responseData.userid || responseData.UserId;
      console.log(`👤 企业成员 - 用户ID: ${userId}`);
    } else if (responseData.openid || responseData.OpenId) {
      // 非企业成员情况 - 兼容大小写
      openId = responseData.openid || responseData.OpenId;
      externalUserId = responseData.external_userid || responseData.ExternalUserId;
      console.log(`👤 非企业成员 - openid: ${openId}, external_userid: ${externalUserId}`);
    } else {
      console.error('企业微信API返回数据:', responseData);
      throw new Error('企业微信API返回数据格式异常：未找到userid或openid字段');
    }
    
    // 3. 构建用户信息（简化版）
    let userInfo = null;
    
    if (userId) {
      // 企业成员：构建简化信息
      console.log(`👤 处理企业成员信息，userid: ${userId}`);
      userInfo = {
        UserId: userId,
        email: `${userId}@wecom.local`,
        corpId: WECOM_CONFIG.corpId
      };
    } else if (openId) {
      // 非企业成员：直接结束流程
      console.log(`👤 非企业成员 - 直接结束流程，openid: ${openId}, external_userid: ${externalUserId}`);
      return res.status(403).json({
        success: false,
        error: '非企业成员，无法访问系统'
      });
    }
    
    console.log(`✅ 构建完成用户信息:`, {
      UserId: userInfo.UserId,
      email: userInfo.email,
      corpId: userInfo.corpId
    });
    
    // 4. 处理用户数据库操作和会话建立
    console.log('🔄 开始处理用户数据库操作...');
    const dbResult = await handleWecomUserInDatabase(userInfo);
    
    if (!dbResult.success) {
      console.error('❌ 数据库操作失败:', dbResult.error);
      return res.status(500).json({
        success: false,
        error: '用户数据库操作失败: ' + dbResult.error
      });
    }
    
    const { user: dbUser, session: dbSession } = dbResult.data;
    console.log('✅ 数据库操作成功，用户ID:', dbUser.id);
    
    // 5. 更新状态，包含完整的用户和会话信息
    const completeUserInfo = {
      ...userInfo,
      id: dbUser.id,
      email: dbUser.email, // 使用数据库中的真实邮箱
      session: dbSession
    };
    
    console.log('🔍 构建完整用户信息:', {
      UserId: completeUserInfo.UserId,
      email: completeUserInfo.email,
      id: completeUserInfo.id,
      hasSession: !!completeUserInfo.session,
      sessionKeys: completeUserInfo.session ? Object.keys(completeUserInfo.session) : []
    });
    
    stateStorage.set(state, { 
      status: 'success', 
      userInfo: completeUserInfo, 
      createdAt: storedState.createdAt,
      expiresAt: storedState.expiresAt
    });

    // 6. 通知等待的长轮询连接
    const waiter = pollingWaiters.get(state);
    if (waiter) {
      clearTimeout(waiter.timeout);
      pollingWaiters.delete(state);
      console.log(`📢 通知长轮询连接登录成功，state: ${state}`);
      console.log(`👤 发送完整用户信息给长轮询连接:`, {
        UserId: completeUserInfo.UserId,
        email: completeUserInfo.email,
        id: completeUserInfo.id,
        hasSession: !!completeUserInfo.session,
        sessionTokenType: completeUserInfo.session?.token_type,
        sessionExpiresAt: completeUserInfo.session?.expires_at
      });
      const responseData = {
        success: true,
        type: 'login_success',
        userInfo: completeUserInfo,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 长轮询响应数据:', {
        success: responseData.success,
        type: responseData.type,
        userInfoKeys: Object.keys(responseData.userInfo),
        hasUserInfoSession: !!responseData.userInfo.session
      });
      
      waiter.res.json(responseData);
    }
    
    // 7. 返回用户信息给前端
    res.json({
      success: true,
      data: {
        userInfo: completeUserInfo,
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
    const now = Date.now();
    const isExpired = storedState.expiresAt ? now > storedState.expiresAt : now - storedState.createdAt > 10 * 60 * 1000;
    if (isExpired) {
      stateStorage.delete(state);
      return res.status(410).json({
        success: false,
        error: '二维码已过期'
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

// 5. 长轮询端点 - 实时监听登录状态
app.get('/api/auth/wecom/poll', (req, res) => {
  const { state, sessionId } = req.query;
  
  if (!state) {
    return res.status(400).json({ 
      success: false,
      error: '缺少state参数' 
    });
  }

  console.log(`🔍 开始长轮询，state: ${state}, sessionId: ${sessionId}`);

  // 设置长轮询响应头
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 长轮询超时时间（11分钟，比二维码有效期长1分钟）
  const POLL_TIMEOUT = 11 * 60 * 1000;
  
  // 设置长轮询超时
  const pollTimeout = setTimeout(() => {
    console.log(`⏰ 长轮询超时，state: ${state}`);
    pollingWaiters.delete(state);
    res.json({
      success: false,
      error: '轮询超时',
      type: 'timeout',
      timestamp: new Date().toISOString()
    });
  }, POLL_TIMEOUT);

  // 立即检查当前状态
  const currentState = stateStorage.get(state);
  
  // 检查状态是否存在
  if (!currentState) {
    clearTimeout(pollTimeout);
    console.log(`❌ 状态不存在，state: ${state}`);
    res.json({
      success: false,
      error: '状态不存在或已过期',
      type: 'not_found',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 检查是否过期
  const now = Date.now();
  const isExpired = currentState.expiresAt ? now > currentState.expiresAt : now - currentState.createdAt > 10 * 60 * 1000;
  
  if (isExpired) {
    clearTimeout(pollTimeout);
    console.log(`⏰ 二维码已过期，state: ${state}, 过期时间: ${new Date(currentState.expiresAt || currentState.createdAt + 10 * 60 * 1000).toISOString()}`);
    stateStorage.delete(state);
    res.json({
      success: false,
      error: '二维码已过期，请重新生成',
      type: 'expired',
      timestamp: new Date().toISOString(),
      expiredAt: currentState.expiresAt || currentState.createdAt + 10 * 60 * 1000
    });
    return;
  }

  // 检查登录状态
  if (currentState.status === 'success') {
    clearTimeout(pollTimeout);
    console.log(`✅ 登录成功，state: ${state}`);
    res.json({
      success: true,
      type: 'login_success',
      userInfo: currentState.userInfo,
      timestamp: new Date().toISOString()
    });
    return;
  } else if (currentState.status === 'failed') {
    clearTimeout(pollTimeout);
    console.log(`❌ 登录失败，state: ${state}`);
    res.json({
      success: false,
      error: '登录失败',
      type: 'login_failed',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 状态仍为pending，将响应对象加入等待队列
  console.log(`⏳ 状态为pending，加入等待队列，state: ${state}, sessionId: ${sessionId}`);
  pollingWaiters.set(state, { res, timeout: pollTimeout, sessionId: sessionId });

  // 客户端断开连接时清理
  req.on('close', () => {
    console.log(`🔌 长轮询连接已断开，state: ${state}`);
    clearTimeout(pollTimeout);
    pollingWaiters.delete(state);
  });

  req.on('error', (error) => {
    console.error(`❌ 长轮询连接错误，state: ${state}`, error);
    clearTimeout(pollTimeout);
    pollingWaiters.delete(state);
  });
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
