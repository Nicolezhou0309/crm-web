import React from 'react';
import { Layout, Typography, Button, ConfigProvider } from 'antd';
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
  HistoryOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import HouseLogo from './components/HouseLogo';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TestSupabase from './pages/TestSupabase';
import LeadsList from './pages/LeadsList';
import ShowingsList from './pages/ShowingsList';

import Index from './pages/Index';
import Error404 from './pages/Error404';
import Error403 from './pages/Error403';
import Error500 from './pages/Error500';
import DealsList from './pages/DealsList';
import FollowupsGroupList from './pages/FollowupsGroupList';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import UserMenu from './components/UserMenu';
import NavigationMenu from './components/NavigationMenu';
import Profile from './pages/Profile';
import DepartmentPage from './pages/DepartmentPage';
import RolePermissionManagement from './pages/RolePermissionManagement';

import AllocationManagement from './pages/AllocationManagement';
import ResetPassword from './pages/ResetPassword';
import PointsDashboard from './pages/PointsDashboard';
import PointsExchange from './pages/PointsExchange';
import PointsRules from './pages/PointsRules';
import AnnouncementManagement from './pages/AnnouncementManagement';
import './App.css';
import zhCN from 'antd/locale/zh_CN';
import PrivateRoute from './components/PrivateRoute';
import { NotificationCenter } from './components/NotificationCenter';
import { PermissionGate } from './components/PermissionGate';
import { Badge, Drawer } from 'antd';
import { BellOutlined } from '@ant-design/icons';


const { Sider, Content, Header } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: 'index', icon: <HomeOutlined />, label: '首页', path: '/' },
  {
    key: 'clues',
    icon: <SolutionOutlined />,
    label: '线索管理',
    children: [
      { key: 'leads', icon: <FileTextOutlined />, label: '线索列表', path: '/leads' },
      { key: 'followups', icon: <UserOutlined />, label: '跟进记录', path: '/followups' },
      { key: 'allocation', icon: <BranchesOutlined />, label: '线索分配', path: '/allocation' },
      { key: 'showings', icon: <EyeOutlined />, label: '带看记录', path: '/showings' },
      { key: 'deals', icon: <CheckCircleOutlined />, label: '成交记录', path: '/deals' },
    ]
  },
  { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', path: '/dashboard' },
  {
    key: 'points',
    icon: <TrophyOutlined />,
    label: '积分管理',
    children: [
      { key: 'points-dashboard', icon: <DashboardOutlined />, label: '积分看板', path: '/points' },
      { key: 'points-exchange', icon: <GiftOutlined />, label: '积分兑换', path: '/points/exchange' },
      { key: 'points-rules', icon: <KeyOutlined />, label: '积分规则', path: '/points/rules' },
    ]
  },
  { key: 'departments', icon: <AppstoreOutlined />, label: '部门管理', path: '/departments' },
  {
    key: 'system',
    icon: <SettingOutlined />,
    label: '系统管理',
    children: [
      { key: 'roles', icon: <KeyOutlined />, label: '角色权限', path: '/roles' },
      { key: 'announcements', icon: <BellOutlined />, label: '公告配置', path: '/announcements' },
      { key: 'test', icon: <DatabaseOutlined />, label: '数据库测试', path: '/test' },
    ]
  },
];

// 全局错误边界
class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: any, _errorInfo: any) {
    // 可以上报错误
    // console.error('ErrorBoundary caught an error', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <Error500 />;
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  console.log('🔍 App 组件渲染');
  
