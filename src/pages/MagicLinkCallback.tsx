import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Result, Button, Spin, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';

const MagicLinkCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [messageText, setMessageText] = useState<string>('正在处理Magic Link登录...');

  console.log('🎯 MagicLinkCallback组件已加载');
  console.log('📍 当前状态:', status);
  console.log('📍 消息文本:', messageText);

  useEffect(() => {
    const handleMagicLinkCallback = async () => {
      try {
        console.log('🔗 开始处理Magic Link回调...');
        console.log('📍 当前URL:', window.location.href);
        console.log('📍 当前路径:', window.location.pathname);
        console.log('📍 查询参数:', window.location.search);
        
        // 获取URL参数 - 真实Magic Link使用hash参数
        let accessToken, refreshToken, email, type;
        
        // 检查是否有hash参数（真实Magic Link）
        if (window.location.hash) {
          console.log('🔍 检测到hash参数，使用真实Magic Link流程');
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          email = hashParams.get('email');
          type = hashParams.get('type');
        } else {
          console.log('🔍 使用查询参数，可能是测试链接');
          // 检查查询参数（测试链接）
          accessToken = searchParams.get('access_token');
          refreshToken = searchParams.get('refresh_token');
          email = searchParams.get('email');
          type = searchParams.get('type');
        }

        console.log('📋 Magic Link回调参数:');
        console.log('- access_token:', accessToken ? `已提供 (${accessToken.substring(0, 20)}...)` : '未提供');
        console.log('- refresh_token:', refreshToken ? `已提供 (${refreshToken.substring(0, 20)}...)` : '未提供');
        console.log('- email:', email);
        console.log('- type:', type);
        console.log('- 所有参数:', Object.fromEntries(searchParams.entries()));

        if (!accessToken || !refreshToken) {
          console.error('❌ 缺少必要的认证参数');
          console.error('- accessToken存在:', !!accessToken);
          console.error('- refreshToken存在:', !!refreshToken);
          setStatus('error');
          setMessageText('缺少必要的认证参数，请重新发送Magic Link');
          return;
        }

        if (type !== 'magiclink') {
          console.warn('⚠️ 非Magic Link类型:', type);
        }

        console.log('🔐 开始设置会话...');
        
        // 检查token类型
        const isMockToken = accessToken && (accessToken.startsWith('mock_token_') || accessToken.startsWith('debug_token_'));
        const isCustomToken = accessToken && accessToken.startsWith('custom_');
        console.log('🔍 Token类型检查:');
        console.log('- accessToken前缀:', accessToken ? accessToken.substring(0, 20) : '无');
        console.log('- 是否为模拟token:', isMockToken);
        console.log('- 是否为自定义token:', isCustomToken);
        
        if (isMockToken) {
          console.log('⚠️ 检测到模拟token，使用模拟登录流程');
          console.log('📧 用户邮箱:', email);
          console.log('🔄 设置状态为成功...');
          
          // 模拟登录成功
          setStatus('success');
          setMessageText('Magic Link登录成功！正在跳转...');
          console.log('✅ 状态已设置为成功');
          
          console.log('✅ 模拟Magic Link登录成功!');
          console.log('⏰ 2秒后跳转到主页面...');
          
          // 延迟跳转，让用户看到成功消息
          setTimeout(() => {
            console.log('🚀 开始跳转到主页面...');
            navigate('/', { replace: true });
          }, 2000);
          
          return;
        }
        
        // 真实token的处理
        console.log('🔐 使用真实Supabase token设置会话...');
        
        // 真实token的处理
        console.log('🔐 使用真实token设置Supabase会话...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('❌ 设置会话失败:', error);
          console.error('错误详情:', error.message);
          setStatus('error');
          setMessageText(`登录失败: ${error.message}`);
          return;
        }

        if (!data.session) {
          console.error('❌ 会话创建失败');
          console.error('返回数据:', data);
          setStatus('error');
          setMessageText('会话创建失败，请重试');
          return;
        }

        console.log('✅ Magic Link登录成功!');
        console.log('用户信息:', data.user);
        console.log('会话信息:', data.session);
        
        setStatus('success');
        setMessageText('Magic Link登录成功！正在跳转...');

        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          console.log('🚀 开始跳转到主页面...');
          navigate('/', { replace: true });
        }, 2000);

      } catch (error) {
        console.error('❌ Magic Link回调处理异常:', error);
        console.error('异常堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
        setStatus('error');
        setMessageText(`处理异常: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };

    console.log('🚀 开始执行Magic Link回调处理...');
    handleMagicLinkCallback();
  }, [navigate, searchParams]);

  const handleRetry = () => {
    navigate('/login', { replace: true });
  };

  const handleClose = () => {
    window.close();
  };

  if (status === 'loading') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <Spin 
          indicator={<LoadingOutlined style={{ fontSize: 48, color: 'white' }} spin />} 
          size="large"
        />
        <div style={{ marginTop: 24, fontSize: 18, fontWeight: 500 }}>
          {messageText}
        </div>
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>
          请稍候，系统正在验证您的身份
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white'
      }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          登录成功！
        </div>
        <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 32 }}>
          {messageText}
        </div>
        <Button 
          type="primary" 
          size="large"
          onClick={() => navigate('/', { replace: true })}
          style={{ 
            background: '#52c41a', 
            borderColor: '#52c41a',
            borderRadius: 8,
            height: 40,
            paddingLeft: 24,
            paddingRight: 24
          }}
        >
          进入系统
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        color: 'white'
      }}>
        <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          登录失败
        </div>
        <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 32, textAlign: 'center', maxWidth: 400 }}>
          {messageText}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Button 
            type="primary" 
            size="large"
            onClick={handleRetry}
            style={{ 
              background: '#1890ff', 
              borderColor: '#1890ff',
              borderRadius: 8,
              height: 40,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            重新登录
          </Button>
          <Button 
            size="large"
            onClick={handleClose}
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              borderColor: 'rgba(255,255,255,0.3)',
              color: 'white',
              borderRadius: 8,
              height: 40,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            关闭窗口
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default MagicLinkCallback;
