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
  WalletOutlined,
  FileDoneOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import pkg from '../../package.json';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { PermissionGate } from './PermissionGate';


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
  const { hasPermission, hasRole } = useRolePermissions();

  // 权限检查函数
  const canAccessLeads = () => hasPermission('lead_manage');
  const canAccessDataAnalysis = () => hasPermission('data_analysis');
  const canAccessAllocation = () => hasPermission('allocation_manage');
  const canAccessPointsSummary = () => hasPermission('points_manage');
  const canAccessHonor = () => hasPermission('user_manage');
  const canAccessSystem = () => hasRole('admin');
  const canAccessApproval = () => hasPermission('approval_manage');

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
          key: 'points-dashboard', 
          icon: <DatabaseOutlined />, 
          label: '积分看板', 
          path: '/points',
          className: 'main-menu-item',
        },
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
          key: 'test-tools',
          icon: <ToolOutlined />,
          label: '测试工具集',
          path: '/test-tools',
          className: 'main-menu-item',
          permission: 'admin',
        },
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
          key: 'test', 
          icon: <DatabaseOutlined />, 
          label: '数据库测试', 
          path: '/test',
          className: 'main-menu-item',
          permission: 'admin',
        },
        {
          key: 'banner-management',
          icon: <HomeOutlined />,
          label: '首页管理',
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
          key: 'email-test',
          icon: <MailOutlined />,
          label: '邮件测试',
          path: '/email-test',
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
    console.log(`🔍 [菜单过滤] 开始过滤菜单项，关键词: "${keyword}"`);
    console.log(`🔍 [菜单过滤] 输入菜单项数量: ${items.length}`);
    
    if (!keyword) {
      const filtered = items.filter(item => {
        console.log(`🔍 [菜单过滤] 检查菜单项: ${item.label} (${item.key})`);
        
        // 检查权限或角色
        if (item.permission) {
          console.log(`🔍 [菜单过滤] ${item.label} 需要权限: ${item.permission}`);
          if (item.permission === 'admin') {
            const hasAdminRole = hasRole('admin');
            console.log(`🔍 [菜单过滤] ${item.label} admin角色检查: ${hasAdminRole}`);
            if (!hasAdminRole) {
              console.log(`🚫 [菜单过滤] ${item.label} (${item.key}): 需要admin角色，用户无权限`);
              return false;
            }
          } else {
            const hasPerm = hasPermission(item.permission);
            console.log(`🔍 [菜单过滤] ${item.label} 权限检查 ${item.permission}: ${hasPerm}`);
            if (!hasPerm) {
              console.log(`🚫 [菜单过滤] ${item.label} (${item.key}): 需要${item.permission}权限，用户无权限`);
              return false;
            }
          }
        } else {
          console.log(`🔍 [菜单过滤] ${item.label} 无权限要求`);
        }
        
        // 检查子菜单
        if (item.children) {
          console.log(`🔍 [菜单过滤] ${item.label} 有子菜单，开始过滤子菜单`);
          const filteredChildren = filterMenu(item.children, keyword);
          console.log(`🔍 [菜单过滤] ${item.label} 子菜单过滤结果: ${filteredChildren.length} 个`);
          if (filteredChildren.length === 0) {
            console.log(`🚫 [菜单过滤] ${item.label} (${item.key}): 所有子菜单都被过滤，隐藏父菜单`);
            return false;
          }
          // 更新子菜单
          item.children = filteredChildren;
          console.log(`✅ [菜单过滤] ${item.label} (${item.key}): 显示父菜单，保留 ${filteredChildren.length} 个子菜单`);
          return true;
        }
        console.log(`✅ [菜单过滤] ${item.label} (${item.key}): 显示菜单项`);
        return true;
      });
      
      console.log(`🔍 [菜单过滤] 过滤后菜单项数量: ${filtered.length}`);
      return filtered;
    }
    
    // 搜索模式的处理逻辑保持不变
    const lower = keyword.toLowerCase();
    return items
      .map((item: any) => {
        // 检查权限或角色
        if (item.permission) {
          if (item.permission === 'admin') {
            if (!hasRole('admin')) {
              console.log(`🚫 [菜单搜索过滤] ${item.label} (${item.key}): 需要admin角色，用户无权限`);
              return null;
            }
          } else if (!hasPermission(item.permission)) {
            console.log(`🚫 [菜单搜索过滤] ${item.label} (${item.key}): 需要${item.permission}权限，用户无权限`);
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