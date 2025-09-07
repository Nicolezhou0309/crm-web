import React, { useState, useEffect } from 'react';
import { Button, message, Typography, Space, Spin } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { getWecomAuthUrl, getWecomQRCode, checkWecomLoginStatus } from '../api/wecomAuthApi';

const { Text } = Typography;

interface WecomLoginProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: string) => void;
}

const WecomLogin: React.FC<WecomLoginProps> = ({ onError }) => {
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeState, setQrCodeState] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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

  // 从后端获取二维码
  const generateQRCode = async () => {
    setLoading(true);
    try {
      const response = await getWecomQRCode();
      if (!response.success) {
        throw new Error(response.error || '获取二维码失败');
      }
      
      const { authUrl, state } = response.data || {};
      if (!authUrl || !state) {
        throw new Error('二维码数据不完整');
      }
      
      setQrCodeData(authUrl);
      setQrCodeState(state);
      
      // 开始轮询二维码状态
      startPolling(state);
      
      message.success('二维码生成成功，请使用企业微信扫码登录');
    } catch (error) {
      message.error('生成二维码失败，请重试');
      onError?.('生成二维码失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始轮询二维码状态
  const startPolling = (state: string) => {
    setPolling(true);
    
    const interval = setInterval(async () => {
      try {
        const response = await checkWecomLoginStatus(state);
        
        if (response.success && response.data?.userInfo) {
          // 扫码成功，处理用户信息
          handleWecomLoginSuccess(response.data.userInfo);
          stopPolling();
        } else if (response.error) {
          console.error('检查二维码状态失败:', response.error);
          stopPolling();
        }
        
      } catch (error) {
        console.error('检查二维码状态失败:', error);
      }
    }, 2000); // 每2秒检查一次
    
    setPollingInterval(interval);
  };

  // 停止轮询
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setPolling(false);
  };

  // 处理企业微信登录成功
  const handleWecomLoginSuccess = async (userInfo: any) => {
    try {
      if (!authLogin) {
        throw new Error('认证服务未初始化');
      }

      const { success, error } = await authLogin(
        userInfo.email,
        '', // 企业微信用户不需要密码
        {
          wechat_work_userid: userInfo.UserId,
          wechat_work_name: userInfo.name,
          wechat_work_mobile: userInfo.mobile,
          wechat_work_avatar: userInfo.avatar || '',
          wechat_work_department: userInfo.department,
          wechat_work_position: userInfo.position,
          wechat_work_corpid: userInfo.corpId
        }
      );

      if (success) {
        message.success('企业微信登录成功！');
        // 登录成功后的处理逻辑
      } else {
        message.error(error || '企业微信登录失败');
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
      const response = await getWecomQRCode();
      if (!response.success) {
        throw new Error(response.error || '获取授权URL失败');
      }
      
      const { authUrl } = response.data || {};
      if (!authUrl) {
        throw new Error('授权URL数据不完整');
      }
      
      window.location.href = authUrl;
    } catch (error) {
      message.error('生成授权链接失败，请重试');
    }
  };

  // 组件挂载时自动生成二维码
  useEffect(() => {
    generateQRCode();
    
    return () => {
      stopPolling();
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
        ) : qrCodeData ? (
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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}`}
                alt="企业微信登录二维码"
                style={{ 
                  width: 200, 
                  height: 200,
                  borderRadius: '8px'
                }}
              />
            </div>
            
            {/* 移除二维码状态文案 */}
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
