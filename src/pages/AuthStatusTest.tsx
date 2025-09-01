import React from 'react';
import { Card, Space, Typography, Button, Alert } from 'antd';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;

const AuthStatusTest: React.FC = () => {
  const { user, profile, loading, profileLoading, error } = useUser();
  const { isAuthenticated, isLoading, user: authUser } = useAuth();

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>认证状态测试页面</Title>
      
      <Alert
        message="认证状态监控"
        description="此页面用于监控用户认证状态和 loading 状态的变化"
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="UserContext 状态" size="small">
          <Space direction="vertical">
            <Text>整体 Loading: <Text code>{loading ? '是' : '否'}</Text></Text>
            <Text>Profile Loading: <Text code>{profileLoading ? '是' : '否'}</Text></Text>
            <Text>用户存在: <Text code>{user ? '是' : '否'}</Text></Text>
            <Text>Profile 存在: <Text code>{profile ? '是' : '否'}</Text></Text>
            <Text>错误信息: <Text code>{error || '无'}</Text></Text>
          </Space>
        </Card>

        <Card title="useAuth Hook 状态" size="small">
          <Space direction="vertical">
            <Text>认证检查 Loading: <Text code>{isLoading ? '是' : '否'}</Text></Text>
            <Text>已认证: <Text code>{isAuthenticated ? '是' : '否'}</Text></Text>
            <Text>认证用户存在: <Text code>{authUser ? '是' : '否'}</Text></Text>
          </Space>
        </Card>

        <Card title="用户信息详情" size="small">
          <Space direction="vertical">
            {user ? (
              <>
                <Text>用户 ID: <Text code>{user.id}</Text></Text>
                <Text>邮箱: <Text code>{user.email}</Text></Text>
                <Text>创建时间: <Text code>{user.created_at}</Text></Text>
              </>
            ) : (
              <Text type="secondary">未获取到用户信息</Text>
            )}
          </Space>
        </Card>

        <Card title="Profile 信息详情" size="small">
          <Space direction="vertical">
            {profile ? (
              <>
                <Text>Profile ID: <Text code>{profile.id}</Text></Text>
                <Text>用户 ID: <Text code>{profile['user_id']}</Text></Text>
                <Text>昵称: <Text code>{profile.nickname || '未设置'}</Text></Text>
                <Text>头像: <Text code>{profile['avatar_url'] || '未设置'}</Text></Text>
              </>
            ) : (
              <Text type="secondary">未获取到 Profile 信息</Text>
            )}
          </Space>
        </Card>

        <Card title="状态分析" size="small">
          <Space direction="vertical">
            {loading && (
              <Alert
                message="应用正在初始化"
                description="UserContext 正在加载用户信息"
                type="warning"
                showIcon
              />
            )}
            
            {profileLoading && (
              <Alert
                message="正在加载用户资料"
                description="Profile 信息正在获取中"
                type="info"
                showIcon
              />
            )}
            
            {!loading && !profileLoading && user && profile && (
              <Alert
                message="认证完成"
                description="用户已完全认证，可以正常使用应用"
                type="success"
                showIcon
              />
            )}
            
            {!loading && !profileLoading && (!user || !profile) && (
              <Alert
                message="认证未完成"
                description="用户未完全认证，可能需要重新登录"
                type="error"
                showIcon
              />
            )}
          </Space>
        </Card>

        <Card title="测试操作" size="small">
          <Space>
            <Button 
              type="primary" 
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>
            
            <Button 
              onClick={() => {
                console.log('当前状态:', {
                  user,
                  profile,
                  loading,
                  profileLoading,
                  isAuthenticated,
                  isLoading
                });
              }}
            >
              打印状态到控制台
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AuthStatusTest;
