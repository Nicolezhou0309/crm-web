import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import SessionTimeoutWarning from '../components/SessionTimeoutWarning';
// import { useUnifiedAuth } from '../hooks/useUnifiedAuth';


interface UserProfile {
  id: number;
  user_id: string;
  nickname?: string;
  avatar_url?: string;
  password_set?: boolean;
}

interface UserPermissions {
  manageableOrganizations: string[];
  isSuperAdmin: boolean;
  isDepartmentAdmin: boolean;
  userRoles: Array<{
    role_id: string;
    role_name: string;
    role_description: string;
  }>;
}

interface UserContextType {
  user: any | null;
  profile: UserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  clearUserCache: () => void;
  sessionTimeRemaining: number;
  isSessionExpired: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 简化配置
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟无操作超时
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5分钟前开始警告

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(SESSION_TIMEOUT);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 使用统一的认证Hook - 暂时注释掉未使用的变量
  // const { smartTokenRefresh } = useUnifiedAuth();
  
  // 使用 useRef 来避免循环依赖
  const userRef = useRef(user);
  userRef.current = user;

  // 处理登出
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setPermissions(null);
      setSessionTimeRemaining(0);
      setShowSessionWarning(false);
    } catch (error) {
      console.error('登出失败:', error);
    }
  }, []);

  // 检查会话超时
  const checkSessionTimeout = useCallback(() => {
    const lastActivity = localStorage.getItem('last_activity_timestamp');
    const now = Date.now();
    
    if (!lastActivity) {
      handleLogout();
      return;
    }
    
    const timeSinceLastActivity = now - parseInt(lastActivity);
    const timeRemaining = Math.max(0, SESSION_TIMEOUT - timeSinceLastActivity);
    
    setSessionTimeRemaining(timeRemaining);
    
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      handleLogout();
      return;
    }
    
    const shouldShowWarning = timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0;
    setShowSessionWarning(shouldShowWarning);
  }, [handleLogout]);

  // 延长会话
  const extendSession = useCallback(() => {
    localStorage.setItem('last_activity_timestamp', Date.now().toString());
    setShowSessionWarning(false);
    setSessionTimeRemaining(SESSION_TIMEOUT);
  }, []);

  // 更新活动时间
  const updateActivity = useCallback(() => {
    localStorage.setItem('last_activity_timestamp', Date.now().toString());
    if (showSessionWarning) {
      setShowSessionWarning(false);
    }
  }, [showSessionWarning]);

  // 设置活动监听器
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [updateActivity]);

  // 会话超时检查
  useEffect(() => {
    const checkInterval = setInterval(() => {
      checkSessionTimeout();
    }, 60000); // 每分钟检查一次

    return () => clearInterval(checkInterval);
  }, [checkSessionTimeout]);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        setError(userError.message);
        setUser(null);
        setProfile(null);
        setPermissions(null);
        return;
      }

      if (sessionUser) {
        setUser(sessionUser);
        
        // 获取用户 profile 信息
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('users_profile')
            .select('*')
            .eq('user_id', sessionUser.id)
            .single();
          
          if (profileError) {
            setError(profileError.message);
            setProfile(null);
          } else {
            setProfile(profileData);
            // 获取权限信息
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const tokenPayload = session?.access_token ? 
                JSON.parse(atob(session.access_token.split('.')[1])) : null;
              const isSuperAdmin = tokenPayload?.role === 'service_role';
              
              const { data: roles } = await supabase.rpc('get_user_roles', { p_user_id: sessionUser.id });
              const userRoles = roles || [];
              
              const hasAdminRole = userRoles.some((r: any) => r.role_name === 'admin') || false;
              
              let manageableOrganizations: string[] = [];
              
              if (isSuperAdmin || hasAdminRole) {
                const { data: allOrgs } = await supabase
                  .from('organizations')
                  .select('id')
                  .order('name');
                
                manageableOrganizations = allOrgs?.map(o => o.id) || [];
              } else {
                const { data: managedOrgIds } = await supabase.rpc('get_managed_org_ids', { 
                  admin_id: sessionUser.id 
                });
                
                if (managedOrgIds && managedOrgIds.length > 0) {
                  manageableOrganizations = managedOrgIds.map((org: any) => org.org_id);
                }
              }
              
              const permissionsData: UserPermissions = {
                manageableOrganizations,
                isSuperAdmin,
                isDepartmentAdmin: manageableOrganizations.length > 0,
                userRoles
              };
              
              setPermissions(permissionsData);
            } catch (permErr) {
              console.error('获取权限信息失败:', permErr);
              setPermissions(null);
            }
          }
          
        } catch (profileErr) {
          setError('获取用户信息失败');
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setPermissions(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取用户信息失败');
      setUser(null);
      setProfile(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []); // 移除所有依赖

  // 清除用户缓存
  const clearUserCache = useCallback(() => {
    localStorage.removeItem('last_activity_timestamp');
  }, []);

  useEffect(() => {
    // 初始化时获取用户信息
    refreshUser();
    
    // 监听认证状态变化 - 简化版本，避免重复处理
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // 只在用户ID不同时刷新
        if (!userRef.current || userRef.current.id !== session.user.id) {
          refreshUser();
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setSessionTimeRemaining(0);
        setShowSessionWarning(false);
      }
      // 移除TOKEN_REFRESHED处理，由useUnifiedAuth统一处理
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const value: UserContextType = {
    user,
    profile,
    permissions,
    loading,
    error,
    refreshUser,
    clearUserCache,
    sessionTimeRemaining,
    isSessionExpired: sessionTimeRemaining <= 0,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
      <SessionTimeoutWarning
        isVisible={showSessionWarning}
        timeRemaining={sessionTimeRemaining}
        onExtend={extendSession}
        onLogout={handleLogout}
      />
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
