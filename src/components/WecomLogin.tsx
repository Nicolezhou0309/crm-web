import React, { useState, useEffect } from 'react';
import { Button, message, Typography, Space, Spin } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';


const { Text } = Typography;

interface WecomLoginProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: string) => void;
}

const WecomLogin: React.FC<WecomLoginProps> = ({ onError }) => {
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [_qrCodeState, setQrCodeState] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [_polling, setPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 安全地获取 useAuth 和 useNavigate
  let authLogin: any = null;
  
  try {
    const auth = useAuth();
    authLogin = auth.login;
  } catch (err) {
    console.error('WecomLogin: 初始化认证或导航失败:', err);
    setError('组件初始化失败');
  }

  // 企业微信配置
  const wecomConfig = {
    corpId: import.meta.env.VITE_WECOM_CORP_ID,
    agentId: import.meta.env.VITE_WECOM_AGENT_ID,
    redirectUri: import.meta.env.VITE_WECOM_REDIRECT_URI || window.location.origin + '/auth/wecom/callback',
    scope: 'snsapi_privateinfo'
  };

  // 生成企业微信授权URL
  const generateWecomAuthUrl = () => {
    try {
      const state = 'wecom_auth_' + Date.now();
      const params = new URLSearchParams({
        appid: wecomConfig.corpId,
        redirect_uri: encodeURIComponent(wecomConfig.redirectUri),
        response_type: 'code',
        scope: wecomConfig.scope,
        state: state,
        agentid: wecomConfig.agentId
      });
      
      return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
    } catch (err) {
      console.error('生成企业微信授权URL失败:', err);
      throw new Error('生成授权URL失败');
    }
  };

  // 生成二维码
  const generateQRCode = async () => {
    if (!authLogin) {
      message.error('认证服务未初始化，请刷新页面重试');
      return;
    }

    setLoading(true);
    try {
      // 生成企业微信授权URL
      const authUrl = generateWecomAuthUrl();
      const state = 'qrcode_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
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
        // 这里应该调用后端API检查二维码状态
        // 由于我们使用的是企业微信OAuth流程，这里简化处理
        // 实际应该调用 /auth/wecom/qrcode/status 接口
        
        // 模拟检查状态（实际项目中需要实现）
        console.log('检查二维码状态:', state);
        
        // 模拟扫码成功的情况（实际项目中需要根据后端返回状态判断）
        // 这里只是示例，实际应该根据真实的API响应来判断
        // if (扫码成功) {
        //   handleWecomLoginSuccess(userInfo);
        //   stopPolling();
        // }
        
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

  // 刷新二维码

  // 直接跳转企业微信授权页面
  const handleDirectWecomLogin = () => {
    try {
      const authUrl = generateWecomAuthUrl();
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
