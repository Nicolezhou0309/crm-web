import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Switch,
  message,
  Typography,

} from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';

const { Text, Title } = Typography;

interface PermissionMatrixProps {
  onPermissionChange?: () => void;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ onPermissionChange }) => {
  const { isSuperAdmin } = useRolePermissions();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取角色
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // 获取权限
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (permissionsError) throw permissionsError;
      setPermissions(permissionsData || []);

      // 获取角色权限关联
      const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
        .from('role_permissions')
        .select(`
          *,
          roles (name, display_name),
          permissions (name, display_name, category),
          permission_scopes (name, display_name)
        `)
        .eq('is_active', true);
      if (rolePermissionsError) throw rolePermissionsError;
      setRolePermissions(rolePermissionsData || []);

    } catch (error) {
      console.error('获取权限矩阵数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (roleId: string, permissionId: string, scopeId: string, enabled: boolean) => {
    try {
      if (enabled) {
        // 添加权限
        const { error } = await supabase.rpc('create_role_permission', {
          role_id: roleId,
          permission_id: permissionId,
          scope_id: scopeId
        });
        if (error) throw error;
        message.success('权限添加成功');
      } else {
        // 移除权限
        const { error } = await supabase.rpc('delete_role_permission', {
          role_id: roleId,
          permission_id: permissionId,
          scope_id: scopeId
        });
        if (error) throw error;
        message.success('权限移除成功');
      }
      
      fetchData();
      onPermissionChange?.();
    } catch (error) {
      console.error('权限操作失败:', error);
      message.error('权限操作失败');
    }
  };

  const hasPermission = (roleId: string, permissionId: string, scopeId: string) => {
    return rolePermissions.some(rp => 
      rp.role_id === roleId && 
      rp.permission_id === permissionId && 
      rp.scope_id === scopeId
    );
  };

  const getPermissionColumns = () => {
    const baseColumns = [
      {
        title: '权限',
        dataIndex: 'display_name',
        key: 'display_name',
        width: 200,
        fixed: 'left',
        render: (text: string, record: any) => (
          <div>
            <Text strong>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.category} • {record.action}
            </Text>
          </div>
        )
      }
    ];

    const roleColumns = roles.map(role => ({
      title: role.display_name,
      key: role.id,
      width: 120,
      render: (_text: string, record: any) => {
        const hasPerm = hasPermission(role.id, record.id, 'global'); // 简化处理，只检查全局权限
        return (
          <Switch
            checked={hasPerm}
            onChange={(checked) => handlePermissionToggle(role.id, record.id, 'global', checked)}
            disabled={!isSuperAdmin}
          />
        );
      }
    }));

    return [...baseColumns, ...roleColumns];
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <SettingOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4}>您没有权限配置权限矩阵</Title>
          <Text type="secondary">只有超级管理员可以配置权限</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="权限矩阵配置"
      extra={
        <Space>
          <Button onClick={fetchData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" onClick={() => {
            // 这里可以添加批量权限配置功能
            message.info('批量配置功能开发中');
          }}>
            批量配置
          </Button>
        </Space>
      }
    >
      <Table
        columns={getPermissionColumns()}
        dataSource={permissions}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={false}
        size="small"
      />
      
      <div style={{ marginTop: '16px' }}>
        <Text type="secondary">
          说明：勾选表示该角色拥有对应权限，取消勾选表示移除权限。
          只有超级管理员可以修改权限配置。
        </Text>
      </div>
    </Card>
  );
};

export default PermissionMatrix; 