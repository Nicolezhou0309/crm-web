import React, { useState } from 'react';
import { Button, Card, Space, Typography, Divider } from 'antd';
import LoadingScreen from '../components/LoadingScreen';

const { Title, Text } = Typography;

const LoadingDemo: React.FC = () => {
  const [showLoading, setShowLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'auth' | 'data' | 'profile' | 'system' | 'random'>('random');

  const handleShowLoading = (type: typeof loadingType) => {
    setLoadingType(type);
    setShowLoading(true);
    setTimeout(() => setShowLoading(false), 3000);
  };

  if (showLoading) {
    return <LoadingScreen type={loadingType} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>加载效果演示</Title>
      <Text type="secondary">点击下面的按钮查看不同的加载效果</Text>
      
      <Divider />
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="随机加载消息" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>每次都会显示不同的有趣加载消息</Text>
          <br />
          <Button 
            type="primary" 
            onClick={() => handleShowLoading('random')}
            style={{ marginTop: 8 }}
          >
            显示随机加载
          </Button>
        </Card>

        <Card title="身份验证加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于登录验证时的加载效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('auth')}
            style={{ marginTop: 8 }}
          >
            显示身份验证加载
          </Button>
        </Card>

        <Card title="数据加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于加载数据时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('data')}
            style={{ marginTop: 8 }}
          >
            显示数据加载
          </Button>
        </Card>

        <Card title="个人资料加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于加载用户资料时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('profile')}
            style={{ marginTop: 8 }}
          >
            显示个人资料加载
          </Button>
        </Card>

        <Card title="系统初始化加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于系统启动时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('system')}
            style={{ marginTop: 8 }}
          >
            显示系统初始化加载
          </Button>
        </Card>
      </Space>

      <Divider />

      <Card title="加载消息列表" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
          <Text strong>可用的加载消息：</Text>
          <ul style={{ marginTop: 8 }}>
            <li>别催啦，已经在拼命加载了！💨</li>
            <li>正在召唤数据精灵...✨</li>
            <li>服务器正在疯狂运转中...⚡</li>
            <li>正在为您打开魔法之门...🚪</li>
            <li>正在收集用户信息...📊</li>
            <li>正在连接云端服务器...☁️</li>
            <li>正在为您定制专属体验...🎨</li>
            <li>正在检查您的权限...🔐</li>
            <li>正在加载您的个人资料...👤</li>
            <li>正在初始化系统...🔧</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default LoadingDemo; 