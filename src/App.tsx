import React from 'react';
import { Layout, Button, ConfigProvider } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import LottieLogo from './components/LottieLogo';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import LeadsList from './pages/LeadsList';
import ShowingsList from './pages/ShowingsList';

import Index from './pages/Index';
import Error404 from './pages/Error404';
import Error403 from './pages/Error403';
import Error500 from './pages/Error500';
import DealsList from './pages/DealsList';

import Followups from './pages/Followups';
// import FollowupsCalendarView from './pages/FollowupsCalendarView';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import UserMenu from './components/UserMenu';
import NavigationMenu from './components/NavigationMenu';

import DepartmentPage from './pages/DepartmentPage';
import RolePermissionManagement from './pages/RolePermissionManagement';

import AllocationManagement from './pages/AllocationManagement';
import ResetPassword from './pages/ResetPassword';

import PointsExchange from './pages/PointsExchange';
import AnnouncementManagement from './pages/AnnouncementManagement';
import { HonorManagement } from './pages/HonorManagement';
import { AchievementManagement } from './pages/AchievementManagement';

import './App.css';
import zhCN from 'antd/locale/zh_CN';
import PrivateRoute from './components/PrivateRoute';
import { NotificationCenter } from './components/NotificationCenter';
import { PermissionGate } from './components/PermissionGate';
import { Badge, Popover, Drawer } from 'antd';
import { useAchievements } from './hooks/useAchievements';
import { getUserPointsInfo } from './api/pointsApi';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import ShowingsQueueManagement from './pages/ShowingsQueueManagement';
import BannerManagement from './pages/BannerManagement';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { UserProvider, useUser } from './context/UserContext';
import { useAuth } from './hooks/useAuth';
import { useRolePermissions } from './hooks/useRolePermissions';
import NotificationTemplateManager from './pages/NotificationTemplateManager';
import ApprovalFlowManagement from './pages/ApprovalFlowManagement';
import PointsSummary from './pages/PointsSummary';
import ApprovalDetails from './pages/ApprovalDetails';
import ApprovalPerformance from './pages/ApprovalPerformance';
import DataAnalysis from './pages/DataAnalysis';
import OnboardingPage from './pages/OnboardingPage';
import LiveStreamRegistration from './pages/LiveStreamRegistration';
import LiveStreamManagement from './pages/LiveStreamManagement';
import MetroDistanceCalculatorPage from './pages/MetroDistanceCalculatorPage';




// import LiveStreamManagement from './pages/LiveStreamManagement';
// 暂时移除AuthErrorHandler，避免循环
// import { AuthErrorHandler } from './components/AuthErrorHandler';


const { Sider, Content, Header } = Layout;

// 直接导入手机端组件
import MobileFollowups from './pages/Followups/mobile';
import MobileTabBar from './components/MobileTabBar';
import MobileProfile from './pages/MobileProfile';
import ResponsiveProfile from './pages/ResponsiveProfile';
import MobileShowingsList from './pages/MobileShowingsList';

// 响应式跟进记录组件
const ResponsiveFollowups: React.FC = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  // 检测屏幕尺寸
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // 根据屏幕尺寸渲染不同组件
  if (isMobile) {
    return <MobileFollowups />;
  }

  // 桌面端使用原有组件
  return <Followups />;
};

// 响应式带看记录组件
const ResponsiveShowings: React.FC = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  // 检测屏幕尺寸
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // 根据屏幕尺寸渲染不同组件
  if (isMobile) {
    return <MobileShowingsList />;
  }

  // 桌面端使用原有组件
  return <ShowingsList />;
};



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
  }
  render() {
    if (this.state.hasError) {
      return <Error500 />;
    }
    return this.props.children;
  }
}


