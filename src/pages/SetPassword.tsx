import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography, Spin, Alert } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
  const navigate = useNavigate();

  useEffect(() => {
    verifyInviteToken();
  }, []);

  // 监听认证状态变化
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth状态变化:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ 用户已登录:', session.user);
        setTokenValid(true);
        setUserInfo({
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
          organization_id: session.user.user_metadata?.organization_id
        });
        
        // 获取组织信息
        if (session.user.user_metadata?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', session.user.user_metadata.organization_id)
            .single();
          
          if (org) {
            setUserInfo((prev: any) => ({ ...prev, organization_name: org.name }));
          }
        }
        setVerifying(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 验证邀请令牌（新版逻辑）
  const verifyInviteToken = async () => {
    try {
      setVerifying(true);
      
      console.log('🔍 [SetPassword] 开始验证邀请令牌...');
      console.log('🔍 [SetPassword] 当前URL:', window.location.href);
      console.log('🔍 [SetPassword] URL search:', window.location.search);
      console.log('🔍 [SetPassword] URL hash:', window.location.hash);
      
      // 检查是否已经有session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔍 [SetPassword] 当前session:', session);
      if (sessionError) {
        console.error('❌ [SetPassword] 获取session出错:', sessionError);
      }
      
      if (session?.user) {
        console.log('✅ [SetPassword] 已有认证session，直接使用:', session.user);
        setTokenValid(true);
        setUserInfo({
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
          organization_id: session.user.user_metadata?.organization_id
        });
        
        // 获取组织信息
        if (session.user.user_metadata?.organization_id) {
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', session.user.user_metadata.organization_id)
            .single();
          if (orgError) {
            console.error('❌ [SetPassword] 获取组织信息出错:', orgError);
          }
          if (org) {
            setUserInfo((prev: any) => ({ ...prev, organization_name: org.name }));
          }
        }
        setVerifying(false);
        return;
      }
      
      // 检查URL中是否有错误信息
      const urlParams = new URLSearchParams(window.location.search);
      const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
      
      // 检查错误信息
      const error = urlParams.get('error') || fragmentParams.get('error');
      const errorDescription = urlParams.get('error_description') || fragmentParams.get('error_description');
      
      if (error) {
        console.error('❌ [SetPassword] URL中包含错误信息:', { error, errorDescription });
        
        // 如果是邀请相关的错误，提供更友好的错误信息
        if (error === 'server_error' || error === 'unexpected_failure') {
          message.error('邀请链接验证失败，可能是链接已过期或无效。请联系管理员重新发送邀请。');
        } else {
          message.error(`邀请验证失败: ${errorDescription || error}`);
        }
        
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      
      // 从URL中提取token（兼容多种格式）
      // 提取 token，优先 query 参数，然后 hash 参数
      let token = urlParams.get('token') || urlParams.get('access_token');
      if (!token) {
        token = fragmentParams.get('access_token') || fragmentParams.get('token');
      }
      
      console.log('🔍 [SetPassword] 提取的令牌:', token ? `${token.substring(0, 20)}...` : null);
      console.log('🔍 [SetPassword] 完整令牌:', token);
      console.log('🔍 [SetPassword] 令牌长度:', token ? token.length : 0);
      
      if (!token) {
        console.log('❌ [SetPassword] 未找到令牌，且无认证session');
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      
      // 保存 token 用于后续密码设置
      setAccessToken(token);
      
      // 新版逻辑：不需要预先验证 token，直接标记为有效
      // token 的验证会在 updateUser 时自动进行
      console.log('✅ [SetPassword] Token已提取，准备设置密码');
      setTokenValid(true);
      
      // 从 URL 获取基本用户信息（如果有的话）
      const email = urlParams.get('email') || fragmentParams.get('email');
      if (email) {
        setUserInfo({
          email: email,
          name: email.split('@')[0],
          organization_id: null
        });
      }
      
      setVerifying(false);
    } catch (error) {
      console.error('❌ [SetPassword] 验证过程出错:', error);
      setTokenValid(false);
      setVerifying(false);
    }
  };

  // 设置密码（修复版逻辑）
  const handleSetPassword = async (values: any) => {
    try {
      setLoading(true);
      const { password } = values;
      
      console.log('🔑 [SetPassword] 开始设置密码...');
      console.log('🔑 [SetPassword] 使用accessToken:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
      
      if (!accessToken) {
        message.error('访问令牌无效，请重新获取邀请链接');
        return;
      }
      
      // 使用Supabase的邀请验证流程
      console.log('🔄 [SetPassword] 开始验证邀请令牌...');
      
      try {
        // 方法1：直接使用setSession建立会话（适用于邀请流程）
        console.log('🔄 [SetPassword] 尝试使用setSession方法...');
        console.log('🔍 [SetPassword] 令牌详情:', {
          token: accessToken.substring(0, 20) + '...',
          length: accessToken.length,
          hasToken: !!accessToken
        });
        
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: ''
        });

        if (sessionError) {
          console.warn('⚠️ [SetPassword] setSession失败，尝试其他方法:', sessionError);
          throw sessionError;
        }

        console.log('✅ [SetPassword] 会话建立成功:', sessionData.user?.email);
        console.log('🔍 [SetPassword] 会话详情:', {
          userId: sessionData.user?.id,
          email: sessionData.user?.email,
          hasSession: !!sessionData.session
        });
        
        // 设置密码
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) {
          console.error('❌ [SetPassword] 密码设置失败:', updateError);
          message.error('密码设置失败: ' + updateError.message);
          return;
        }

        console.log('✅ [SetPassword] 密码设置成功');
        message.success('密码设置成功！正在登录...');
        
        setCompleted(true);
        
        // 等待一下再跳转
        setTimeout(() => {
          navigate('/');
        }, 2000);
        
      } catch (sessionError: any) {
        console.error('❌ [SetPassword] setSession失败:', sessionError);
        
        // 方法2：如果setSession失败，尝试使用verifyOtp
        try {
          console.log('🔄 [SetPassword] 尝试使用verifyOtp方法...');
          
          const urlParams = new URLSearchParams(window.location.search);
          const type = urlParams.get('type') || 'invite';
          
          console.log('🔍 [SetPassword] 验证参数:', { 
            token: accessToken.substring(0, 20) + '...', 
            type,
            email: userInfo?.email 
          });
          
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            email: userInfo?.email || 'unknown@example.com',
            token: accessToken,
            type: 'invite'
          });

          if (verifyError) {
            console.error('❌ [SetPassword] verifyOtp失败:', verifyError);
            message.error('邀请验证失败: ' + verifyError.message);
            return;
          }

          console.log('✅ [SetPassword] 邀请验证成功:', verifyData.user?.email);
          
          // 设置密码
          const { error: updateError } = await supabase.auth.updateUser({
            password: password
          });

          if (updateError) {
            console.error('❌ [SetPassword] 密码设置失败:', updateError);
            message.error('密码设置失败: ' + updateError.message);
            return;
          }

          console.log('✅ [SetPassword] 密码设置成功');
          message.success('密码设置成功！正在登录...');
          
          setCompleted(true);
          
          // 等待一下再跳转
          setTimeout(() => {
            navigate('/');
          }, 2000);
          
        } catch (verifyError: any) {
          console.error('❌ [SetPassword] verifyOtp异常:', verifyError);
          message.error('邀请验证失败，请重新获取邀请链接: ' + verifyError.message);
        }
      }
      
    } catch (error: any) {
      console.error('❌ [SetPassword] 设置密码异常:', error);
      message.error('设置密码失败: ' + error.message);
    } finally {
      setLoading(false);
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