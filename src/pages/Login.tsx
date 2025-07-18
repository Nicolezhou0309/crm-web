import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { Input, Button, message, Tabs, Form } from 'antd';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  // 如果用户已登录，自动跳转到首页
  useEffect(() => {
    if (user && !userLoading) {
      navigate('/');
    }
  }, [user, userLoading, navigate]);

  // 注册
  const handleRegister = async (values: any) => {
    setLoading(true);
    const { email, password, name } = values;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    setLoading(false);
    if (error) {
      if (
        error.message.includes('User already registered') ||
        error.message.includes('already registered') ||
        error.message.includes('already exists')
      ) {
        message.error('该邮箱已注册，请直接登录或找回密码');
      } else {
        message.error(error.message);
      }
    } else {
      message.success('注册成功，请查收激活邮件！');
    }
  };

  // 登录
  const handleLogin = async (values: any) => {
    setLoading(true);
    const { email, password } = values;
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
      // 登录成功后，UserContext 会自动更新用户状态，然后 useEffect 会跳转到首页
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
        <Tabs
          defaultActiveKey="login"
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
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
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[
                      { required: true, min: 6, message: '密码至少6位' }
                    ]}
                    style={{ marginBottom: 24 }}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block> 登录 </Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={handleRegister} layout="vertical">
                  <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} style={{ marginBottom: 24 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label="邮箱" rules={[
                    { required: true, message: '请输入邮箱' },
                    { pattern: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, message: '请输入有效邮箱' }
                  ]} style={{ marginBottom: 24 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]} style={{ marginBottom: 24 }}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block> 注册 </Button>
                </Form>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Login; 