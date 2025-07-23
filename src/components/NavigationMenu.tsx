import React from 'react';
import { Menu, Button, Input } from 'antd';
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
  ToolOutlined,
  MailOutlined,
  SearchOutlined,
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
  const [search, setSearch] = React.useState('');

  const menuItems = [
    { 
      key: 'index', 
      icon: <HomeOutlined />, 
      label: '首页', 
      path: '/',
      className: 'main-menu-item',
    },
    {
      key: 'clues',
      icon: <SolutionOutlined />,
      label: '线索管理',
      className: 'main-menu-submenu-title',
      children: [
        { 
          key: 'leads', 
          icon: <FileTextOutlined />, 
          label: '线索列表', 
          path: '/leads',
          className: 'main-menu-item',
        },
        { 
          key: 'followups', 
          icon: <UserOutlined />, 
          label: '跟进记录', 
          path: '/followups',
          className: 'main-menu-item',
        },
        { 
          key: 'showings', 
          icon: <EyeOutlined />, 
          label: '带看记录', 
          path: '/showings',
          className: 'main-menu-item',
        },
        { 
          key: 'deals', 
          icon: <CheckCircleOutlined />, 
          label: '成交记录', 
          path: '/deals',
          className: 'main-menu-item',
        },
      ]
    },
    // 新增分配管理一级菜单
    {
      key: 'allocation-manage',
      icon: <BranchesOutlined />,
      label: '分配管理',
      className: 'main-menu-submenu-title',
      children: [
        {
          key: 'allocation',
          icon: <BranchesOutlined />,
          label: '线索分配',
          path: '/allocation',
          className: 'main-menu-item',
        },
        {
          key: 'showings-queue',
          icon: <EyeOutlined />,
          label: '带看分配',
          path: '/showings-queue',
          className: 'main-menu-item',
        },
      ]
    },
    { 
      key: 'dashboard', 
      icon: <DashboardOutlined />, 
      label: '仪表盘', 
      path: '/dashboard',
      className: 'main-menu-item',
    },
    {
      key: 'points',
      icon: <TrophyOutlined />,
      label: '积分管理',
      className: 'main-menu-submenu-title',
      children: [
        { 
          key: 'points-dashboard', 
          icon: <DashboardOutlined />, 
          label: '积分看板', 
          path: '/points',
          className: 'main-menu-item',
        },
        { 
          key: 'points-exchange', 
          icon: <GiftOutlined />, 
          label: '积分兑换', 
          path: '/points/exchange',
          className: 'main-menu-item',
        },
        { 
          key: 'points-rules', 
          icon: <KeyOutlined />, 
          label: '积分规则', 
          path: '/points/rules',
          className: 'main-menu-item',
        },
      ]
    },
    {
      key: 'honor',
      icon: <CrownOutlined />,
      label: '荣誉系统',
      className: 'main-menu-submenu-title',
      children: [
        { 
          key: 'honor-management', 
          icon: <TrophyOutlined />, 
          label: '荣誉管理', 
          path: '/honor',
          className: 'main-menu-item',
        },
        { 
          key: 'achievement-management', 
          icon: <CrownOutlined />, 
          label: '成就管理', 
          path: '/achievement',
          className: 'main-menu-item',
        },
      ]
    },
    { 
      key: 'departments', 
      icon: <AppstoreOutlined />, 
      label: '部门管理', 
      path: '/departments',
      className: 'main-menu-item',
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      className: 'main-menu-submenu-title',
      children: [
        {
          key: 'test-tools',
          icon: <ToolOutlined />,
          label: '测试工具集',
          path: '/test-tools',
          className: 'main-menu-item',
        },
        { 
          key: 'roles', 
          icon: <KeyOutlined />, 
          label: '角色权限', 
          path: '/roles',
          className: 'main-menu-item',
        },
        { 
          key: 'announcements', 
          icon: <BellOutlined />, 
          label: '公告配置', 
          path: '/announcements',
          className: 'main-menu-item',
        },
        { 
          key: 'test', 
          icon: <DatabaseOutlined />, 
          label: '数据库测试', 
          path: '/test',
          className: 'main-menu-item',
        },
        {
          key: 'banner-management',
          icon: <HomeOutlined />,
          label: '首页管理',
          path: '/banner-management',
          className: 'main-menu-item',
        },
        {
          key: 'load-demo',
          icon: <ExperimentOutlined />,
          label: '加载演示',
          path: '/loading-demo',
          className: 'main-menu-item',
        },
        {
          key: 'email-test',
          icon: <MailOutlined />,
          label: '邮件测试',
          path: '/email-test',
          className: 'main-menu-item',
        },
        {
          key: 'notification-templates',
          icon: <BellOutlined />,
          label: '通知模板管理',
          path: '/notification-templates',
          className: 'main-menu-item',
        },
      ]
    },
  ];

  // 递归过滤菜单项
  function filterMenu(items: any[], keyword: string): any[] {
    if (!keyword) return items;
    const lower = keyword.toLowerCase();
    return items
      .map((item: any) => {
        if (item.children) {
          const filteredChildren = filterMenu(item.children, keyword);
          if (filteredChildren.length > 0 || (item.label && String(item.label).toLowerCase().includes(lower))) {
            return { ...item, children: filteredChildren };
          }
          return null;
        }
        if (item.label && String(item.label).toLowerCase().includes(lower)) {
          return item;
        }
        return null;
      })
      .filter(Boolean);
  }

  const filteredMenuItems = filterMenu(menuItems, search);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
    }}>
      {/* 顶部搜索框 */}
      {!collapsed && (
        <div style={{ padding: '0px 12px 16px 12px', background: '#fff' }}>
          <Input
            className="custom-search-input"
            placeholder="搜索菜单"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            size={collapsed ? 'small' : 'middle'}
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          />
        </div>
      )}
      {/* 菜单区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0, // 确保flex子元素可以收缩
        width: '100%',
        padding: '0 8px', // 只在这里加左右间距
      }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={e => {
            onMenuClick(e.key); // 只传 key
          }}
          inlineCollapsed={collapsed}
          items={filteredMenuItems}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: '0px',
            boxShadow: 'none',
            border: 'none',
          }}
        />
      </div>
      {/* 下方容器：导航条区域 */}
      <div style={{
        flexShrink: 0, // 防止收缩
        borderTop: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '16px',
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