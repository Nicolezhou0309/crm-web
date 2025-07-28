import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Divider, List, Tag } from 'antd';
import { supabase } from '../supaClient';
import { useUser } from '../context/UserContext';
import { useRolePermissions } from '../hooks/useRolePermissions';

const { Title, Text } = Typography;

const TestSupabase: React.FC = () => {
  const { user, profile, permissions, refreshUser, refreshPermissions } = useUser();
  const { 
    userRoles, 
    userPermissions, 
    hasPermission, 
    hasRole, 
    isSuperAdmin, 
    isSystemAdmin,
    loading: permissionsLoading 
  } = useRolePermissions();
  const [testResults, setTestResults] = useState<any>({});

  const testUserContext = () => {
    setTestResults((prev: any) => ({
      ...prev,
      userContext: {
        user: user ? { id: user.id, email: user.email } : null,
        profile: profile,
        permissions: permissions
      }
    }));
  };

  const testPermissions = async () => {
    try {
      await refreshPermissions();
      setTestResults((prev: any) => ({
        ...prev,
        permissionsRefreshed: '权限信息已刷新'
      }));
    } catch (error) {
      setTestResults((prev: any) => ({
        ...prev,
        permissionsError: error instanceof Error ? error.message : '未知错误'
      }));
    }
  };

  const testApprovalPermission = () => {
    const hasApproval = hasPermission('approval_manage');
    const hasAdmin = hasRole('admin');
    setTestResults((prev: any) => ({
      ...prev,
      approvalTest: {
        hasApprovalManage: hasApproval,
        hasAdminRole: hasAdmin,
        isSuperAdmin,
        isSystemAdmin
      }
    }));
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>权限调试页面</Title>
      
      <Card title="当前用户权限信息" style={{ marginBottom: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button onClick={testUserContext}>测试 UserContext</Button>
          <Button onClick={testPermissions}>刷新权限信息</Button>
          <Button onClick={testApprovalPermission}>测试审批权限</Button>
          
          {!permissionsLoading && (
            <div>
              <Divider>权限状态</Divider>
              <List
                size="small"
                dataSource={[
                  { label: '审批管理权限', value: hasPermission('approval_manage') },
                  { label: '管理员角色', value: hasRole('admin') },
                  { label: '超级管理员', value: isSuperAdmin },
                  { label: '系统管理员', value: isSystemAdmin },
                ]}
                renderItem={item => (
                  <List.Item>
                    <Text>{item.label}:</Text>
                    <Tag color={item.value ? 'green' : 'red'}>
                      {item.value ? '✅ 有权限' : '❌ 无权限'}
                    </Tag>
                  </List.Item>
                )}
              />
              
              <Divider>用户角色</Divider>
              <div>
                {userRoles.map((role: any) => (
                  <Tag key={role.role_id} color="blue">{role.role_name}</Tag>
                ))}
              </div>
              
              <Divider>用户权限</Divider>
              <div>
                {userPermissions.map((perm: any) => (
                  <Tag key={perm.permission_name} color="green">{perm.permission_name}</Tag>
                ))}
              </div>
            </div>
          )}
          
          {testResults.userContext && (
            <div>
              <Divider>UserContext 信息</Divider>
              <pre>{JSON.stringify(testResults.userContext, null, 2)}</pre>
            </div>
          )}
          
          {testResults.approvalTest && (
            <div>
              <Divider>审批权限测试</Divider>
              <pre>{JSON.stringify(testResults.approvalTest, null, 2)}</pre>
            </div>
          )}
          
          {testResults.permissionsRefreshed && (
            <div>
              <Text type="success">{testResults.permissionsRefreshed}</Text>
            </div>
          )}
          
          {testResults.permissionsError && (
            <div>
              <Text type="danger">权限刷新错误: {testResults.permissionsError}</Text>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default TestSupabase; 