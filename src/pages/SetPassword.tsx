import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography, Spin, Alert } from 'antd';
import { LockOutlined, MailOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const SetPassword: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [accessToken] = useState<string>('');
  const [inviteData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // ====== 日志增强：页面初始信息 ======
    console.log('【SetPassword】页面初始 window.location.href:', window.location.href);
    console.log('【SetPassword】页面初始 window.location.hash:', window.location.hash);
    console.log('【SetPassword】页面初始 window.location.search:', window.location.search);
    console.log('【SetPassword】页面初始 document.referrer:', document.referrer);
    // hash 解析
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      console.log('【SetPassword】页面初始 hashParams:', Object.fromEntries(hashParams.entries()));
    } else {
      console.log('【SetPassword】页面初始 hashParams: 无 hash');
    }
    // ====== 日志增强结束 ======
    handleInviteFlow();
  }, []);

  // 处理邀请流程 - 前端拦截，阻止自动登录
  const handleInviteFlow = async () => {
    try {
      setVerifying(true);
      console.log('🔍 [SetPassword] 开始处理邀请流程...');
      console.log('🔍 [SetPassword] 当前URL:', window.location.href);
      // 2. 从URL中提取token和参数（兼容search和hash）
      const urlParams = new URLSearchParams(window.location.search);
      const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
      console.log('🔍 [SetPassword] urlParams:', Object.fromEntries(urlParams.entries()));
      console.log('🔍 [SetPassword] fragmentParams:', Object.fromEntries(fragmentParams.entries()));
      console.log('🔍 [SetPassword] window.location.hash:', window.location.hash);
      console.log('🔍 [SetPassword] window.location.search:', window.location.search);
      // 检查错误信息
      const error = urlParams.get('error') || fragmentParams.get('error');
      const errorDescription = urlParams.get('error_description') || fragmentParams.get('error_description');
      if (error) {
        console.error('❌ [SetPassword] URL中包含错误信息:', { error, errorDescription });
        handleInviteError(error, errorDescription || undefined);
        return;
      }
      // 提取token、type、email
      let token = urlParams.get('token') || urlParams.get('access_token') || fragmentParams.get('access_token') || fragmentParams.get('token');
      let tokenType = urlParams.get('type') || fragmentParams.get('type');
      let email = urlParams.get('email') || fragmentParams.get('email');
      console.log('🔍 [SetPassword] 提取到的token:', token);
      console.log('🔍 [SetPassword] 提取到的tokenType:', tokenType);
      console.log('🔍 [SetPassword] 提取到的email:', email);
      // 检查token
      if (!token) {
        message.error('未找到有效的邀请令牌，请重新获取邀请邮件或联系管理员。');
        setTimeout(() => {
          console.log('[SetPassword] 自动跳转到 /login（未找到token）');
          navigate('/login');
        }, 1500);
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      // 检查session
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 [SetPassword] supabase.auth.getUser() 返回:', user);
      if (!user && token && tokenType === 'recovery' && email) {
        // 主动用 token 登录
        console.log('🔍 [SetPassword] session 不存在，调用 verifyOtp 登录...');
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          type: 'recovery',
          token,
        });
        if (error) {
          console.error('❌ [SetPassword] verifyOtp 错误:', error);
          handleInviteError(error.message || '链接已失效或已被使用');
          setTokenValid(false);
          setVerifying(false);
          return;
        }
        setUserInfo(data.user);
        setTokenValid(true);
        setVerifying(false);
        return;
      }
      if (user) {
        setUserInfo(user);
        setTokenValid(true);
        setVerifying(false);
        return;
      }
      // 兜底
      setTokenValid(false);
      setVerifying(false);
    } catch (e: any) {
      console.error('❌ [SetPassword] handleInviteFlow 异常:', e);
      setTokenValid(false);
      setVerifying(false);
    }
  };

  // 处理自定义邀请

  // 处理Supabase标准邀请

  // 处理邀请错误
  const handleInviteError = (error: string, errorDescription?: string) => {
    let errorMessage = '邀请链接验证失败';
    
    if (error === 'server_error' || error === 'unexpected_failure') {
      errorMessage = '邀请链接验证失败，可能是链接已过期或无效。请联系管理员重新发送邀请。';
    } else if (error === 'access_denied' && errorDescription?.includes('expired')) {
      errorMessage = '邀请链接已过期，请联系管理员重新发送邀请。';
    } else if (error === 'access_denied') {
      errorMessage = '邀请链接无效或已被使用，请联系管理员重新发送邀请。';
    } else {
      errorMessage = `邀请验证失败: ${errorDescription || error}`;
    }
    
    message.error(errorMessage);
    setTokenValid(false);
    setVerifying(false);
  };

  // 设置密码
  const handleSetPassword = async (values: any) => {
    try {
      setLoading(true);
      const { password } = values;
      
      console.log('🔑 [SetPassword] 开始设置密码...');
      
      if (!accessToken) {
        message.error('访问令牌无效，请重新获取邀请链接');
        return;
      }
      
      // 检查是否为自定义邀请
      const urlParams = new URLSearchParams(window.location.search);
      const tokenType = urlParams.get('type');
      
      if (tokenType === 'custom_invite') {
        await handleCustomInvitePassword(password);
      } else {
        await handleSupabaseInvitePassword(password);
      }
      // 设置成功后清理localStorage
      // localStorage.removeItem('invite_token'); // 移除
      // localStorage.removeItem('invite_token_type'); // 移除
    } catch (error: any) {
      console.error('❌ [SetPassword] 密码设置异常:', error);
      message.error('密码设置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 处理自定义邀请密码设置
  const handleCustomInvitePassword = async (password: string) => {
    try {
      console.log('🔑 [SetPassword] 处理自定义邀请密码设置...');
      if (!inviteData) {
        message.error('邀请数据无效');
        return;
      }
      // 创建用户账户
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteData.email,
        password: password,
        options: {
          data: {
            name: inviteData.email.split('@')[0],
            organization_id: inviteData.organization_id,
            organization_name: inviteData.organization_name,
            password_set: true,
            password_set_at: new Date().toISOString()
          }
        }
      });
      if (signUpError) {
        console.error('❌ [SetPassword] 用户注册失败:', signUpError);
        message.error('账户创建失败: ' + signUpError.message);
        return;
      }
      console.log('✅ [SetPassword] 用户注册成功:', signUpData.user?.email);
      // 更新用户档案状态
      const { error: updateError } = await supabase
        .from('users_profile')
        .update({ 
          status: 'active',
          user_id: signUpData.user?.id
        })
        .eq('email', inviteData.email);
      if (updateError) {
        console.error('❌ [SetPassword] 更新用户档案失败:', updateError);
        // 不阻止流程，因为用户已创建成功
      }
      // 自动调用activate-user函数
      try {
        console.log('🚀 [SetPassword] 即将调用activate-user函数...');
        const res = await fetch('/functions/v1/activate-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteData.email,
            user_id: signUpData.user?.id,
            template_type: 'welcome',
            template_vars: { name: inviteData.email.split('@')[0] }
          })
        });
        console.log('🚀 [SetPassword] activate-user响应状态:', res.status);
        const result = await res.json();
        console.log('🚀 [SetPassword] activate-user响应内容:', result);
        if (result.success) {
          message.success('账户已激活，正在登录...');
          // 自动登录
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email: inviteData.email,
            password
          });
          if (loginError) {
            message.error('自动登录失败，请手动登录');
            setCompleted(true);
            setTimeout(() => navigate('/login'), 2000);
            return;
          }
          setCompleted(true);
          setTimeout(() => navigate('/'), 2000);
        } else {
          message.warning(result.error || '账户已创建，但激活通知失败');
        }
      } catch (e) {
        console.error('❌ [SetPassword] 调用activate-user异常:', e);
        message.warning('账户已创建，但激活通知失败');
      }
      // setCompleted(true); // 移除原有跳转逻辑
      // setTimeout(() => {
      //   navigate('/');
      // }, 2000);
    } catch (error) {
      console.error('❌ [SetPassword] 自定义邀请处理失败:', error);
      message.error('密码设置失败，请重试');
    }
  };

  // 处理Supabase邀请密码设置
  const handleSupabaseInvitePassword = async (password: string) => {
    try {
      console.log('🔑 [SetPassword] 处理Supabase邀请密码设置...');
      console.log('🔑 [SetPassword] 当前userInfo:', userInfo);
      // 使用管理员API更新用户密码
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true,
          password_set_at: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ [SetPassword] 密码设置失败:', error);
        message.error('密码设置失败: ' + error.message);
        return;
      }

      console.log('✅ [SetPassword] 密码设置成功');
      message.success('密码设置成功！正在登录...');
      // 自动登录
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: userInfo.email,
        password
      });
      if (loginError) {
        console.error('❌ [SetPassword] 自动登录失败:', loginError);
        message.error('自动登录失败，请手动登录');
        setCompleted(true);
        setTimeout(() => {
          console.log('[SetPassword] 自动跳转到 /login（自动登录失败）');
          navigate('/login');
        }, 2000);
        return;
      }
      setCompleted(true);
      setTimeout(() => {
        console.log('[SetPassword] 自动跳转到 /（设置密码成功）');
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('❌ [SetPassword] Supabase邀请处理失败:', error);
      message.error('密码设置失败，请重试');
    }
  };

  // 加载中状态
  if (verifying) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f7f8fa'
      }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>正在验证邀请链接...</Text>
          </div>
        </Card>
      </div>
    );
  }

  // 令牌无效
  if (!tokenValid) {
    console.log('[SetPassword] 跳转到 /login（令牌无效）');
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f7f8fa'
      }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Alert
            message="邀请链接无效"
            description="链接已失效或不正确，请联系管理员重新发送邀请。"
            type="error"
            showIcon
          />
          <Button 
            type="primary" 
            style={{ marginTop: 16 }}
            onClick={() => {
              console.log('[SetPassword] 用户点击返回登录，跳转到 /login');
              navigate('/login');
            }}
          >
            返回登录
          </Button>
        </Card>
      </div>
    );
  }

  // 设置完成
  if (completed) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f7f8fa'
      }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <Title level={3}>设置成功！</Title>
          <Text>您的账户已激活，正在为您登录...</Text>
          <div style={{ marginTop: 24 }}>
            <Spin />
          </div>
        </Card>
      </div>
    );
  }

  // 密码设置表单
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f7f8fa'
    }}>
      <Card style={{ width: 450, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SafetyOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={2}>设置密码</Title>
          <Text type="secondary">完成账户激活，设置您的登录密码</Text>
        </div>

        {/* 用户信息展示 */}
        <div style={{ 
          background: '#f9f9f9', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 24 
        }}>
          {/* 用户名行已移除 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <MailOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <Text>{userInfo?.email}</Text>
          </div>
          {userInfo?.organization_name && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 8, color: '#1890ff' }}>🏢</span>
              <Text>{userInfo.organization_name}</Text>
            </div>
          )}
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSetPassword}
          size="large"
        >
          <Form.Item
            name="password"
            label="设置密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
              { 
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 
                message: '密码必须包含大小写字母和数字' 
              }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              className="custom-placeholder"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            style={{ marginTop: 16 }}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              className="custom-placeholder"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              size="large"
            >
              设置密码并激活账户
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            设置密码后，您将自动登录到系统
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default SetPassword; 