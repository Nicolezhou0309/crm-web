import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Result, Spin, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { handleWecomCallbackPost } from '../api/wecomAuthApi';

const { Text, Title } = Typography;

const WecomCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    handleWecomCallbackProcess();
  }, []);

  const handleWecomCallbackProcess = async () => {
    try {
      console.log('=== 企业微信回调处理开始 ===');
      console.log('当前URL:', window.location.href);
      console.log('URL参数:', window.location.search);
      
      // 获取企业微信回调参数
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      console.log('解析到的参数:', { code, state, errorParam });

      if (errorParam) {
        console.error('企业微信回调包含错误参数:', errorParam);
        setStatus('error');
        setError(decodeURIComponent(errorParam));
        return;
      }

      if (!code || !state) {
        console.error('缺少必要的授权参数:', { code: !!code, state: !!state });
        setStatus('error');
        setError('缺少必要的授权参数');
        return;
      }

      console.log('开始调用后端API处理企业微信回调...');
      // 调用后端API处理企业微信回调（使用POST方法）
      const response = await handleWecomCallbackPost({ code, state });

      console.log('后端API响应:', response);

      if (!response.success) {
        console.error('后端API返回失败:', response.error);
        setStatus('error');
        setError(response.error || '企业微信认证失败');
        return;
      }

      const { userInfo } = response.data || {};
      if (!userInfo) {
        console.error('后端返回的用户信息为空');
        setStatus('error');
        setError('获取用户信息失败');
        return;
      }

      console.log('企业微信用户信息:', userInfo);
      
      console.log('开始使用用户信息进行登录...');
      // 直接使用后端返回的完整用户信息进行登录
      const { success, error } = await authLogin(
        userInfo.email,
        '', // 企业微信用户不需要密码
        userInfo // 传入完整的用户信息，包含会话数据
      );

      console.log('登录结果:', { success, error });

      if (success) {
        console.log('企业微信登录成功！');
        setStatus('success');
        setMessage('企业微信登录成功！正在跳转...');
        
        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        console.error('企业微信登录失败:', error);
        setStatus('error');
        setError(error || '企业微信登录失败');
      }
    } catch (error: any) {
      console.error('处理企业微信回调失败:', error);
      setStatus('error');
      setError(error.message || '处理回调时发生错误');
    }
  };


  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <div style={{ marginTop: 24 }}>
              <Title level={4}>正在处理企业微信登录...</Title>
              <Text type="secondary">请稍候，我们正在验证您的身份</Text>
            </div>
          </div>
        );
      
      case 'success':
        return (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            status="success"
            title="企业微信登录成功！"
            subTitle={message}
            extra={[
              <Text key="redirect" type="secondary">
                正在为您跳转到主页面...
              </Text>
            ]}
          />
        );
      
      case 'error':
        return (
          <Result
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            status="error"
            title="企业微信登录失败"
            subTitle={error}
            extra={[
              <Text key="retry" type="secondary">
                请返回登录页面重新尝试
              </Text>
            ]}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ 
        maxWidth: 500, 
        width: '100%', 
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        {renderContent()}
        
        {status === 'error' && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              返回登录页面
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WecomCallback;
