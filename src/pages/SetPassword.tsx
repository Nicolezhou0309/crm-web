import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography, Spin, Alert } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
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
  const [accessToken, setAccessToken] = useState<string>('');
  const [inviteData, setInviteData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    handleInviteFlow();
  }, []);

  // 处理邀请流程 - 前端拦截，阻止自动登录
  const handleInviteFlow = async () => {
    try {
      setVerifying(true);
      
      console.log('🔍 [SetPassword] 开始处理邀请流程...');
      console.log('🔍 [SetPassword] 当前URL:', window.location.href);
      
      // 1. 立即阻止任何自动登录
      console.log('🛡️ [SetPassword] 阻止自动登录...');
      await supabase.auth.signOut();
      
      // 2. 从URL中提取token和参数
      const urlParams = new URLSearchParams(window.location.search);
      const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
      
      // 检查错误信息
      const error = urlParams.get('error') || fragmentParams.get('error');
      const errorDescription = urlParams.get('error_description') || fragmentParams.get('error_description');
      
      if (error) {
        console.error('❌ [SetPassword] URL中包含错误信息:', { error, errorDescription });
        handleInviteError(error, errorDescription || undefined);
        return;
      }
      
      // 提取token
      let token = urlParams.get('token') || urlParams.get('access_token');
      if (!token) {
        token = fragmentParams.get('access_token') || fragmentParams.get('token');
      }
      
      console.log('🔍 [SetPassword] 提取的令牌:', token ? `${token.substring(0, 20)}...` : null);
      
      if (!token) {
        console.log('❌ [SetPassword] 未找到令牌');
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      
      // 3. 验证token类型并处理
      const tokenType = urlParams.get('type') || fragmentParams.get('type');
      console.log('🔍 [SetPassword] 令牌类型:', tokenType);
      
      if (tokenType === 'custom_invite') {
        await handleCustomInvite(token);
      } else {
        await handleSupabaseInvite(token);
      }
      
    } catch (error) {
      console.error('❌ [SetPassword] 邀请流程处理失败:', error);
      message.error('邀请处理失败，请重试');
      setTokenValid(false);
      setVerifying(false);
    }
  };

  // 处理自定义邀请
  const handleCustomInvite = async (token: string) => {
    try {
      console.log('🔍 [SetPassword] 处理自定义邀请令牌...');
      console.log('🔍 [SetPassword] 原始token长度:', token.length);
      console.log('🔍 [SetPassword] 原始token前20字符:', token.substring(0, 20));
      
      // 尝试解码token
      let decodedToken;
      try {
        // 首先尝试直接atob解码
        const base64Decoded = atob(token);
        console.log('🔍 [SetPassword] base64解码成功，长度:', base64Decoded.length);
        
        // 然后尝试JSON解析
        decodedToken = JSON.parse(base64Decoded);
        console.log('🔍 [SetPassword] JSON解析成功，使用直接解码方式');
      } catch (directError: any) {
        console.log('🔍 [SetPassword] 直接解码失败，尝试UTF-8安全解码...');
        console.log('🔍 [SetPassword] 直接解码错误:', directError);
        
        // 如果直接解码失败，尝试UTF-8安全的解码
        try {
          const base64Decoded = atob(token);
          const utf8Decoded = decodeURIComponent(escape(base64Decoded));
          decodedToken = JSON.parse(utf8Decoded);
          console.log('🔍 [SetPassword] UTF-8安全解码成功');
        } catch (utf8Error: any) {
          console.log('🔍 [SetPassword] UTF-8安全解码也失败:', utf8Error);
          throw new Error(`Token解码失败: ${utf8Error.message}`);
        }
      }
      
      console.log('🔍 [SetPassword] 解码的令牌:', decodedToken);
      
      // 验证token是否过期
      const expiresAt = new Date(decodedToken.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        console.error('❌ [SetPassword] 自定义令牌已过期');
        message.error('邀请链接已过期，请联系管理员重新发送邀请。');
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      
      // 设置用户信息
      setUserInfo({
        email: decodedToken.email,
        name: decodedToken.email.split('@')[0],
        organization_id: decodedToken.organization_id,
        organization_name: decodedToken.organization_name
      });
      
      // 保存邀请数据
      setInviteData(decodedToken);
      setAccessToken(token);
      setTokenValid(true);
      setVerifying(false);
      
      console.log('✅ [SetPassword] 自定义令牌验证成功');
      
    } catch (decodeError) {
      console.error('❌ [SetPassword] 自定义令牌解码失败:', decodeError);
      message.error('邀请链接格式错误，请联系管理员重新发送邀请。');
      setTokenValid(false);
      setVerifying(false);
    }
  };

  // 处理Supabase标准邀请
  const handleSupabaseInvite = async (token: string) => {
    try {
      console.log('🔍 [SetPassword] 处理Supabase标准邀请...');
      
             // 验证邀请token
       const { data, error } = await supabase.auth.verifyOtp({
         token_hash: token || '',
         type: 'invite'
       });

      if (error) {
        console.error('❌ [SetPassword] 邀请验证失败:', error);
        message.error('邀请验证失败: ' + error.message);
        setTokenValid(false);
        setVerifying(false);
        return;
      }

      console.log('✅ [SetPassword] 邀请验证成功:', data.user?.email);
      
      // 立即登出，阻止自动登录
      await supabase.auth.signOut();
      
      // 设置用户信息
      setUserInfo({
        email: data.user?.email,
        name: data.user?.user_metadata?.name || data.user?.email?.split('@')[0],
        organization_id: data.user?.user_metadata?.organization_id,
        organization_name: data.user?.user_metadata?.organization_name
      });
      
      // 保存token用于后续密码设置
      setAccessToken(token);
      setTokenValid(true);
      setVerifying(false);
      
    } catch (error) {
      console.error('❌ [SetPassword] Supabase邀请处理失败:', error);
      message.error('邀请处理失败，请重试');
      setTokenValid(false);
      setVerifying(false);
    }
  };

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
      
      console.log('✅ [SetPassword] 密码设置成功');
      message.success('密码设置成功！正在登录...');
      
      setCompleted(true);
      
      // 等待一下再跳转
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('❌ [SetPassword] 自定义邀请处理失败:', error);
      message.error('密码设置失败，请重试');
    }
  };

  // 处理Supabase邀请密码设置
  const handleSupabaseInvitePassword = async (password: string) => {
    try {
      console.log('🔑 [SetPassword] 处理Supabase邀请密码设置...');
      
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
      
      setCompleted(true);
      
      // 等待一下再跳转
      setTimeout(() => {
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
            onClick={() => navigate('/login')}
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <Text strong>{userInfo?.name}</Text>
          </div>
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