import React from 'react';
import { Menu, Button } from 'antd';
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
  GiftOutlined,
  TrophyOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  BellOutlined,
  CrownOutlined,
  ExperimentOutlined,
  BugOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import pkg from '../../package.json';


interface NavigationMenuProps {
  selectedKey: string;
  onMenuClick: (key: string) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  selectedKey,
  onMenuClick,
  collapsed = false,
  onCollapse
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
    // 新增分配管理一级菜单
    {
      key: 'allocation-manage',
      icon: <BranchesOutlined />,
      label: '分配管理',
      children: [
        {
          key: 'allocation',
          icon: <BranchesOutlined />,
          label: '线索分配',
          path: '/allocation',
        },
        {
          key: 'showings-queue',
          icon: <EyeOutlined />,
          label: '带看分配',
          path: '/showings-queue',
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
      key: 'points',
      icon: <TrophyOutlined />,
      label: '积分管理',
      children: [
        { 
          key: 'points-dashboard', 
          icon: <DashboardOutlined />, 
          label: '积分看板', 
          path: '/points'
        },
        { 
          key: 'points-exchange', 
          icon: <GiftOutlined />, 
          label: '积分兑换', 
          path: '/points/exchange'
        },
        { 
          key: 'points-rules', 
          icon: <KeyOutlined />, 
          label: '积分规则', 
          path: '/points/rules'
        },
      ]
    },
    {
      key: 'honor',
      icon: <CrownOutlined />,
      label: '荣誉系统',
      children: [
        { 
          key: 'honor-management', 
          icon: <TrophyOutlined />, 
          label: '荣誉管理', 
          path: '/honor'
        },
        { 
          key: 'achievement-management', 
          icon: <CrownOutlined />, 
          label: '成就管理', 
          path: '/achievement'
        },
      ]
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
          key: 'test-tools',
          icon: <ToolOutlined />,
          label: '测试工具集',
          path: '/test-tools',
        },
        { 
          key: 'roles', 
          icon: <KeyOutlined />, 
          label: '角色权限', 
          path: '/roles'
        },
        { 
          key: 'announcements', 
          icon: <BellOutlined />, 
          label: '公告配置', 
          path: '/announcements'
        },
        { 
          key: 'test', 
          icon: <DatabaseOutlined />, 
          label: '数据库测试', 
          path: '/test'
        },
        {
          key: 'banner-management',
          icon: <HomeOutlined />,
          label: '首页管理',
          path: '/banner-management',
        },
        {
          key: 'load-demo',
          icon: <ExperimentOutlined />,
          label: '加载演示',
          path: '/loading-demo',
        },
        {
          key: 'cache-debug',
          icon: <BugOutlined />,
          label: '缓存调试',
          path: '/cache-debug',
        },
      ]
    },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%'
    }}>
      {/* 上方容器：菜单区域（可滚动） */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0, // 确保flex子元素可以收缩
      }}>
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
          style={{
            border: 'none',
            height: '100%'
          }}
        />
      </div>
      
      {/* 下方容器：导航条区域 */}
      <div style={{
        flexShrink: 0, // 防止收缩
        borderTop: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* 伸缩按钮 */}
        {onCollapse && (
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => onCollapse(!collapsed)}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
          />
        )}
        
        {/* 版本号 */}
        <div style={{ 
          color: '#bbb', 
          fontSize: 12 
        }}>
          v{pkg.version}
        </div>
      </div>
    </div>
  );
};

export default NavigationMenu; 