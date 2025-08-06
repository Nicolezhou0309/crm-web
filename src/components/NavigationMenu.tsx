import React from 'react';
import { Menu, Button, Input } from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
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
  SearchOutlined,
  WalletOutlined,
  FileDoneOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import pkg from '../../package.json';
import { useRolePermissions } from '../hooks/useRolePermissions';


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
  const { hasPermission, hasRole, loading: permissionsLoading, isSuperAdmin } = useRolePermissions();

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
          permission: 'lead_manage',
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
    // 数据分析菜单
    {
      key: 'data-analysis',
      icon: <BarChartOutlined />,
      label: '线索分析',
      path: '/data-analysis',
      className: 'main-menu-item',
      permission: 'data_analysis',
    },
    // 直播报名菜单
    {
      key: 'live-stream-registration',
      icon: <VideoCameraOutlined />,
      label: '直播报名',
      path: '/live-stream-registration',
      className: 'main-menu-item',
    },

    // 直播管理菜单
    {
      key: 'live-stream-management',
      icon: <VideoCameraOutlined />,
      label: '直播管理',
      path: '/live-stream-management',
      className: 'main-menu-item',
      permission: 'live_stream_manage',
    },

    // 分配管理一级菜单
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
          permission: 'allocation_manage',
        },
        {
          key: 'showings-queue',
          icon: <EyeOutlined />,
          label: '带看分配',
          path: '/showings-queue',
          className: 'main-menu-item',
          permission: 'allocation_manage',
        },
      ]
    },

    {
      key: 'points',
      icon: <TrophyOutlined />,
      label: '积分管理',
      className: 'main-menu-submenu-title',
      children: [
        { 
          key: 'points-summary', 
          icon: <WalletOutlined />, 
          label: '积分汇总', 
          path: '/points-summary',
          className: 'main-menu-item',
          permission: 'points_manage',
        },
        { 
          key: 'points-exchange', 
          icon: <GiftOutlined />, 
          label: '积分兑换', 
          path: '/points/exchange',
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
          permission: 'user_manage',
        },
        { 
          key: 'achievement-management', 
          icon: <CrownOutlined />, 
          label: '成就管理', 
          path: '/achievement',
          className: 'main-menu-item',
          permission: 'user_manage',
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
      permission: 'admin',
      children: [
        { 
          key: 'roles', 
          icon: <KeyOutlined />, 
          label: '角色权限', 
          path: '/roles',
          className: 'main-menu-item',
          permission: 'admin',
        },
        { 
          key: 'announcements', 
          icon: <BellOutlined />, 
          label: '公告配置', 
          path: '/announcements',
          className: 'main-menu-item',
          permission: 'admin',
        },
        {
          key: 'banner-management',
          icon: <HomeOutlined />,
          label: '资源位管理',
          path: '/banner-management',
          className: 'main-menu-item',
          permission: 'admin',
        },
        {
          key: 'load-demo',
          icon: <ExperimentOutlined />,
          label: '加载演示',
          path: '/loading-demo',
          className: 'main-menu-item',
          permission: 'admin',
        },
        {
          key: 'notification-templates',
          icon: <BellOutlined />,
          label: '通知模板管理',
          path: '/notification-templates',
          className: 'main-menu-item',
          permission: 'admin',
        },
      ]
    },
    // 审批管理一级菜单
    {
      key: 'approval-flows',
      icon: <SolutionOutlined />,
      label: '审批管理',
      className: 'main-menu-submenu-title',
      children: [
        {
          key: 'approval-flows-list',
          icon: <SolutionOutlined />,
          label: '审批流管理',
          path: '/approval-flows',
          className: 'main-menu-item',
          permission: 'approval_manage',
        },
        {
          key: 'approval-details',
          icon: <FileDoneOutlined />,
          label: '审批明细',
          path: '/approval-details',
          className: 'main-menu-item',
        },
        {
          key: 'approval-performance',
          icon: <DashboardOutlined />,
          label: '性能监控',
          path: '/approval-performance',
          className: 'main-menu-item',
          permission: 'approval_manage',
        },
      ]
    },
  ];

  // 递归过滤菜单项，包含权限检查
  function filterMenu(items: any[], keyword: string): any[] {
    
    // 如果权限还在加载中，返回空数组
    if (permissionsLoading) {
      return [];
    }
    
    if (!keyword) {
      const filtered = items.filter(item => {
        
        // 检查权限或角色
        if (item.permission) {
          if (item.permission === 'admin') {
            // 检查是否有管理员角色
            const hasAdminRole = hasRole('admin') || hasRole('super_admin') || hasRole('system_admin');
            if (!hasAdminRole && !isSuperAdmin) {
              return false;
            }
          } else {
            const hasPerm = hasPermission(item.permission);
            if (!hasPerm) {
              return false;
            }
          }
        } else {
          // 没有权限要求，继续处理
        }
        
        // 检查子菜单
        if (item.children) {
          const filteredChildren = filterMenu(item.children, keyword);
          if (filteredChildren.length === 0) {
            return false;
          }
          // 更新子菜单
          item.children = filteredChildren;
          return true;
        }
        return true;
      });
      
      return filtered;
    }
    
    // 搜索模式的处理逻辑保持不变
    const lower = keyword.toLowerCase();
    return items
      .map((item: any) => {
        // 检查权限或角色
        if (item.permission) {
          if (item.permission === 'admin') {
            const hasAdminRole = hasRole('admin') || hasRole('super_admin') || hasRole('system_admin');
            if (!hasAdminRole && !isSuperAdmin) {
              return null;
            }
          } else if (!hasPermission(item.permission)) {
            return null;
          }
        }
        
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

  // 调试信息
  React.useEffect(() => {
    if (!permissionsLoading) {
      // 权限加载完成后的处理逻辑可以在这里添加
    }
  }, [permissionsLoading, isSuperAdmin, hasPermission, hasRole, filteredMenuItems.length]);

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
        {/* 权限加载状态 */}
        {permissionsLoading && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#999',
            fontSize: '12px'
          }}>
            正在加载权限...
          </div>
        )}
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