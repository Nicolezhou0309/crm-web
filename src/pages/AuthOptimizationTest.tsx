import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Alert, Divider } from 'antd';
import { useUser } from '../context/UserContext';
import { useRolePermissions } from '../hooks/useRolePermissions';

const { Title, Text } = Typography;

const AuthOptimizationTest: React.FC = () => {
  const { user, profile, permissions } = useUser();
  const { hasPermission, hasRole, clearPermissionCache } = useRolePermissions();
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);

  useEffect(() => {
    // 获取缓存统计 - 暂时使用模拟数据
    setCacheStats({
      permissionCacheSize: 0,
      roleCacheSize: 0,
      userPermissionsCount: 0,
      userRolesCount: 0,
    });
  }, []);

  const runPerformanceTest = () => {
    const results = [];
    const startTime = performance.now();
    
    // 测试权限检查性能
    for (let i = 0; i < 100; i++) {
      hasPermission('lead_manage');
      hasRole('admin');
    }
    
    const endTime = performance.now();
    results.push({
      test: '权限检查性能测试',
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      description: '执行100次权限检查'
    });

    setTestResults(results);
  };

  const clearCache = () => {
    clearPermissionCache();
    // 重新获取缓存统计
    setCacheStats({
      permissionCacheSize: 0,
      roleCacheSize: 0,
      userPermissionsCount: 0,
      userRolesCount: 0,
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>认证系统优化测试</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 用户信息 */}
        <Card title="用户信息" size="small">
          <Space direction="vertical">
            <Text>用户ID: {user?.id}</Text>
            <Text>邮箱: {user?.email}</Text>
            <Text>昵称: {profile?.nickname || '未设置'}</Text>
            <Text>超级管理员: {permissions?.isSuperAdmin ? '是' : '否'}</Text>
          </Space>
        </Card>

        {/* 缓存统计 */}
        <Card title="权限缓存统计" size="small">
          <Space direction="vertical">
            <Text>权限缓存大小: {cacheStats?.permissionCacheSize || 0}</Text>
            <Text>角色缓存大小: {cacheStats?.roleCacheSize || 0}</Text>
            <Text>用户权限数量: {cacheStats?.userPermissionsCount || 0}</Text>
            <Text>用户角色数量: {cacheStats?.userRolesCount || 0}</Text>
          </Space>
        </Card>

        {/* 操作按钮 */}
        <Card title="测试操作" size="small">
          <Space>
            <Button type="primary" onClick={runPerformanceTest}>
              运行性能测试
            </Button>
            <Button onClick={clearCache}>
              清除缓存
            </Button>
          </Space>
        </Card>

        {/* 测试结果 */}
        {testResults.length > 0 && (
          <Card title="测试结果" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {testResults.map((result, index) => (
                <Alert
                  key={index}
                  message={result.test}
                  description={`${result.description} - ${result.duration || result.result}`}
                  type="info"
                  showIcon
                />
              ))}
            </Space>
          </Card>
        )}

        {/* 优化说明 */}
        <Card title="优化说明" size="small">
          <Space direction="vertical">
            <Text strong>优先级1 - 立即修复:</Text>
            <Text>✓ 移除重复的认证监听器</Text>
            <Text>✓ 统一token刷新逻辑</Text>
            <Text>✓ 优化会话超时管理</Text>
            
            <Divider />
            
            <Text strong>优先级2 - 性能优化:</Text>
            <Text>✓ 实现智能token刷新</Text>
            <Text>✓ 减少不必要的API调用</Text>
            <Text>✓ 优化权限检查缓存</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AuthOptimizationTest;