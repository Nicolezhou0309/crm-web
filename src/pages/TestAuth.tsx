import React from 'react';
import { useUser } from '../context/UserContext';
import { supabase } from '../supaClient';
import { Button, Card, Space, Typography } from 'antd';

const { Title, Text } = Typography;

const TestAuth: React.FC = () => {
  const { user, profile, loading, error } = useUser();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleRefresh = async () => {
    // 使用统一的用户上下文，不需要直接调用supabase.auth.getUser()
    console.log('Current session user:', user);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>认证测试页面</Title>
      
      <Card title="用户状态" style={{ marginBottom: 16 }}>
        <Space direction="vertical">
          <Text>Loading: {loading ? '是' : '否'}</Text>
          <Text>Error: {error || '无'}</Text>
          <Text>User ID: {user?.id || '未登录'}</Text>
          <Text>User Email: {user?.email || '未登录'}</Text>
          <Text>Profile ID: {profile?.id || '无档案'}</Text>
          <Text>Profile Nickname: {profile?.nickname || '无昵称'}</Text>
        </Space>
      </Card>

      <Card title="操作" style={{ marginBottom: 16 }}>
        <Space>
          <Button onClick={handleRefresh}>刷新用户信息</Button>
          <Button danger onClick={handleSignOut}>退出登录</Button>
        </Space>
      </Card>

      <Card title="调试信息">
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
          {JSON.stringify({ user, profile, loading, error }, null, 2)}
        </pre>
      </Card>
    </div>
  );
};

export default TestAuth;