  const [collapsed, setCollapsed] = React.useState(false);
  const [siderWidth, setSiderWidth] = React.useState(220);
  const minSiderWidth = 56;
  const maxSiderWidth = 320;
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationDrawerVisible, setNotificationDrawerVisible] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  console.log(`📊 App 通知状态: 未读数量 = ${unreadCount}`);

  // 修正高亮逻辑：只有严格等于'/'时高亮首页，其它优先匹配最长path
  const selectedKey = (() => {
    if (location.pathname === '/') return 'index';
    let match = '';
    let maxLen = 0;
    for (const group of menuItems) {
      if (group.children) {
        for (const item of group.children) {
          if (item.path && location.pathname.startsWith(item.path) && item.path.length > maxLen) {
            match = item.key;
            maxLen = item.path.length;
          }
        }
      } else if (group.path && location.pathname.startsWith(group.path) && group.path.length > maxLen) {
        match = group.key;
        maxLen = group.path.length;
      }
    }
    return match;
  })();

  // 拖动调整Sider宽度
  const handleSiderResize = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const startX = e.clientX;
    const startWidth = siderWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(
        Math.max(minSiderWidth, startWidth + moveEvent.clientX - startX),
        maxSiderWidth
      );
      setSiderWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // 判断是否为公开页面（不需要登录）
  const isPublicPage = location.pathname === '/login' || location.pathname === '/set-password';

  if (isPublicPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 顶部导航条 */}
        <Header className="app-header">
          <div className="app-title">
            <HouseLogo 
              width={40} 
              height={40} 
              style={{ 
                marginRight: '16px'
              }} 
            />
            <span>长租公寓CRM系统</span>
          </div>
          <div className="app-header-user" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* 通知中心入口 */}
            <Badge
              count={unreadCount}
              size="default"
              showZero={false}
              overflowCount={99}
              className="notification-badge-number"
            >
              <BellOutlined
                style={{
                  fontSize: 22,
                  cursor: 'pointer',
                  color: unreadCount > 0 ? '#fa541c' : '#888',
                  transition: 'color 0.2s'
                }}
                onClick={() => {
                  console.log('🖱️ 点击通知铃铛，打开通知中心');
                  setNotificationDrawerVisible(true);
                }}
                title="通知中心"
              />
            </Badge>
            <UserMenu />
          </div>
        </Header>
        {/* 始终渲染NotificationCenter以保持Hook运行 */}
        <div style={{ display: 'none' }}>
          <NotificationCenter onNotificationChange={(count) => {
            console.log(`📢 通知数量回调: ${count}`);
            setUnreadCount(count);
          }} />
        </div>
        
        <Drawer
          title="通知中心"
          placement="right"
          width={480}
          open={notificationDrawerVisible}
          onClose={() => {
            console.log('❌ 关闭通知中心');
            setNotificationDrawerVisible(false);
          }}
          destroyOnClose
        >
          <NotificationCenter onNotificationChange={(count) => {
            console.log(`📢 通知数量回调: ${count}`);
            setUnreadCount(count);
          }} />
        </Drawer>
        <Layout style={{ marginTop: 56 }}>
          <Sider
            width={siderWidth}
            collapsed={collapsed}
            collapsible
            onCollapse={setCollapsed}
            trigger={null}
            className="sider-main"
          >
            <NavigationMenu
              selectedKey={selectedKey}
              onMenuClick={(path) => navigate(path)}
              collapsed={collapsed}
              onCollapse={setCollapsed}
            />
            {/* 拖动条 */}
            {!collapsed && (
              <div
                className="sider-resize-bar"
                onMouseDown={handleSiderResize}
              />
            )}
          </Sider>
          <Layout style={{ marginLeft: collapsed ? minSiderWidth : siderWidth, background: 'transparent', transition: 'margin-left 0.2s', borderRadius: '12px 0 0 12px' }}>
            <Content className="content-main">
              <PrivateRoute>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={
                    <div style={{
                      background: '#fff',
                      borderRadius: 16,
                      boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)',
                      padding: 32,
                      minHeight: 500,
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: 24 
                      }}>
                        <HouseLogo 
                          width={56} 
                          height={56} 
                          style={{ 
                            marginRight: '20px'
                          }} 
                        />
                        <Title level={4} style={{ 
                          fontWeight: 700, 
                          color: '#222',
                          margin: 0
                        }}>
                          欢迎使用长租公寓CRM系统
                        </Title>
                      </div>
                      <p style={{ fontSize: 16, color: '#666' }}>
                        这是一个现代化的客户关系管理系统，帮助您更好地管理销售线索和客户关系。
                      </p>
                      <Button type="primary" size="large" style={{ marginTop: 24 }}>
                        开始使用
                      </Button>
                    </div>
                  } />
                  <Route path="/leads" element={<LeadsList />} />
                  <Route path="/followups" element={<FollowupsGroupList />} />
                  <Route path="/showings" element={<ShowingsList />} />

                  <Route path="/deals" element={<DealsList />} />
                  <Route path="/allocation" element={<AllocationManagement />} />
                  <Route path="/allocation-management" element={<AllocationManagement />} />

                  {/* 积分系统路由 */}
                          <Route path="/points" element={<PointsDashboard />} />
        <Route path="/points/exchange" element={<PointsExchange />} />
        <Route path="/points/rules" element={<PointsRules />} />

                  <Route path="/test" element={<TestSupabase />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/403" element={<Error403 />} />
                  <Route path="/departments" element={<DepartmentPage />} />
                  <Route path="/roles" element={<RolePermissionManagement />} />
                  <Route path="/announcements" element={
                    <PermissionGate permission="manage_announcements" fallback={<Error403 />}>
                      <AnnouncementManagement />
                    </PermissionGate>
                  } />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<Error404 />} />
                </Routes>
              </PrivateRoute>
            </Content>
          </Layout>
        </Layout>
      </div>
    </ConfigProvider>
  );
};

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
