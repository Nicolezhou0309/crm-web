import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { Input, Button, message, Form } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import './login.css';
import LottieLogo from '../components/LottieLogo';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {});
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && !userLoading) {
      navigate('/');
    }
  }, [user, userLoading, navigate]);

  const handleLogin = async (values: any) => {
    setLoading(true);
    const { email, password } = values;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        if (error.code === 'user_banned') {
          message.error('您的账号已被禁用或离职，如有疑问请联系管理员');
        } else if (error.message === 'Invalid login credentials') {
          message.error('账号或密码错误，请重新输入');
        } else {
          message.error(error.message);
        }
      } else {
        message.success('登录成功！');
      }
    } catch (e) {
      setLoading(false);
      message.error('登录异常，请重试');
    }
  };

  if (userLoading) {
    return (
      <div className="login-bg">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>正在加载用户信息...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="login-bg">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>登录成功，正在跳转...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      {/* 左上角logo和标题 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 32,
          display: 'flex',
          alignItems: 'center',
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        <LottieLogo width={32} height={32} />
        <img
          src="/VLINKER.svg"
          alt="VLINKER"
          style={{ height: 28, marginLeft: 4, verticalAlign: 'middle' }}
          onError={e => (e.currentTarget.style.display = 'none')}
        />
      </div>
      <div className="login-card">
        <h2>邮箱登录</h2>
        <Form onFinish={handleLogin} layout="vertical" style={{ width: '100%' }}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { pattern: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, message: '请输入有效邮箱' }
            ]}
            style={{ marginBottom: 24 }}
          >
            <Input autoComplete="username" prefix={<MailOutlined />} placeholder="请输入邮箱" />
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
            style={{ marginBottom: 8 }}
          >
            <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block className="login-btn">立即登录</Button>
        </Form>
      </div>
    </div>
  );
};

export default Login; 