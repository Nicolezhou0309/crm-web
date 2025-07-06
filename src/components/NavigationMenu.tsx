import React from 'react';
import { Menu } from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  HomeOutlined,
  SolutionOutlined,
  KeyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useRolePermissions } from '../hooks/useRolePermissions';


interface NavigationMenuProps {
  selectedKey: string;
  onMenuClick: (key: string) => void;
  collapsed?: boolean;
}

// 递归过滤掉show为false的菜单项，并去除show属性
function filterMenuItems(items: any[]): any[] {
  return items
    .filter(item => item.show === undefined || item.show)
    .map(item => {
      const { show, ...rest } = item;
      if (item.children) {
        return {
          ...rest,
          children: filterMenuItems(item.children)
        };
      }
      return rest;
    });
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  selectedKey,
  onMenuClick,
  collapsed = false
}) => {
  const { isSuperAdmin, isSystemAdmin, hasPermission, loading } = useRolePermissions();

  // 使用 useEffect 避免无限循环
  React.useEffect(() => {
    if (!loading) {
      console.log('NavigationMenu - 权限状态:', {
        isSuperAdmin,
        isSystemAdmin,
        hasPermission: {
          'leads:read': hasPermission('leads:read'),
          'followups:read': hasPermission('followups:read'),
          'deals:read': hasPermission('deals:read'),
          'dashboard:read': hasPermission('dashboard:read'),
        },
        loading
      });
    }
  }, [isSuperAdmin, isSystemAdmin, loading]);

  const menuItems = [
    { 
      key: 'index', 
      icon: <HomeOutlined />, 
      label: '首页', 
      path: '/',
      show: true
    },
    {
      key: 'clues',
      icon: <SolutionOutlined />,
      label: '线索管理',
      show: true, // 始终显示，子菜单根据权限控制
      children: [
        { 
          key: 'leads', 
          icon: <FileTextOutlined />, 
          label: '线索列表', 
          path: '/leads',
          show: hasPermission('leads:read') || isSuperAdmin
        },
        { 
          key: 'followups', 
          icon: <UserOutlined />, 
          label: '跟进记录', 
          path: '/followups',
          show: hasPermission('followups:read') || isSuperAdmin
        },
        { 
          key: 'showings', 
          icon: <EyeOutlined />, 
          label: '带看记录', 
          path: '/showings',
          show: hasPermission('showings:read') || isSuperAdmin
        },
        { 
          key: 'deals', 
          icon: <CheckCircleOutlined />, 
          label: '成交记录', 
          path: '/deals',
          show: hasPermission('deals:read') || isSuperAdmin
        },
      ]
    },
    { 
      key: 'dashboard', 
      icon: <DashboardOutlined />, 
      label: '仪表盘', 
      path: '/dashboard',
      show: hasPermission('dashboard:read') || isSuperAdmin
    },
    { 
      key: 'departments', 
      icon: <AppstoreOutlined />, 
      label: '部门管理', 
      path: '/departments',
      show: hasPermission('departments:read') || isSystemAdmin || isSuperAdmin
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      show: isSuperAdmin || isSystemAdmin,
      children: [
        { 
          key: 'roles', 
          icon: <KeyOutlined />, 
          label: '角色权限', 
          path: '/roles',
          show: isSuperAdmin || isSystemAdmin
        },
        { 
          key: 'test', 
          icon: <DatabaseOutlined />, 
          label: '数据库测试', 
          path: '/test',
          show: isSuperAdmin
        },
      ]
    },
  ];

  const filteredMenuItems = filterMenuItems(menuItems);

  // 如果正在加载，显示基本菜单
  if (loading) {
    return (
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={e => {
          // 简单的路径映射
          const pathMap: Record<string, string> = {
            'index': '/',
            'leads': '/leads',
            'followups': '/followups',
            'deals': '/deals',
            'dashboard': '/dashboard'
          };
          const path = pathMap[e.key];
          if (path) {
            onMenuClick(path);
          }
        }}
        inlineCollapsed={collapsed}
        items={[
          { key: 'index', icon: <HomeOutlined />, label: '首页' },
          { key: 'clues', icon: <SolutionOutlined />, label: '线索管理', children: [
            { key: 'leads', icon: <FileTextOutlined />, label: '线索列表' },
            { key: 'followups', icon: <UserOutlined />, label: '跟进记录' },
            { key: 'deals', icon: <CheckCircleOutlined />, label: '成交记录' },
          ]},
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
        ]}
      />
    );
  }

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      onClick={e => {
        // 支持分级菜单点击跳转
        let item;
        for (const group of filteredMenuItems) {
          if (group.children) {
            item = group.children.find((i: any) => i.key === e.key);
            if (item) break;
          } else if (group.key === e.key) {
            item = group;
            break;
          }
        }
        if (item && item.path) {
          onMenuClick(item.path);
        }
      }}
      inlineCollapsed={collapsed}
      items={filteredMenuItems}
    />
  );
};

export default NavigationMenu; 