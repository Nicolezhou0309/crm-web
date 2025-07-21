import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { Input, Button, message, Form } from 'antd';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  // 详细日志：监听session变化
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[LOGIN][AuthStateChange]', event, session);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // 如果用户已登录，自动跳转到首页
  useEffect(() => {
    if (user && !userLoading) {
      console.log('[LOGIN] 已检测到用户，自动跳转首页', user);
      navigate('/');
    }
  }, [user, userLoading, navigate]);

  // 登录
  const handleLogin = async (values: any) => {
    setLoading(true);
    const { email, password } = values;
    console.log('[LOGIN] 登录请求参数', { email, password });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      console.log('[LOGIN] 登录返回', { data, error });
      if (error) {
        if (error.code === 'user_banned') {
          message.error('您的账号已被禁用或离职，如有疑问请联系管理员');
        } else if (error.message === 'Invalid login credentials') {
          message.error('账号或密码错误，请重新输入');
        } else {
          message.error(error.message);
        }
        console.error('[LOGIN] 登录失败', error);
      } else {
        message.success('登录成功！');
        // 登录成功后，UserContext 会自动更新用户状态，然后 useEffect 会跳转到首页
      }
    } catch (e) {
      setLoading(false);
      message.error('登录异常，请重试');
      console.error('[LOGIN] 登录异常', e);
    }
  };

  // 如果正在加载用户信息，显示加载状态
  if (userLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f8fa'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>正在加载用户信息...</div>
        </div>
      </div>
    );
  }

  // 如果用户已登录，显示跳转中
  if (user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f8fa'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>登录成功，正在跳转...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f8fa'
      }}
    >
      <div
        style={{
          maxWidth: 360,
          width: '100%',
          background: '#fff',
          padding: 32,
          borderRadius: 12,
          boxShadow: '0 2px 8px #eee'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ margin: 0, color: '#1890ff' }}>用户登录</h2>
        </div>
        <Form onFinish={handleLogin} layout="vertical">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { pattern: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, message: '请输入有效邮箱' }
            ]}
            style={{ marginBottom: 24 }}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
              { 
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 
                message: '密码必须包含大小写字母和数字' 
              }
            ]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block> 登录 </Button>
        </Form>
      </div>
    </div>
  );
};

export default Login; 