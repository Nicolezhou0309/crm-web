import React, { useState, useEffect, useRef } from 'react';
import { Button, message, Typography, Space, Spin } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { getWecomAuthUrl, getWecomQRCode, checkWecomLoginStatus } from '../api/wecomAuthApi';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';

const { Text } = Typography;

interface WecomLoginProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: string) => void;
}

const WecomLogin: React.FC<WecomLoginProps> = ({ onError }) => {
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string>('');
  const [qrCodeState, setQrCodeState] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  
  // 长轮询引用
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 5; // 最大重试次数
  
  // 安全地获取 useAuth
  let authLogin: any = null;
  
  try {
    const auth = useAuth();
    authLogin = auth.login;
  } catch (err) {
    console.error('WecomLogin: 初始化认证失败:', err);
    setError('组件初始化失败');
  }

  // 从后端获取企业微信授权URL
  const generateWecomAuthUrl = async () => {
    try {
      const response = await getWecomAuthUrl();
      if (!response.success) {
        throw new Error(response.error || '获取授权URL失败');
      }
      return response.data?.authUrl;
    } catch (err) {
      console.error('获取企业微信授权URL失败:', err);
      throw new Error('获取授权URL失败');
    }
  };

  // 生成二维码图片
  const generateQRCodeImage = async (data: string): Promise<string> => {
    try {
      logger.qr('准备生成二维码，数据长度:', data.length);
      logger.qr('数据内容:', data);
      
      // 动态创建Canvas元素，不依赖DOM中的隐藏Canvas
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      
      logger.qr('动态创建Canvas元素，开始生成二维码...');
      // 生成二维码到canvas
      await QRCode.toCanvas(canvas, data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      logger.qr('二维码绘制完成，转换为Data URL...');
      // 将canvas转换为data URL
      const dataUrl = canvas.toDataURL('image/png');
      logger.qr('Data URL生成成功，长度:', dataUrl.length);
      
      return dataUrl;
    } catch (error) {
      logger.error('生成二维码图片失败:', error);
      throw new Error(`生成二维码图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 从后端获取二维码
  const generateQRCode = async () => {
    console.log('🚀 generateQRCode 函数被调用');
    setLoading(true);
    try {
      console.log('📝 开始获取企业微信二维码...');
      logger.wecom('开始获取企业微信二维码...');
      const response = await getWecomQRCode();
      console.log('📋 后端API响应:', response);
      logger.wecom('后端API响应:', response);
      
      if (!response.success) {
        logger.error('后端API返回失败:', response.error);
        throw new Error(response.error || '获取二维码失败');
      }
      
      // 正确解析后端返回的数据结构
      const { data } = response;
      const authUrl = data?.authUrl;
      const state = data?.state;
      
      console.log('🔍 解析到的数据:', { authUrl: !!authUrl, state: !!state });
      logger.wecom('解析到的数据:', { authUrl: !!authUrl, state: !!state });
      
      if (!authUrl || !state) {
        console.error('❌ 数据不完整:', { authUrl: !!authUrl, state: !!state });
        console.error('❌ 完整响应数据:', response);
        logger.error('数据不完整:', { authUrl: !!authUrl, state: !!state });
        logger.error('完整响应数据:', response);
        throw new Error('二维码数据不完整');
      }
      
      console.log('🎨 开始生成二维码图片...');
      logger.wecom('开始生成二维码图片...');
      // 生成二维码图片 - 使用authUrl作为二维码内容
      const qrCodeImageUrl = await generateQRCodeImage(authUrl);
      console.log('✅ 二维码图片生成成功');
      logger.wecom('二维码图片生成成功');
      
      setQrCodeData(authUrl);
      setQrCodeImageUrl(qrCodeImageUrl);
      setQrCodeState(state);
      
      // 开始长轮询监听状态
      startLongPolling(state);
      
      // 静默生成二维码，不显示成功提示
    } catch (error) {
      logger.error('生成二维码失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成二维码失败';
      message.error('二维码生成失败，请重试');
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 开始长轮询监听状态
  const startLongPolling = (state: string) => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    setPolling(true);
    retryCountRef.current = 0; // 重置重试计数
    logger.wecom('开始长轮询，state:', state);

    const pollStatus = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
        
        // 获取会话ID
        const sessionId = localStorage.getItem('wecom_session_id');
        
        // 构建长轮询URL，包含会话ID
        const pollUrl = `${apiBaseUrl}/auth/wecom/poll?state=${encodeURIComponent(state)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
        
        logger.wecom('发起长轮询请求:', pollUrl);
        logger.wecom('会话ID:', sessionId);
        
        const response = await fetch(pollUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        logger.wecom('长轮询响应:', data);

        // 重置重试计数，因为请求成功了
        retryCountRef.current = 0;

        switch (data.type) {
          case 'login_success':
            logger.wecom('企业微信登录成功');
            handleWecomLoginSuccess(data.userInfo);
            stopLongPolling();
            break;
          case 'login_failed':
            logger.error('企业微信登录失败:', data.error);
            message.error('登录失败，请重试');
            onError?.(data.error || '登录失败');
            stopLongPolling();
            break;
          case 'expired':
            logger.error('二维码已过期:', data.error);
            message.error('二维码已过期，请重新生成');
            onError?.(data.error || '二维码已过期');
            stopLongPolling();
            break;
          case 'timeout':
            logger.wecom('长轮询超时，继续轮询');
            // 超时后继续轮询，而不是重新启动
            pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
            break;
          case 'not_found':
            logger.error('状态不存在:', data.error);
            message.error('登录状态异常，请重新生成二维码');
            onError?.(data.error || '状态异常');
            stopLongPolling();
            break;
          default:
            // 继续轮询
            logger.wecom('继续长轮询...');
            pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        logger.error('长轮询请求失败:', error);
        
        // 增加重试计数
        retryCountRef.current += 1;
        
        // 检查是否超过最大重试次数
        if (retryCountRef.current >= maxRetries) {
          logger.error(`长轮询失败，已达到最大重试次数 (${maxRetries})`);
          message.error('网络连接异常，请重新生成二维码');
          onError?.('网络连接异常');
          stopLongPolling();
          return;
        }
        
        // 指数退避重试：1秒、2秒、4秒、8秒、16秒
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 16000);
        logger.wecom(`第${retryCountRef.current}次重试，${retryDelay}ms后重试`);
        
        pollingTimeoutRef.current = setTimeout(pollStatus, retryDelay);
      }
    };

    // 开始第一次轮询
    pollingTimeoutRef.current = setTimeout(pollStatus, 1000);
  };

  // 停止长轮询
  const stopLongPolling = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    retryCountRef.current = 0; // 重置重试计数
    setPolling(false);
    logger.wecom('长轮询已停止');
  };

  // 处理企业微信登录成功
  const handleWecomLoginSuccess = async (userInfo: any) => {
    try {
      if (!authLogin) {
        throw new Error('认证服务未初始化');
      }

      console.log('🔍 WecomLogin收到的userInfo:', userInfo);
      console.log('🔍 userInfo的所有键:', Object.keys(userInfo));
      console.log('🔍 userInfo是否包含session:', !!userInfo.session);
      
      // 构建metadata，确保包含session信息
      const metadata = {
        wechat_work_userid: userInfo.UserId,
        wechat_work_corpid: userInfo.corpId,
        session: userInfo.session // 确保session信息被正确传递
      };
      
      console.log('🔍 构建的metadata:', metadata);
      console.log('🔍 metadata是否包含session:', !!metadata.session);
      console.log('🔍 准备调用authLogin，传递的参数:', {
        email: userInfo.email,
        metadata: metadata
      });

      const { success, error } = await authLogin(
        userInfo.email,
        '', // 企业微信用户不需要密码
        metadata // 传入构建的metadata，包含session数据
      );

      if (success) {
        message.success('登录成功！');
        // 登录成功后跳转到主页面
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        message.error('登录失败，请重试');
        onError?.(error || '企业微信登录失败');
      }
    } catch (error) {
      console.error('处理企业微信登录成功失败:', error);
      message.error('处理登录结果失败');
      onError?.('处理登录结果失败');
    }
  };

  // 直接跳转企业微信授权页面
  const handleDirectWecomLogin = async () => {
    try {
      console.log('🚀 handleDirectWecomLogin 函数被调用');
      logger.wecom('开始获取企业微信授权URL...');
      const response = await getWecomQRCode();
      console.log('📋 后端API响应:', response);
      logger.wecom('后端API响应:', response);
      
      if (!response.success) {
        logger.error('后端API返回失败:', response.error);
        throw new Error(response.error || '获取授权URL失败');
      }
      
      // 正确解析后端返回的数据结构
      const { data } = response;
      const authUrl = data?.authUrl;
      const state = data?.state;
      
      console.log('🔍 解析到的数据:', { authUrl: !!authUrl, state: !!state });
      logger.wecom('解析到的数据:', { authUrl: !!authUrl, state: !!state });
      
      if (!authUrl || !state) {
        console.error('❌ 数据不完整:', { authUrl: !!authUrl, state: !!state });
        console.error('❌ 完整响应数据:', response);
        logger.error('数据不完整:', { authUrl: !!authUrl, state: !!state });
        logger.error('完整响应数据:', response);
        throw new Error('授权URL数据不完整');
      }
      
      // 保存state到localStorage，用于后续状态监听
      localStorage.setItem('wecom_auth_state', state);
      
      console.log('🎯 跳转到企业微信授权页面:', authUrl);
      logger.wecom('跳转到企业微信授权页面:', authUrl);
      
      window.location.href = authUrl;
    } catch (error) {
      logger.error('获取授权URL失败:', error);
      const errorMessage = error instanceof Error ? error.message : '获取授权URL失败';
      message.error('授权链接生成失败，请重试');
      onError?.(errorMessage);
    }
  };

  // 检查是否有待处理的授权状态
  const checkPendingAuthState = () => {
    const pendingState = localStorage.getItem('wecom_auth_state');
    if (pendingState) {
      console.log('🔍 发现待处理的授权状态:', pendingState);
      logger.wecom('发现待处理的授权状态:', pendingState);
      
      // 开始监听授权状态
      startLongPolling(pendingState);
      
      // 清除待处理状态
      localStorage.removeItem('wecom_auth_state');
    }
  };

  // 组件挂载时自动生成二维码
  useEffect(() => {
    // 先检查是否有待处理的授权状态
    checkPendingAuthState();
    
    // 然后生成二维码
    generateQRCode();
    
    return () => {
      stopLongPolling();
    };
  }, []);

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#ff4d4f' }}>
        <Text type="danger">{error}</Text>
        <br />
        <Button 
          type="link" 
          size="small" 
          onClick={() => window.location.reload()}
        >
          刷新页面
        </Button>
      </div>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 二维码登录区域 */}
      <div style={{ textAlign: 'center' }}>
        
        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>正在生成二维码...</Text>
            </div>
          </div>
        ) : qrCodeImageUrl ? (
          <>
            <div style={{ 
              display: 'inline-block', 
              padding: '20px', 
              border: '1px solid #d9d9d9', 
              borderRadius: '12px',
              backgroundColor: '#fff',
              marginBottom: 12
            }}>
              <img 
                src={qrCodeImageUrl}
                alt="企业微信登录二维码"
                style={{ 
                  width: 200, 
                  height: 200,
                  borderRadius: '8px'
                }}
              />
            </div>
            {/* 长轮询状态指示 - 已移除 */}
          </>
        ) : (
          <div style={{ padding: '40px 0' }}>
            <Text type="secondary">二维码生成失败</Text>
            <br />
            <Button 
              type="primary" 
              onClick={generateQRCode}
              style={{ marginTop: 16 }}
            >
              重新生成
            </Button>
          </div>
        )}
      </div>

      {/* 移除分割线 */}
      
      {/* 授权登录方式 */}
      <div style={{ textAlign: 'center' }}>
        <Button
          type="default"
          icon={<WechatOutlined />}
          size="large"
          onClick={handleDirectWecomLogin}
          style={{ 
            height: 48, 
            fontSize: 16,
            borderRadius: 12,
            borderColor: '#d9d9d9',
            width: 240,
            margin: '0 auto'
          }}
        >
          企业微信授权登录
        </Button>
        <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          跳转企业微信完成授权
        </p>
      </div>
    </Space>
  );
};

export default WecomLogin;
