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
  BranchesOutlined,
} from '@ant-design/icons';
import pkg from '../../package.json';


interface NavigationMenuProps {
  selectedKey: string;
  onMenuClick: (key: string) => void;
  collapsed?: boolean;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  selectedKey,
  onMenuClick,
  collapsed = false
}) => {
  const menuItems = [
    { 
      key: 'index', 
      icon: <HomeOutlined />, 
      label: '首页', 
      path: '/'
    },
    {
      key: 'clues',
      icon: <SolutionOutlined />,
      label: '线索管理',
      children: [
        { 
          key: 'leads', 
          icon: <FileTextOutlined />, 
          label: '线索列表', 
          path: '/leads'
        },
        { 
          key: 'followups', 
          icon: <UserOutlined />, 
          label: '跟进记录', 
          path: '/followups'
        },
        { 
          key: 'allocation', 
          icon: <BranchesOutlined />, 
          label: '线索分配', 
          path: '/allocation'
        },
        { 
          key: 'showings', 
          icon: <EyeOutlined />, 
          label: '带看记录', 
          path: '/showings'
        },
        { 
          key: 'deals', 
          icon: <CheckCircleOutlined />, 
          label: '成交记录', 
          path: '/deals'
        },
      ]
    },
    { 
      key: 'dashboard', 
      icon: <DashboardOutlined />, 
      label: '仪表盘', 
      path: '/dashboard'
    },
    { 
      key: 'departments', 
      icon: <AppstoreOutlined />, 
      label: '部门管理', 
      path: '/departments'
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        { 
          key: 'roles', 
          icon: <KeyOutlined />, 
          label: '角色权限', 
          path: '/roles'
        },
        { 
          key: 'test', 
          icon: <DatabaseOutlined />, 
          label: '数据库测试', 
          path: '/test'
        },
      ]
    },
  ];

  return (
    <>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={e => {
          // 支持分级菜单点击跳转
          let item;
          for (const group of menuItems) {
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
        items={menuItems}
      />
      {/* 收缩/展开按钮和版本号 */}
      <div style={{ width: '100%', textAlign: 'center', marginTop: 12 }}>
        {/* 这里的按钮由父组件App.tsx渲染，这里只显示版本号 */}
        <div style={{ color: '#bbb', fontSize: 12, marginTop: 8 }}>
          v{pkg.version}
        </div>
      </div>
    </>
  );
};

export default NavigationMenu; 