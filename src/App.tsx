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
  TrophyOutlined,
  CrownOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import LottieLogo from './components/LottieLogo';
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
import { HonorManagement } from './pages/HonorManagement';
import { AchievementManagement } from './pages/AchievementManagement';
import './App.css';
import zhCN from 'antd/locale/zh_CN';
import PrivateRoute from './components/PrivateRoute';
import { NotificationCenter } from './components/NotificationCenter';
import { PermissionGate } from './components/PermissionGate';
import { Badge, Popover, Drawer } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useAchievements } from './hooks/useAchievements';
import { supabase } from './supaClient';
import { getUserPointsInfo, getCurrentProfileId } from './api/pointsApi';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import ShowingsQueueManagement from './pages/ShowingsQueueManagement';
import BannerManagement from './pages/BannerManagement';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';


const { Sider, Content, Header } = Layout;
const { Title } = Typography;

// 彻底删除旧的menuItems相关children/path等所有无用代码块，只保留如下：
const menuItems: MenuProps['items'] = [
  {
    label: '跟进记录',
    key: 'followups',
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
  const [collapsed, setCollapsed] = React.useState(false);
  const [siderWidth, setSiderWidth] = React.useState(220);
  const minSiderWidth = 56;
  const maxSiderWidth = 320;
  const navigate = useNavigate();
  const location = useLocation();

  
  // 头像状态管理
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);
  const [avatarLoading, setAvatarLoading] = React.useState(true);
  // 用户积分状态管理
  const [userPoints, setUserPoints] = React.useState<number>(0);
  const [profileId, setProfileId] = React.useState<number | null>(null);
  
  // 自动连接通知系统
  const { unreadCount } = useRealtimeNotifications();
  
  // 详细通知抽屉状态
  const [notificationDrawerVisible, setNotificationDrawerVisible] = React.useState(false);
  const [menuCurrent, setMenuCurrent] = React.useState('');
  const onMenuClick: MenuProps['onClick'] = e => {
    setMenuCurrent(e.key);
    if (e.key === 'followups') navigate('/followups');
  };

  // 获取头像URL的函数
  const fetchAvatar = React.useCallback(async () => {
    setAvatarLoading(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', data.user.id)
        .single();
      setAvatarUrl(profile?.avatar_url || undefined);
    } else {
      setAvatarUrl(undefined);
    }
    setAvatarLoading(false);
  }, []);

  // 获取用户积分信息
  const loadUserPoints = React.useCallback(async (id: number) => {
    try {
      const data = await getUserPointsInfo(id);
      setUserPoints(data.wallet.total_points || 0);
    } catch (err) {
      console.error('获取用户积分失败:', err);
    }
  }, []);

  // 监听头像刷新事件
  React.useEffect(() => {
    fetchAvatar();
    
    // 监听 localStorage 事件
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'avatar_refresh_token') {
        fetchAvatar();
      }
    };
    
    // 监听 window 自定义事件
    const handleAvatarRefresh = () => {
      fetchAvatar();
    };
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('avatar_refresh_token', handleAvatarRefresh);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('avatar_refresh_token', handleAvatarRefresh);
    };
  }, [fetchAvatar]);

  // 获取用户ID和积分
  React.useEffect(() => {
    const fetchUserInfo = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const id = await getCurrentProfileId();
        setProfileId(id);
      }
    };
    fetchUserInfo();
  }, []);
  
  React.useEffect(() => {
    if (profileId) {
      loadUserPoints(profileId);
    }
  }, [profileId, loadUserPoints]);

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

  const { getEquippedAvatarFrame } = useAchievements();
  const equippedFrame = getEquippedAvatarFrame();
  // 兼容icon_url字段和frame_data.icon_url
  const frameUrl = (equippedFrame && (equippedFrame as any).icon_url) || equippedFrame?.frame_data?.icon_url;

  // 悬浮卡片内容
  const userCardContent = (
    <div style={{ minWidth: 320, padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
      {/* 积分余额展示 - 移到顶部 */}
      <div
        style={{
          padding: '10px 0px 20px 20px',
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931a 100%)',
          borderRadius: '12px 12px 12px 12px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '0px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, filter 0.18s', // 移除 transform
          boxShadow: '0 2px 8px rgba(255,107,53,0.10)',
          userSelect: 'none',
        }}
        onClick={() => navigate('/points')}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,107,53,0.22)';
          e.currentTarget.style.filter = 'brightness(1.08)';
          // 添加扫光元素
          let shine = document.createElement('div');
          shine.className = 'points-shine-effect';
          shine.style.position = 'absolute';
          shine.style.top = '0';
          shine.style.left = '-60%';
          shine.style.width = '60%';
          shine.style.height = '100%';
          shine.style.background = 'linear-gradient(120deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.0) 100%)';
          shine.style.pointerEvents = 'none';
          shine.style.zIndex = '10';
          shine.style.transform = 'skewX(-20deg)';
          shine.style.animation = 'shine-move 0.9s linear 1';
          shine.style.borderRadius = '12px';
          e.currentTarget.appendChild(shine);
          shine.addEventListener('animationend', () => {
            if (shine.parentNode) shine.parentNode.removeChild(shine);
          });
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,107,53,0.10)';
          e.currentTarget.style.filter = 'none';
        }}
        title="点击查看积分看板"
      >
        {/* 左侧积分信息 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', zIndex: 2, position: 'relative' }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.5px' }}>
            {userPoints.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.5 }}>
            剩余积分
          </span>
        </div>
        {/* 右侧装饰Logo */}
        <div style={{
          position: 'absolute',
          right: '-30px',
          top: '-20px',
          width: '120px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.15
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#f7931a'
          }}>
            🏆
          </div>
        </div>
      </div>
              {/* 通知中心 */}
        <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <NotificationCenter 
              simple={true} 
              onViewAll={() => setNotificationDrawerVisible(true)}
            />
          </div>
        </div>
      {/* 操作按钮 - 左右并排 */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px', background: '#fff', borderRadius: '0px 0px 12px 12px' }}>
        {/* 个人中心按钮 */}
        <Button
          type="text"
          size="small"
          icon={<UserOutlined />}
          onClick={() => {
            navigate('/profile');
          }}
          style={{
            flex: 1,
            height: '32px',
            fontSize: '14px',
            color: '#666',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#1890ff';
            e.currentTarget.style.backgroundColor = '#f0f8ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          个人中心
        </Button>
        
        {/* 退出登录按钮 */}
        <Button
          type="text"
          size="small"
          icon={<LogoutOutlined />}
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          style={{
            flex: 1,
            height: '32px',
            fontSize: '14px',
            color: '#666',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ff4d4f';
            e.currentTarget.style.backgroundColor = '#fff2f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          退出登录
        </Button>
      </div>
    </div>
  );
  
  // 详细通知抽屉
  const notificationDrawer = (
    <Drawer
      title="通知中心"
      placement="right"
      width={400}
      open={notificationDrawerVisible}
      onClose={() => setNotificationDrawerVisible(false)}
      styles={{
        body: { padding: 0 }
      }}
    >
      <NotificationCenter simple={false} />
    </Drawer>
  );

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 顶部导航条 */}
        <Header className="app-header" style={{ height: 60, padding: '0 16px', display: 'flex', alignItems: 'center', position: 'fixed', top: 0, left: 0, right: 0, width: '100%', zIndex: 1000, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          {/* 顶部导航菜单，仅跟进记录 */}
          <Menu
            onClick={onMenuClick}
            selectedKeys={location.pathname === '/followups' ? ['followups'] : []}
            mode="horizontal"
            items={menuItems}
            style={{ minWidth: 120, borderBottom: 'none', background: 'transparent', marginRight: 24 }}
            className="custom-followup-menu"
          />
          <div
            className="app-title"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              margin: 'auto',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              transform: 'scale(1.5)',
              pointerEvents: 'none',
            }}
          >
            <LottieLogo width={40} height={40} />
            <img src="/VLINKER.svg" alt="VLINKER" style={{ height: 36, marginLeft: 4, verticalAlign: 'middle' }} />
          </div>
          <div className="app-header-user" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <UserMenu />
          </div>
          {/* 头像悬浮卡片 */}
          <Popover
            content={userCardContent}
            title={null}
            placement="bottomRight"
            trigger="hover"
            overlayStyle={{ 
              maxWidth: 340,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <span style={{ position: 'absolute', top: 2, right: 48, zIndex: 10 }}>
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: '#fff',
                  overflow: 'visible',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  transform: 'scale(0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 0 #fff',
                  position: 'relative',
                }}
                title="点击进入个人中心"
                onClick={() => navigate('/profile')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(0.84)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(0.8)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 用户头像 - 用Badge包裹 */}
                {avatarLoading ? (
                  <div
                    style={{
                      width: 58.5,
                      height: 58.5,
                      borderRadius: '50%',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        border: '2px solid #e0e0e0',
                        borderTop: '2px solid #1890ff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  </div>
                ) : avatarUrl ? (
                  <Badge
                    count={unreadCount}
                    size="small"
                    showZero={false}
                    overflowCount={99}
                    style={{
                      '--antd-badge-dot-size': '8px',
                      '--antd-badge-size': '16px',
                    } as React.CSSProperties}
                    styles={{
                      indicator: {
                        top: '0px',
                        right: '0px',
                        transform: 'scale(1.3)',
                        zIndex: 999,
                        transition: 'none',
                        animation: 'none',
                      }
                    }}
                  >
                    <img
                      src={avatarUrl}
                      alt="头像"
                      style={{
                        width: 58.5,
                        height: 58.5,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        background: '#fff',
                        zIndex: 1,
                      }}
                      onLoad={() => setAvatarLoading(false)}
                      onError={() => setAvatarLoading(false)}
                    />
                  </Badge>
                ) : (
                  <div
                    style={{
                      width: 58.5,
                      height: 58.5,
                      borderRadius: '50%',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <span style={{ fontSize: 24, color: '#999' }}>👤</span>
                  </div>
                )}
                {/* 头像框 */}
                {frameUrl && (
                  <img
                    src={frameUrl}
                    alt="头像框"
                    style={{
                      width: 117,
                      height: 117,
                      borderRadius: '50%',
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
            </span>
          </Popover>
        </Header>
        <Layout style={{ marginTop: 60 }}>
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
                        <LottieLogo 
                          width={56} 
                          height={56} 
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
                  <Route path="/showings-queue" element={<ShowingsQueueManagement />} />

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
                  <Route path="/honor" element={
                    <PermissionGate permission="admin" fallback={<Error403 />}>
                      <HonorManagement />
                    </PermissionGate>
                  } />
                  <Route path="/achievement" element={
                    <PermissionGate permission="admin" fallback={<Error403 />}>
                      <AchievementManagement />
                    </PermissionGate>
                  } />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/banner-management" element={<BannerManagement />} />
                  <Route path="*" element={<Error404 />} />
                </Routes>
              </PrivateRoute>
            </Content>
          </Layout>
        </Layout>
        {notificationDrawer}
      </div>
    </ConfigProvider>
  );
};

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
      {/* 扫光动画全局样式 */}
      <style>{`
        @keyframes shine-move {
          0% { left: -60%; opacity: 0; }
          10% { opacity: 0.2; }
          50% { left: 100%; opacity: 0.35; }
          100% { left: 120%; opacity: 0; }
        }
      `}</style>
    </ErrorBoundary>
  );
}