const App: React.FC = () => {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
};

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUser();
  const { logout } = useAuth();
  const { hasRole, isSuperAdmin } = useRolePermissions();
  const [collapsed, setCollapsed] = React.useState(false);
  const [siderWidth] = React.useState(220);
  const minSiderWidth = 56;

  // 检查是否为admin角色
  const isAdmin = hasRole('admin') || hasRole('super_admin') || hasRole('system_admin') || isSuperAdmin;

  // 顶部导航菜单项，根据用户角色过滤
  const menuItems: MenuProps['items'] = [
    ...(isAdmin ? [{
      label: '跟进记录',
      key: 'followups',
    }] : []),
    {
      label: '新手入门',
      key: 'onboarding',
    },
  ];
  
  // 手机端检测
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // 初始检查
    checkScreenSize();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);
  
  // 使用统一的认证Hook，让PrivateRoute处理认证逻辑
  // 只保留UI相关的状态管理

  // 侧边栏 key-path 映射
  const keyPathMap: { [key: string]: string } = {
    'index': '/dashboard',
    'leads': '/leads',
    'followups': '/followups',
    'metro-calculator': '/metro-calculator',



    'showings': '/showings',
    'deals': '/deals',
    'allocation': '/allocation',
    'showings-queue': '/showings-queue',


    'points-summary': '/points-summary',
    'points-exchange': '/points/exchange',
    'honor-management': '/honor',
    'achievement-management': '/achievement',
    'departments': '/departments',
    'roles': '/roles',
    'announcements': '/announcements',
    'banner-management': '/banner-management',
    'load-demo': '/loading-demo',
    'notification-templates': '/notification-templates',
    'approval-flows-list': '/approval-flows',
    'approval-details': '/approval-details',
    'approval-performance': '/approval-performance',
    'data-analysis': '/data-analysis',
    'live-stream-registration': '/live-stream-registration',
    'live-stream-management': '/live-stream-management',

  };
  // path-key 反查
  const pathKeyMap: Record<string, string> = {};
  Object.entries(keyPathMap).forEach(([k, v]) => { pathKeyMap[v] = k; });

  // 计算 selectedKey
  const selectedKey = (() => {
    // 如果当前路径是根路径，映射到直播报名页面
    if (location.pathname === '/') {
      return 'live-stream-registration';
    }
    return pathKeyMap[location.pathname] || '';
  })();

  // 侧边栏菜单点击跳转
  const handleMenuClick = (key: string) => {
    const path = keyPathMap[key];
    if (path) navigate(path);
  };

  // 移除以下 useEffect：
  // React.useEffect(() => {
  //   if (location.pathname !== '/set-password' && window.location.hash.includes('access_token')) {
  //     history.replaceState(null, '', window.location.pathname + window.location.search);
  //   }
  // }, [location]);
  
  // 头像状态管理
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);
  const [avatarLoading, setAvatarLoading] = React.useState(true);
  // 用户积分状态管理
  const [userPoints, setUserPoints] = React.useState<number>(0);
  const [profileId, setProfileId] = React.useState<number | null>(null);

  
  // 自动连接通知系统
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsHandled,
    deleteNotification,
    loading: notificationsLoading,
  } = useRealtimeNotifications();

  // 新增：通知音效播放
  const lastUnreadRef = React.useRef(unreadCount);
  React.useEffect(() => {
    if (unreadCount > (lastUnreadRef.current || 0)) {
      // 新增未读，播放音效
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }
    lastUnreadRef.current = unreadCount;
  }, [unreadCount]);
  
  // 详细通知抽屉状态
  const [notificationDrawerVisible, setNotificationDrawerVisible] = React.useState(false);

  // 成就系统 - 必须在所有条件渲染之前调用
  const { getEquippedAvatarFrame } = useAchievements();
  const equippedFrame = getEquippedAvatarFrame();
  // 兼容icon_url字段和frame_data.icon_url
  const frameUrl = (equippedFrame && (equippedFrame as any).icon_url) || equippedFrame?.frame_data?.icon_url;

  // 获取头像URL的函数
  const fetchAvatar = React.useCallback(async () => {
    setAvatarLoading(true);
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    } else {
      setAvatarUrl(undefined);
    }
    setAvatarLoading(false);
  }, [profile]);

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
    if (profile?.id) {
      setProfileId(profile.id);
    }
  }, [profile]);
  
  React.useEffect(() => {
    if (profileId) {
      loadUserPoints(profileId);
    }
  }, [profileId, loadUserPoints]);

  // 自动解锁音频播放权限
  React.useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio('/notification.wav');
      audio.volume = 0;
      audio.play().catch(() => {});
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // 修正高亮逻辑：只有严格等于'/'时高亮首页，其它优先匹配最长path
  // const selectedKey = (() => {
  //   if (location.pathname === '/') return 'index';
  //   let match = '';
  //   let maxLen = 0;
  //   for (const group of menuItems) {
  //     if (group && 'children' in group && group.children) {
  //       for (const item of group.children) {
  //         if (item && 'path' in item && typeof item.path === 'string' && location.pathname.startsWith(item.path) && item.path.length > maxLen) {
  //           match = String(item.key || '');
  //           maxLen = item.path.length;
  //         }
  //       }
  //     } else if (group && 'path' in group && typeof group.path === 'string' && location.pathname.startsWith(group.path) && group.path.length > maxLen) {
  //       match = String(group.key || '');
  //       maxLen = group.path.length;
  //     }
  //   }
  //   return match;
  // })();

  // 判断是否为公开页面（不需要登录）
  const isPublicPage = location.pathname === '/login' || location.pathname === '/set-password';

  // 公开页面（登录页面和设置密码页面）不需要用户认证，直接渲染
  if (isPublicPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    );
  }

  // 非公开页面由PrivateRoute统一处理认证逻辑

  // 悬浮卡片内容
  const userCardContent = (
    <div style={{ minWidth: 320, padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
      {/* 积分余额展示 - 移到顶部 */}
      <div
        style={{
          padding: '10px 0px 20px 20px',
          background: `
            radial-gradient(ellipse at top left, rgba(255, 215, 0, 0.9) 0%, transparent 50%),
            radial-gradient(ellipse at top right, rgba(255, 193, 7, 0.7) 0%, transparent 50%),
            radial-gradient(ellipse at center top, rgba(255, 152, 0, 0.5) 0%, transparent 60%),
            radial-gradient(ellipse at 30% 40%, rgba(255, 193, 7, 0.4) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 60%, rgba(255, 215, 0, 0.3) 0%, transparent 60%),
            linear-gradient(135deg, 
              rgba(255, 215, 0, 0.8) 0%, 
              rgba(255, 193, 7, 0.6) 25%, 
              rgba(255, 152, 0, 0.4) 50%, 
              rgba(255, 193, 7, 0.3) 75%, 
              rgba(255, 215, 0, 0.2) 100%)
          `,
          borderRadius: '12px 12px 12px 12px',
          color: '#382a04',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '0px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, filter 0.18s',
          boxShadow: 'none',
          userSelect: 'none',
        }}
        onClick={() => navigate('/points/exchange')}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.filter = 'brightness(1.03)';
          // 添加扫光元素
          const shine = document.createElement('div');
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
          shine.style.borderRadius = '0';
          e.currentTarget.appendChild(shine);
          shine.addEventListener('animationend', () => {
            if (shine.parentNode) shine.parentNode.removeChild(shine);
          });
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.filter = 'none';
        }}
        title="点击兑换积分"
      >
        {/* 左侧积分信息 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', zIndex: 2, position: 'relative' }}>
          <span style={{ 
            fontSize: 42, 
            fontWeight: 700, 
            letterSpacing: '0.5px', 
            color: '#382a04', 
            fontFamily: '"Micro 5", "Micro 5", monospace',
            lineHeight: 1
          }}>
            {userPoints.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7, color: '#382a04' }}>
            剩余积分
          </span>
        </div>
        {/* 右侧装饰Logo */}
        <div style={{
          position: 'absolute',
          right: '-10px',
          top: '5px',
          width: '120px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
        }}>
          <div>
            <img 
              src="/coin2.svg" 
              alt="coin" 
              style={{ width: '180px', height: '180px' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>
      {/* 通知中心 */}
      <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          <NotificationCenter 
            simple={true} 
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            markAsHandled={markAsHandled}
            deleteNotification={deleteNotification}
            loading={notificationsLoading}
            onViewAll={() => setNotificationDrawerVisible(true)}
          />
        </div>
      </div>
      {/* 操作按钮 - 左右并排 */}
      <div style={{ padding: '16px 16px 8px 16px', display: 'flex', gap: '8px', background: '#fff', borderRadius: 0 }}>
        {/* 个人中心按钮 */}
        <Button
          size="small"
          icon={<UserOutlined />}
          onClick={() => {
            navigate('/profile');
          }}
          style={{
            flex: 1,
            height: '32px',
            fontSize: '14px',
            borderRadius: 8,
          }}
        >
          个人中心
        </Button>
        {/* 退出登录按钮 */}
        <Button
          size="small"
          icon={<LogoutOutlined />}
          onClick={async () => {
            await logout(navigate);
          }}
          style={{
            flex: 1,
            height: '32px',
            fontSize: '14px',
            borderRadius: 8,
            color: '#ff4d4f',
            borderColor: '#ff4d4f',
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
      <NotificationCenter 
        simple={false} 
        notifications={notifications}
        unreadCount={unreadCount}
        markAsRead={markAsRead}
        markAsHandled={markAsHandled}
        deleteNotification={deleteNotification}
        loading={notificationsLoading}
      />
    </Drawer>
  );

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 顶部导航条 */}
        <Header className="app-header" style={{ height: 60, padding: '0 16px', display: 'flex', alignItems: 'center', position: 'fixed', top: 0, left: 0, right: 0, width: '100%', zIndex: 1000, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          {/* 顶部导航菜单，根据用户角色显示 */}
          <Menu
            onClick={e => {
              if (e.key === 'followups') navigate('/followups');
              if (e.key === 'onboarding') navigate('/onboarding');
            }}
            selectedKeys={location.pathname === '/followups' ? ['followups'] : location.pathname === '/onboarding' ? ['onboarding'] : []}
            mode="horizontal"
            items={menuItems}
            style={{ minWidth: 240, borderBottom: 'none', background: 'transparent', marginRight: 24, fontSize: 16 }}
            className="custom-followup-menu"
          />
          {/* 新手入门按钮 */}
          {/* 移除原Button实现 */}
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
                            <img 
                  src="/VLINKER.svg" 
                  alt="VLINKER" 
                  style={{ height: 36, marginLeft: 4, verticalAlign: 'middle' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
          </div>
          <div className="app-header-user" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <UserMenu />
          </div>
          {/* 头像悬浮卡片 - 手机端不显示 */}
          {!isMobile && (
            <Popover
              content={userCardContent}
              title={null}
              placement="bottomRight"
              trigger="hover"
              styles={{ 
                root: {
                  maxWidth: 340,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }
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
          )}
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
              onMenuClick={handleMenuClick}
              collapsed={collapsed}
              onCollapse={setCollapsed}
            />
          </Sider>
          <Layout style={{ marginLeft: collapsed ? minSiderWidth : siderWidth, background: 'transparent', transition: 'margin-left 0.2s', borderRadius: '12px 0 0 12px' }}>
            <Content className="content-main">
              <PrivateRoute>
                <Routes>
                  <Route path="/" element={<Navigate to="/live-stream-registration" replace />} />
                  <Route path="/dashboard" element={<Index />} />

                  <Route path="/leads" element={
                    <PermissionGate permission="lead_manage" fallback={<Error403 />}>
                      <LeadsList />
                    </PermissionGate>
                  } />
                  <Route path="/followups" element={<ResponsiveFollowups />} />

                  <Route path="/mobile-profile" element={<MobileProfile />} />

                  <Route path="/showings" element={<ResponsiveShowings />} />

                  <Route path="/deals" element={<DealsList />} />
                  <Route path="/allocation" element={
                    <PermissionGate permission="allocation_manage" fallback={<Error403 />}>
                      <AllocationManagement />
                    </PermissionGate>
                  } />
                  <Route path="/allocation-management" element={
                    <PermissionGate permission="allocation_manage" fallback={<Error403 />}>
                      <AllocationManagement />
                    </PermissionGate>
                  } />
                  <Route path="/showings-queue" element={
                    <PermissionGate permission="allocation_manage" fallback={<Error403 />}>
                      <ShowingsQueueManagement />
                    </PermissionGate>
                  } />

                  {/* 积分系统路由 */}
                  <Route path="/points-summary" element={
                    <PermissionGate permission="points_manage" fallback={<Error403 />}>
                      <PointsSummary />
                    </PermissionGate>
                  } />
                  <Route path="/points/exchange" element={<PointsExchange />} />

                  <Route path="/profile" element={<ResponsiveProfile />} />
                  <Route path="/403" element={<Error403 />} />
                  <Route path="/departments" element={<DepartmentPage />} />
                  <Route path="/roles" element={
                    <PermissionGate roles={['admin', 'super_admin', 'system_admin']} fallback={<Error403 />}>
                      <RolePermissionManagement />
                    </PermissionGate>
                  } />
                  <Route path="/announcements" element={
                    <PermissionGate permission="manage_announcements" fallback={<Error403 />}>
                      <AnnouncementManagement />
                    </PermissionGate>
                  } />
                  <Route path="/honor" element={
                    <PermissionGate permission="user_manage" fallback={<Error403 />}>
                      <HonorManagement />
                    </PermissionGate>
                  } />
                  <Route path="/achievement" element={
                    <PermissionGate permission="user_manage" fallback={<Error403 />}>
                      <AchievementManagement />
                    </PermissionGate>
                  } />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/banner-management" element={
                    <PermissionGate role="admin" fallback={<Error403 />}>
                      <BannerManagement />
                    </PermissionGate>
                  } />

                  <Route path="/notification-templates" element={
                    <PermissionGate role="admin" fallback={<Error403 />}>
                      <NotificationTemplateManager />
                    </PermissionGate>
                  } />
                  <Route path="/approval-flows" element={
                            <PermissionGate permission="approval_manage" fallback={<Error403 />}>
          <ApprovalFlowManagement />
        </PermissionGate>
                  } />
                  <Route path="/approval-details" element={<ApprovalDetails />} />
                  <Route path="/approval-performance" element={
                            <PermissionGate permission="approval_manage" fallback={<Error403 />}>
          <ApprovalPerformance />
        </PermissionGate>
                  } />
                          <Route path="/data-analysis" element={
                            <PermissionGate permission="data_analysis" fallback={<Error403 />}>
                              <DataAnalysis />
                            </PermissionGate>
                          } />
                          <Route path="/onboarding" element={<OnboardingPage />} />

                          <Route path="/metro-calculator" element={<MetroDistanceCalculatorPage />} />


                                                      <Route path="/live-stream-registration" element={<LiveStreamRegistration />} />
                            <Route path="/live-stream-management" element={
                              <PermissionGate permission="live_stream_manage" fallback={<Error403 />}>
                                <LiveStreamManagement />
                              </PermissionGate>
                            } />
        
                          {/* <Route path="/live-stream-management" element={
                            <PermissionGate permission="live_stream_manage" fallback={<Error403 />}>
                              <LiveStreamManagement />
                            </PermissionGate>
                          } /> */}

        <Route path="*" element={<Error404 />} />
                </Routes>
              </PrivateRoute>
            </Content>
          </Layout>
        </Layout>
        {notificationDrawer}
        
        {/* 移动端底部菜单 - 只在手机端显示 */}
        {isMobile && <MobileTabBar />}
        
      </div>
    </ConfigProvider>
  );
};

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      {/* 暂时禁用AuthErrorHandler，避免循环 */}
      {/* <AuthErrorHandler> */}
        <App />
      {/* </AuthErrorHandler> */}
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
