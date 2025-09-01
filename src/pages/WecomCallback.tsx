import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Result, Spin, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supaClient';
import { toBeijingTime } from '../utils/timeUtils';

const { Text, Title } = Typography;

const WecomCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    handleWecomCallback();
  }, []);

  const handleWecomCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const appid = searchParams.get('appid');

      console.log('企业微信回调参数:', { code, state, appid });

      if (!code) {
        setStatus('error');
        setError('授权码缺失，请重新尝试企业微信登录');
        return;
      }

      // 调用企业微信认证服务
      const result = await authenticateWithWecom(code, state || '');
      
      if (result.success) {
        setStatus('success');
        setMessage('企业微信登录成功！正在跳转...');
        
        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setStatus('error');
        setError(result.error || '企业微信登录失败');
      }
    } catch (error: any) {
      console.error('处理企业微信回调失败:', error);
      setStatus('error');
      setError(error.message || '处理回调时发生错误');
    }
  };

  const authenticateWithWecom = async (code: string, state: string) => {
    try {
      // 这里应该调用后端的企业微信认证API
      // 由于我们使用的是前端直接处理，这里模拟认证流程
      
      // 1. 使用授权码获取用户信息（实际应该调用后端API）
      const userInfo = await getWecomUserInfo(code);
      
      if (!userInfo) {
        return { success: false, error: '获取企业微信用户信息失败' };
      }

      // 2. 使用用户信息进行登录
      const { success, error } = await authLogin(
        userInfo.email || `${userInfo.wechat_work_userid}@wecom.local`,
        '', // 企业微信用户不需要密码
        {
          wechat_work_userid: userInfo.wechat_work_userid,
          wechat_work_name: userInfo.wechat_work_name,
          wechat_work_mobile: userInfo.wechat_work_mobile,
          wechat_work_avatar: userInfo.wechat_work_avatar,
          wechat_work_department: userInfo.wechat_work_department,
          wechat_work_position: userInfo.wechat_work_position,
          wechat_work_corpid: import.meta.env.VITE_WECOM_CORP_ID || 'ww68a125fce698cb59'
        }
      );

      if (success) {
        return { success: true };
      } else {
        return { success: false, error };
      }
    } catch (error: any) {
      console.error('企业微信认证失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 模拟获取企业微信用户信息（实际应该调用后端API）
  const getWecomUserInfo = async (code: string) => {
    try {
      // 这里应该调用后端的企业微信API
      // 由于我们使用的是前端直接处理，这里返回模拟数据
      
      // 实际项目中，应该调用类似这样的API：
      // const response = await fetch('/api/wecom/auth', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ code })
      // });
      // const data = await response.json();
      // return data.userInfo;

      // 模拟用户信息
      return {
        wechat_work_userid: `wecom_${toBeijingTime(new Date()).valueOf()}`,
        wechat_work_name: '企业微信用户',
        wechat_work_mobile: '13800138000',
        wechat_work_avatar: '',
        wechat_work_department: '技术部',
        wechat_work_position: '员工',
        email: `wecom_${toBeijingTime(new Date()).valueOf()}@wecom.local`
      };
    } catch (error) {
      console.error('获取企业微信用户信息失败:', error);
      return null;
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
