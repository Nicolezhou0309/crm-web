import React from 'react';
import { Menu, Badge, Space, Typography } from 'antd';
import { TeamOutlined, UserOutlined, CrownOutlined, DashboardOutlined } from '@ant-design/icons';
import { usePermissions } from '../hooks/usePermissions';

const { Text } = Typography;

const DepartmentAdminNav: React.FC = () => {
  const { isSuperAdmin, isDepartmentAdmin } = usePermissions();

  if (!isDepartmentAdmin && !isSuperAdmin) {
    return null;
  }

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: (
        <Space>
          <span>管理仪表板</span>
          <Badge count={0} size="small" />
        </Space>
      )
    },
    {
      key: 'departments',
      icon: <TeamOutlined />,
      label: (
        <Space>
          <span>部门管理</span>
          {isSuperAdmin && (
            <CrownOutlined style={{ color: '#1677ff' }} />
          )}
        </Space>
      )
    },
    {
      key: 'members',
      icon: <UserOutlined />,
      label: '成员管理'
    }
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ marginBottom: '8px' }}>
        <Text strong>
          <CrownOutlined style={{ marginRight: '4px' }} />
          {isSuperAdmin ? '超级管理员' : '部门管理员'} 功能
        </Text>
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={['dashboard']}
        items={menuItems}
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />
    </div>
  );
};

export default DepartmentAdminNav; 