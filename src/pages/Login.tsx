import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, message, Form, Modal, Tabs, Divider } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, GiftOutlined } from '@ant-design/icons';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import './login.css';
import LottieLogo from '../components/LottieLogo';
import LoadingScreen from '../components/LoadingScreen';
import { tokenManager } from '../utils/tokenManager';
import { supabase } from '../supaClient';
import WecomLogin from '../components/WecomLogin';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { user, loading: userLoading } = useUser();
  const { isAuthenticated, login: authLogin } = useAuth();
  const navigate = useNavigate();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    // 使用统一的认证Hook进行跳转逻辑
    console.log('Login useEffect - isAuthenticated:', isAuthenticated, 'userLoading:', userLoading, 'hasNavigated:', hasNavigated.current);
    
    if (isAuthenticated && !userLoading && !hasNavigated.current) {
      console.log('触发登录成功跳转');
      // 立即跳转，减少延迟
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, userLoading, navigate]);

  // 从 localStorage 获取失败计数
  const getLoginAttempts = (email: string) => {
    const attempts = localStorage.getItem(`login_attempts_${email}`);
    return attempts ? JSON.parse(attempts) : { count: 0, blockedUntil: null };
  };

  // 保存失败计数到 localStorage
  const saveLoginAttempts = (email: string, attempts: any) => {
    localStorage.setItem(`login_attempts_${email}`, JSON.stringify(attempts));
  };

  // 检查是否被锁定
  const isAccountBlocked = (email: string) => {
    const attempts = getLoginAttempts(email);
    if (attempts.blockedUntil && new Date() < new Date(attempts.blockedUntil)) {
      return true;
    }
    // 如果锁定时间已过，清除锁定状态
    if (attempts.blockedUntil && new Date() >= new Date(attempts.blockedUntil)) {
      saveLoginAttempts(email, { count: 0, blockedUntil: null });
    }
    return false;
  };

  const handleLogin = async (values: any) => {
    const { email, password } = values;
    
    // 检查账户是否被锁定
    if (isAccountBlocked(email)) {
      const attempts = getLoginAttempts(email);
      const remainingTime = Math.ceil((new Date(attempts.blockedUntil).getTime() - Date.now()) / 1000 / 60);
      message.error(`账户已被临时锁定，请${remainingTime}分钟后再试`);
      return;
    }

    setLoading(true);
    try {
      // 使用统一的认证Hook进行登录
      const { success, error } = await authLogin(email, password);
      
      if (!success) {
        // 增加失败计数
        const attempts = getLoginAttempts(email);
        attempts.count += 1;
        
        // 保留原有的错误处理逻辑
        if (error && error.includes('user_banned')) {
          message.error('您的账号已被禁用或离职，如有疑问请联系管理员');
        } else if (error && error.includes('Invalid login credentials')) {
          message.error('账号或密码错误，请重新输入');
        } else {
          message.error(error || '登录失败');
        }
        
        // 如果失败次数达到5次，锁定账户15分钟
        if (attempts.count >= 5) {
          attempts.blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          message.error('登录失败次数过多，账户已被临时锁定15分钟');
        } else {
          // 显示剩余尝试次数（仅在密码错误时）
          if (error && error.includes('Invalid login credentials')) {
            message.error(`账号或密码错误，还可尝试${5 - attempts.count}次`);
          }
        }
        
        saveLoginAttempts(email, attempts);
      } else {
        // 登录成功，清除失败计数
        saveLoginAttempts(email, { count: 0, blockedUntil: null });
        message.success('登录成功！正在跳转...');
        
        console.log('登录成功，等待状态更新和跳转...');
        console.log('当前状态 - user:', user, 'userLoading:', userLoading, 'isAuthenticated:', isAuthenticated);
        // 登录成功后，让UserContext的认证状态监听器自动处理用户状态更新和重定向
      }
    } catch (e) {
      message.error('登录异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    const { email, password, confirmPassword, fullName, inviteCode } = values;
    
    if (password !== confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    // 验证邀请码
    if (!inviteCode || inviteCode !== 'vlinker567') {
      message.error('邀请码错误，请输入正确的邀请码');
      return;
    }

    setRegisterLoading(true);
    try {
      // 使用阿里云Supabase进行用户注册
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          message.error('该邮箱已注册，请直接登录');
        } else if (error.message.includes('Password should be at least')) {
          message.error('密码长度不足，请确保密码至少6位');
        } else {
          message.error(`注册失败: ${error.message}`);
        }
      } else {
        message.success('注册成功！请查收邮箱完成账号激活');
        // 注册成功后切换到登录页
        setActiveTab('login');
        // 清空注册表单
        message.info('请使用注册的邮箱和密码登录');
      }
    } catch (error: any) {
      message.error(`注册异常: ${error.message}`);
    } finally {
      setRegisterLoading(false);
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
      // 重置密码 redirectTo: redirectTo
      const { error } = await tokenManager.resetPasswordForEmail(resetEmail, redirectTo);
      
      if (error) {
        message.error(error instanceof Error ? error.message : '重置邮件发送失败');
      } else {
        message.success('重置密码邮件已发送，请查收邮箱！');
        setResetModalVisible(false);
      }
    } catch (error: any) {
      message.error('重置密码失败: ' + error.message);
    } finally {
      setResetLoading(false);
    }
  };

  // 处理企业微信登录成功
  const handleWecomLoginSuccess = (userInfo: any) => {
    console.log('企业微信登录成功:', userInfo);
    message.success('企业微信登录成功！');
    // 登录成功后的处理由WecomLogin组件内部完成
  };

  // 处理企业微信登录错误
  const handleWecomLoginError = (error: string) => {
    console.error('企业微信登录失败:', error);
    message.error(`企业微信登录失败: ${error}`);
  };

  // 显示LoadingScreen的情况：
  // 1. 用户正在加载
  // 2. 用户已存在（登录成功，正在跳转）
  // 3. 正在登录中
  if (userLoading || user || loading) {
    const message = user 
      ? "登录成功，正在跳转..." 
      : loading 
        ? "正在验证登录信息..." 
        : "正在加载用户信息...";
    
    const subtitle = user 
      ? "正在为您跳转到主页面" 
      : loading 
        ? "请稍候，我们正在验证您的身份" 
        : "请稍候，我们正在为您准备登录环境";
    
    return <LoadingScreen type="auth" message={message} subtitle={subtitle} />;
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
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          centered
          style={{ marginBottom: 24 }}
        >
          <TabPane tab="登录" key="login">
            <h2 style={{ color: '#222', textAlign: 'left', paddingBottom: '16px' }}>欢迎回来👏</h2>
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
          </TabPane>
          
          <TabPane tab="注册" key="register">
            <h2 style={{ color: '#222', textAlign: 'left', paddingBottom: '16px' }}>创建新账号🚀</h2>
            <Form onFinish={handleRegister} layout="vertical" style={{ width: '100%' }}>
              <Form.Item
                name="fullName"
                label="姓名"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { min: 2, message: '姓名至少2个字符' }
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入真实姓名" />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { pattern: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, message: '请输入有效邮箱' }
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
              </Form.Item>
              
              <Form.Item
                name="inviteCode"
                label="邀请码"
                rules={[
                  { required: true, message: '请输入邀请码' },
                  { min: 6, message: '邀请码至少6位' }
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input prefix={<GiftOutlined />} placeholder="请输入邀请码" />
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
                style={{ marginBottom: 16 }}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
              </Form.Item>
              
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                rules={[
                  { required: true, message: '请确认密码' },
                  { min: 6, message: '密码至少6位' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                      },
                    }),
                ]}
                style={{ marginBottom: 8 }}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
              </Form.Item>
              
              <Button type="primary" htmlType="submit" loading={registerLoading} block className="login-btn">立即注册</Button>
              
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <span style={{ color: '#666' }}>已有账号？</span>
                <Button type="link" size="small" onClick={() => setActiveTab('login')} style={{ padding: 0 }}>
                  立即登录
                </Button>
              </div>
            </Form>
          </TabPane>
          
          <TabPane tab="企业微信" key="wecom">
            <h2 style={{ color: '#222', textAlign: 'left', paddingBottom: '16px' }}>企业微信登录🔐</h2>
            
            <WecomLogin 
              onSuccess={handleWecomLoginSuccess}
              onError={handleWecomLoginError}
            />
          </TabPane>
        </Tabs>
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