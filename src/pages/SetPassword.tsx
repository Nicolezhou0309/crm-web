import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography, Spin, Alert } from 'antd';
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
  const [isInviteFlow, setIsInviteFlow] = useState(false);
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
        
        // 检查是否是通过邀请链接登录的
        const urlParams = new URLSearchParams(window.location.search);
        const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
        const hasInviteToken = urlParams.get('token') || urlParams.get('access_token') || 
                              fragmentParams.get('access_token') || fragmentParams.get('token');
        
        console.log('🔍 [SetPassword] 检查邀请流程:', {
          hasInviteToken: !!hasInviteToken,
          isInviteFlow,
          url: window.location.href
        });
        
        // 如果是邀请流程，强制要求设置密码
        if (isInviteFlow || hasInviteToken) {
          console.log('✅ [SetPassword] 邀请流程，强制要求设置密码');
          setIsInviteFlow(true);
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
              .eq('id', session.user.user_metadata?.organization_id)
              .single();
            
            if (org) {
              setUserInfo((prev: any) => ({ ...prev, organization_name: org.name }));
            }
          }
          setVerifying(false);
          return;
        }
        
        // 非邀请流程，检查用户是否已经设置了密码
        const hasPassword = session.user.user_metadata?.password_set || 
                          session.user.app_metadata?.provider === 'email' ||
                          session.user.email_confirmed_at;
        
        console.log('🔍 [SetPassword] 用户密码状态:', {
          password_set: session.user.user_metadata?.password_set,
          provider: session.user.app_metadata?.provider,
          email_confirmed_at: session.user.email_confirmed_at,
          hasPassword: hasPassword
        });
        
        if (hasPassword) {
          console.log('✅ [SetPassword] 用户已设置密码，跳转到首页');
          navigate('/');
          return;
        }
        
        // 如果用户还没有设置密码，显示设置密码页面
        console.log('✅ [SetPassword] 用户需要设置密码，显示设置密码页面');
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
            .eq('id', session.user.user_metadata?.organization_id)
            .single();
          
          if (org) {
            setUserInfo((prev: any) => ({ ...prev, organization_name: org.name }));
          }
        }
        setVerifying(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isInviteFlow]);

  // 验证邀请令牌（修复版逻辑）
  const verifyInviteToken = async () => {
    try {
      setVerifying(true);
      
      console.log('🔍 [SetPassword] 开始验证邀请令牌...');
      console.log('🔍 [SetPassword] 当前URL:', window.location.href);
      console.log('🔍 [SetPassword] URL search:', window.location.search);
      console.log('🔍 [SetPassword] URL hash:', window.location.hash);
      
      // 从URL中提取token（优先处理）
      const urlParams = new URLSearchParams(window.location.search);
      const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
      
      // 检查URL中是否有错误信息
      const error = urlParams.get('error') || fragmentParams.get('error');
      const errorDescription = urlParams.get('error_description') || fragmentParams.get('error_description');
      
      if (error) {
        console.error('❌ [SetPassword] URL中包含错误信息:', { error, errorDescription });
        
        // 如果是邀请相关的错误，提供更友好的错误信息
        if (error === 'server_error' || error === 'unexpected_failure') {
          message.error('邀请链接验证失败，可能是链接已过期或无效。请联系管理员重新发送邀请。');
        } else if (error === 'access_denied' && errorDescription?.includes('expired')) {
          message.error('邀请链接已过期，请联系管理员重新发送邀请。');
        } else if (error === 'access_denied') {
          message.error('邀请链接无效或已被使用，请联系管理员重新发送邀请。');
        } else {
          message.error(`邀请验证失败: ${errorDescription || error}`);
        }
        
        setTokenValid(false);
        setVerifying(false);
        return;
      }
      
      // 提取 token，优先 query 参数，然后 hash 参数
      let token = urlParams.get('token') || urlParams.get('access_token');
      if (!token) {
        token = fragmentParams.get('access_token') || fragmentParams.get('token');
      }
      
      console.log('🔍 [SetPassword] 提取的令牌:', token ? `${token.substring(0, 20)}...` : null);
      console.log('🔍 [SetPassword] 完整令牌:', token);
      console.log('🔍 [SetPassword] 令牌长度:', token ? token.length : 0);
      
      // 如果有token，标记为邀请流程
      if (token) {
        console.log('🔍 [SetPassword] 发现邀请token，标记为邀请流程');
        setIsInviteFlow(true);
        
        // 检查是否为自定义邀请token
        const tokenType = urlParams.get('type') || fragmentParams.get('type');
        console.log('🔍 [SetPassword] 令牌类型:', tokenType);
        
        if (tokenType === 'custom_invite') {
          console.log('🔍 [SetPassword] 处理自定义邀请令牌...');
          
          try {
            // 解码自定义token
            const decodedToken = JSON.parse(atob(token));
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
            
            // 保存自定义token用于后续处理
            setAccessToken(token);
            setTokenValid(true);
            setVerifying(false);
            
            console.log('✅ [SetPassword] 自定义令牌验证成功');
            return;
            
          } catch (decodeError) {
            console.error('❌ [SetPassword] 自定义令牌解码失败:', decodeError);
            message.error('邀请链接格式错误，请联系管理员重新发送邀请。');
            setTokenValid(false);
            setVerifying(false);
            return;
          }
        } else {
          // 处理Supabase标准邀请token
          console.log('🔍 [SetPassword] 处理Supabase标准邀请令牌...');
          
          // 保存token用于后续密码设置
          setAccessToken(token);
          setTokenValid(true);
          setVerifying(false);
          
          console.log('✅ [SetPassword] Supabase邀请令牌已保存，等待用户设置密码');
          return;
        }
      }
      
      // 如果没有token，检查是否已经有session（可能是自动登录的情况）
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔍 [SetPassword] 当前session:', session);
      if (sessionError) {
        console.error('❌ [SetPassword] 获取session出错:', sessionError);
      }
      
      if (session?.user) {
        console.log('✅ [SetPassword] 已有认证session，检查是否需要设置密码:', session.user);
        
        // 检查用户是否已经设置了密码
        const hasPassword = session.user.user_metadata?.password_set || 
                          session.user.app_metadata?.provider === 'email' ||
                          session.user.email_confirmed_at;
        
        console.log('🔍 [SetPassword] 用户密码状态:', {
          password_set: session.user.user_metadata?.password_set,
          provider: session.user.app_metadata?.provider,
          email_confirmed_at: session.user.email_confirmed_at,
          hasPassword: hasPassword
        });
        
        if (hasPassword) {
          console.log('✅ [SetPassword] 用户已设置密码，跳转到首页');
          navigate('/');
          return;
        }
        
        // 如果用户还没有设置密码，显示设置密码页面
        console.log('✅ [SetPassword] 用户需要设置密码，显示设置密码页面');
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
            .eq('id', session.user.user_metadata?.organization_id)
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
      
      // 如果既没有token也没有session，显示错误
      console.log('❌ [SetPassword] 未找到令牌，且无认证session');
      setTokenValid(false);
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
      console.log('🔑 [SetPassword] 是否为邀请流程:', isInviteFlow);
      
      if (!accessToken && !isInviteFlow) {
        message.error('访问令牌无效，请重新获取邀请链接');
        return;
      }
      
      // 检查是否为自定义邀请token
      const urlParams = new URLSearchParams(window.location.search);
      const tokenType = urlParams.get('type');
      
      if (tokenType === 'custom_invite') {
        console.log('🔑 [SetPassword] 处理自定义邀请密码设置...');
        
        try {
          // 解码自定义token
          const decodedToken = JSON.parse(atob(accessToken));
          console.log('🔍 [SetPassword] 解码的令牌:', decodedToken);
          
          // 创建用户账户
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: decodedToken.email,
            password: password,
            options: {
              data: {
                name: decodedToken.email.split('@')[0],
                organization_id: decodedToken.organization_id,
                organization_name: decodedToken.organization_name,
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
            .eq('email', decodedToken.email);
          
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
          return;
        }
      } else {
        // 使用Supabase标准邀请流程或直接更新密码
        console.log('🔑 [SetPassword] 开始设置密码...');
        
        try {
          if (accessToken) {
            // 如果有token，先验证token
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
          }
          
          // 设置密码
          const { error: updateError } = await supabase.auth.updateUser({
            password: password,
            data: {
              password_set: true,
              password_set_at: new Date().toISOString()
            }
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
          
        } catch (sessionError) {
          console.error('❌ [SetPassword] 密码设置失败:', sessionError);
          message.error('密码设置失败，请重试');
          return;
        }
      }
      
    } catch (error: any) {
      console.error('❌ [SetPassword] 密码设置异常:', error);
      message.error('密码设置失败: ' + error.message);
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
          <Title level={3}>密码设置成功！</Title>
          <Text>正在跳转到首页...</Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f7f8fa'
    }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>设置密码</Title>
          {userInfo && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                欢迎加入 {userInfo.organization_name || '团队'}！
              </Text>
              <br />
              <Text strong>{userInfo.email}</Text>
            </div>
          )}
        </div>

        <Form
          form={form}
          onFinish={handleSetPassword}
          layout="vertical"
        >
          <Form.Item
            name="password"
            label="设置密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
              {
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  
                  const hasLetter = /[a-zA-Z]/.test(value);
                  const hasNumber = /\d/.test(value);
                  
                  if (!hasLetter || !hasNumber) {
                    return Promise.reject(new Error('密码必须包含字母和数字'));
                  }
                  
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
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
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              style={{ width: '100%' }}
            >
              设置密码并登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">
            设置密码后，您将自动登录系统
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default SetPassword; 