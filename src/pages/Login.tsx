import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { Input, Button, message, Form, Modal } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import './login.css';
import LottieLogo from '../components/LottieLogo';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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

  const handleResetPassword = async () => {
    if (!resetEmail || !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(resetEmail)) {
      message.error('请输入有效邮箱');
      return;
    }
    setResetLoading(true);
    
    try {
      // 先检查邮箱是否在 users_profile 表中存在
      const { data: profileData, error: profileError } = await supabase
        .from('users_profile')
        .select('id, email, status, user_id')
        .eq('email', resetEmail)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // 没有找到记录
          message.error('该邮箱未注册，请检查邮箱地址');
          setResetLoading(false);
          return;
        } else {
          console.error('查询用户档案失败:', profileError);
          message.error('检查邮箱时出现错误，请重试');
          setResetLoading(false);
          return;
        }
      }
      
      // 检查用户状态
      if (profileData.status === 'banned' || profileData.status === 'deleted') {
        message.error('该账号已被禁用或删除，请联系管理员');
        setResetLoading(false);
        return;
      }
      
      if (profileData.status === 'pending') {
        message.error('该邮箱尚未激活，请先激活账号');
        setResetLoading(false);
        return;
      }
      
      // 发送重置密码邮件
      const redirectTo = window.location.origin + '/set-password';
      console.log('重置密码 redirectTo:', redirectTo);
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });
      
      if (error) {
        message.error(error.message || '重置邮件发送失败');
      } else {
        message.success('重置密码邮件已发送，请查收邮箱！');
        setResetModalVisible(false);
      }
    } catch (e) {
      console.error('重置密码错误:', e);
      message.error('操作失败，请重试');
    } finally {
      setResetLoading(false);
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
        <h2 style={{ color: '#222' ,textAlign: 'left',paddingBottom: '16px'}}>欢迎回来👏</h2>
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
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Button type="link" size="small" onClick={() => setResetModalVisible(true)} style={{ padding: 0 }} className="login-btn-forgot">忘记密码？</Button>
          </div>
        </Form>
      </div>
      <Modal
        title="重置密码"
        open={resetModalVisible}
        onCancel={() => setResetModalVisible(false)}
        onOk={handleResetPassword}
        confirmLoading={resetLoading}
        okText="发送重置邮件"
        cancelText="取消"
      >
        <Input
          placeholder="请输入注册邮箱"
          value={resetEmail}
          onChange={e => setResetEmail(e.target.value)}
          onPressEnter={handleResetPassword}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default Login; 