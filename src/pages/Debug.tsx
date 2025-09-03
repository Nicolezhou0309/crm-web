import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Button, Alert, Divider } from 'antd';
import { supabase, checkConnection } from '../supaClient';

const { Title, Text, Paragraph } = Typography;

const Debug: React.FC = () => {
  const [config, setConfig] = useState<any>({});
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 获取环境变量配置（注意：这些值在构建时就被替换了）
    setConfig({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      VITE_SUPABASE_SERVICE_ROLE_KEY: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
      NODE_ENV: import.meta.env.NODE_ENV,
      MODE: import.meta.env.MODE,
    });
  }, []);

  const testConnection = async () => {
    setLoading(true);
    try {
      const result = await checkConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    try {
      // 尝试获取当前用户
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        setConnectionStatus({
          connected: false,
          error: `Auth Error: ${error.message}`
        });
      } else {
        setConnectionStatus({
          connected: true,
          user: user ? 'User logged in' : 'No user logged in',
          data: { user }
        });
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        error: `Auth Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>🔧 系统调试信息</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="环境变量配置" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            {Object.entries(config).map(([key, value]) => (
              <div key={key}>
                <Text strong>{key}:</Text> 
                <Text code style={{ marginLeft: '8px' }}>
                  {value || 'NOT SET'}
                </Text>
              </div>
            ))}
          </Space>
        </Card>

        <Card title="连接测试" size="small">
          <Space>
            <Button onClick={testConnection} loading={loading}>
              测试数据库连接
            </Button>
            <Button onClick={testAuth} loading={loading}>
              测试认证连接
            </Button>
          </Space>
          
          {connectionStatus && (
            <div style={{ marginTop: '16px' }}>
              <Alert
                type={connectionStatus.connected ? 'success' : 'error'}
                message={connectionStatus.connected ? '连接成功' : '连接失败'}
                description={
                  <div>
                    <Text>{connectionStatus.error || connectionStatus.user || '连接正常'}</Text>
                    {connectionStatus.data && (
                      <pre style={{ marginTop: '8px', fontSize: '12px' }}>
                        {JSON.stringify(connectionStatus.data, null, 2)}
                      </pre>
                    )}
                  </div>
                }
              />
            </div>
          )}
        </Card>

        <Card title="配置检查清单" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>✅ 检查项目：</Text>
            </div>
            <ul>
              <li>VITE_SUPABASE_URL 是否指向正确的Supabase项目</li>
              <li>VITE_SUPABASE_ANON_KEY 是否为有效的anon密钥</li>
              <li>Supabase项目是否处于活跃状态</li>
              <li>网络连接是否正常</li>
              <li>用户账号是否存在且密码正确</li>
            </ul>
          </Space>
        </Card>

        <Card title="常见问题解决" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Title level={4}>401 Unauthorized 错误解决方案：</Title>
              <ol>
                <li>检查Supabase项目URL是否正确</li>
                <li>验证API密钥是否有效</li>
                <li>确认Supabase项目状态正常</li>
                <li>检查用户账号是否存在</li>
                <li>验证密码是否正确</li>
                <li>确认邮箱验证状态</li>
              </ol>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default Debug;
