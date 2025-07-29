import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supaClient';
import SessionTimeoutWarning from '../components/SessionTimeoutWarning';

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
  refreshPermissions: () => Promise<void>;
  clearUserCache: () => void;
  sessionTimeRemaining: number;
  isSessionExpired: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟无操作超时
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5分钟前开始警告
const CACHE_KEYS = {
  USER: 'user_cache',
  PROFILE: 'profile_cache',
  PERMISSIONS: 'permissions_cache',
  TIMESTAMP: 'user_cache_timestamp',
  LAST_ACTIVITY: 'last_activity_timestamp',
  SESSION_ID: 'session_id'
};

// 缓存管理类
class UserCacheManager {
  private static instance: UserCacheManager;
  
  static getInstance() {
    if (!UserCacheManager.instance) {
      UserCacheManager.instance = new UserCacheManager();
    }
    return UserCacheManager.instance;
  }

  // 设置用户缓存
  setUserCache(user: any, profile: UserProfile | null, permissions?: UserPermissions | null) {
    try {
      localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
      if (permissions) {
        localStorage.setItem(CACHE_KEYS.PERMISSIONS, JSON.stringify(permissions));
      }
      localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
      this.updateLastActivity();
    } catch (error) {
    }
  }

  // 获取用户缓存
  getUserCache(): { user: any | null; profile: UserProfile | null; permissions: UserPermissions | null } | null {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
      if (!timestamp) return null;

      const cacheAge = Date.now() - parseInt(timestamp);
      if (cacheAge > CACHE_DURATION) {
        this.clearUserCache();
        return null;
      }

      const userStr = localStorage.getItem(CACHE_KEYS.USER);
      const profileStr = localStorage.getItem(CACHE_KEYS.PROFILE);
      const permissionsStr = localStorage.getItem(CACHE_KEYS.PERMISSIONS);
      
      if (!userStr) return null;

      return {
        user: JSON.parse(userStr),
        profile: profileStr ? JSON.parse(profileStr) : null,
        permissions: permissionsStr ? JSON.parse(permissionsStr) : null
      };
    } catch (error) {
      this.clearUserCache();
      return null;
    }
  }

  // 清除用户缓存
  clearUserCache() {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // 更新最后活动时间
  updateLastActivity() {
    const now = Date.now();
    localStorage.setItem(CACHE_KEYS.LAST_ACTIVITY, now.toString());
  }

  // 检查会话是否超时
  isSessionExpired(): boolean {
    const lastActivity = localStorage.getItem(CACHE_KEYS.LAST_ACTIVITY);
    const now = Date.now();
    if (!lastActivity) return true;
    const timeSinceLastActivity = now - parseInt(lastActivity);
    return timeSinceLastActivity > SESSION_TIMEOUT;
  }

  // 获取会话剩余时间（毫秒）
  getSessionTimeRemaining(): number {
    const lastActivity = localStorage.getItem(CACHE_KEYS.LAST_ACTIVITY);
    const now = Date.now();
    if (!lastActivity) return 0;
    const timeSinceLastActivity = now - parseInt(lastActivity);
    const remaining = Math.max(0, SESSION_TIMEOUT - timeSinceLastActivity);
    return remaining;
  }

  // 生成会话ID
  generateSessionId(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(CACHE_KEYS.SESSION_ID, sessionId);
    return sessionId;
  }

  // 获取会话ID
  getSessionId(): string | null {
    return localStorage.getItem(CACHE_KEYS.SESSION_ID);
  }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(SESSION_TIMEOUT);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  const cacheManager = UserCacheManager.getInstance();

  // 处理登出
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      cacheManager.clearUserCache();
      setUser(null);
      setProfile(null);
      setPermissions(null);
      setSessionTimeRemaining(0);
    } catch (error) {
    }
  }, []);

  // 检查会话超时
  const checkSessionTimeout = useCallback(() => {
    const timeRemaining = cacheManager.getSessionTimeRemaining();
    
    // 只在时间变化超过1秒时才更新状态，避免频繁更新
    if (Math.abs(timeRemaining - sessionTimeRemaining) > 1000) {
      setSessionTimeRemaining(timeRemaining);
    }
    
    // 如果会话已过期
    if (cacheManager.isSessionExpired()) {
      handleLogout();
      return;
    }
    
    // 只在警告状态真正需要改变时才更新
    const shouldShowWarning = timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0;
    if (shouldShowWarning !== showSessionWarning) {
      setShowSessionWarning(shouldShowWarning);
    }
  }, [handleLogout, sessionTimeRemaining, showSessionWarning]);

  // 延长会话
  const extendSession = useCallback(() => {
    cacheManager.updateLastActivity();
    setShowSessionWarning(false);
    setSessionTimeRemaining(SESSION_TIMEOUT);
  }, []);

  // 更新活动时间
  const updateActivity = useCallback(() => {
    cacheManager.updateLastActivity();
    // 如果警告正在显示，隐藏它
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
    }, 30000); // 每30秒检查一次，减少频率

    return () => clearInterval(checkInterval);
  }, [checkSessionTimeout]);

  // 页面可见性变化处理
  useEffect(() => {
    let lastVisibilityState = document.visibilityState;
    let visibilityChangeTimeout: NodeJS.Timeout | null = null;
    let lastCheckTime = 0;
    
    const handleVisibilityChange = () => {
      const currentVisibilityState = document.visibilityState;
      const now = Date.now();
      
      // 避免重复处理相同的可见性状态
      if (currentVisibilityState === lastVisibilityState) {
        return;
      }
      
      // 清除之前的定时器
      if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
      }
      
      // 延迟处理，避免截图等短暂操作触发状态更新
      visibilityChangeTimeout = setTimeout(() => {
        if (currentVisibilityState === 'visible') {
          // 限制检查频率，至少间隔5秒
          if (now - lastCheckTime > 5000) {
            // 页面变为可见时，只在会话即将过期时才检查
            const timeRemaining = cacheManager.getSessionTimeRemaining();
            if (timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0) {
              checkSessionTimeout();
              lastCheckTime = now;
            }
          }
        }
        lastVisibilityState = currentVisibilityState;
      }, 100); // 100ms延迟，避免截图等短暂操作
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
      }
    };
  }, [checkSessionTimeout]);

  // 页面关闭前处理
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 页面关闭时清除会话
      cacheManager.clearUserCache();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 刷新权限信息
  const refreshPermissions = useCallback(async () => {
    if (!user) return;
    
    try {
      // 安全解析JWT token
      const parseJwtToken = (token: string) => {
        try {
          if (!token || typeof token !== 'string') {
            return null;
          }
          
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            return null;
          }
          
          const payload = tokenParts[1];
          if (!payload) {
            return null;
          }
          
          const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
          const paddedPayload = normalizedPayload + '='.repeat((4 - normalizedPayload.length % 4) % 4);
          
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(paddedPayload)) {
            return null;
          }
          
          const decodedPayload = atob(paddedPayload);
          const parsedPayload = JSON.parse(decodedPayload);
          
          return parsedPayload;
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Token解析失败，跳过权限检查');
          }
          return null;
        }
      };

      // 检查是否为超级管理员
      const { data: { session } } = await supabase.auth.getSession();
      const tokenPayload = session?.access_token ? parseJwtToken(session.access_token) : null;
      const isSuperAdmin = tokenPayload?.role === 'service_role';
      
      // 获取用户角色
      const { data: roles } = await supabase.rpc('get_user_roles', { p_user_id: user.id });
      const userRoles = roles || [];
      
      // 检查是否有管理员或经理角色
      const hasAdminRole = userRoles.some((r: any) => r.role_name === 'admin') || false;
      
      let manageableOrganizations: string[] = [];
      
      // 如果是超级管理员或管理员，可以管理所有组织
      if (isSuperAdmin || hasAdminRole) {
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id')
          .order('name');
        
        manageableOrganizations = allOrgs?.map(o => o.id) || [];
      } else {
        // 使用数据库函数获取可管理的组织（递归）
        const { data: managedOrgIds } = await supabase.rpc('get_managed_org_ids', { 
          admin_id: user.id 
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
      
      // 更新缓存
      if (profile) {
        cacheManager.setUserCache(user, profile, permissionsData);
      }
      
    } catch (error) {
      console.error('获取权限信息失败:', error);
      setPermissions(null);
    }
  }, [user, profile]);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 检查缓存
      const cachedData = cacheManager.getUserCache();
      // 获取当前session用户
      let currentSessionUser = null;
      try {
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        currentSessionUser = sessionUser;
      } catch (e) {
        currentSessionUser = null;
      }
      if (
        cachedData &&
        currentSessionUser &&
        cachedData.user?.id === currentSessionUser.id
      ) {
        setUser(cachedData.user);
        setProfile(cachedData.profile);
        setPermissions(cachedData.permissions);
        setLoading(false);
        // 检查会话状态
        checkSessionTimeout();
        return;
      } else if (cachedData) {
        // 缓存和当前用户不一致，清空缓存
        cacheManager.clearUserCache();
      }

      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取用户信息超时')), 10000);
      });
      
      const getUserPromise = supabase.auth.getUser();
      const result = await Promise.race([getUserPromise, timeoutPromise]) as any;
      const { data: { user }, error: userError } = result;
      
      if (userError) {
        setError(userError.message);
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      if (user) {
        setUser(user);
        
        // 获取用户 profile 信息
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('users_profile')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (profileError) {
            setError(profileError.message);
            setProfile(null);
          } else {
            setProfile(profileData);
          }

          // 缓存用户信息
          cacheManager.setUserCache(user, profileData);
          
          // 获取权限信息
          await refreshPermissions();
          
          // 检查会话状态
          checkSessionTimeout();
          
        } catch (profileErr) {
          setError('获取用户信息失败');
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setPermissions(null);
        cacheManager.clearUserCache();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取用户信息失败');
      setUser(null);
      setProfile(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [checkSessionTimeout]);

  // 清除用户缓存
  const clearUserCache = useCallback(() => {
    cacheManager.clearUserCache();
  }, []);

  useEffect(() => {
    refreshUser();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        refreshUser();
      } else if (event === 'TOKEN_REFRESHED') {
        // token刷新时，静默更新用户状态，不触发完整的refreshUser流程
        if (session?.user) {
          setUser(session.user);
          // 更新缓存中的用户信息
          if (profile) {
            cacheManager.setUserCache(session.user, profile, permissions);
          }
          // 重置会话超时
          cacheManager.updateLastActivity();
          setSessionTimeRemaining(SESSION_TIMEOUT);
          setShowSessionWarning(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setSessionTimeRemaining(0);
        cacheManager.clearUserCache();
        setShowSessionWarning(false);
      }
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
    refreshPermissions,
    clearUserCache,
    sessionTimeRemaining,
    isSessionExpired: cacheManager.isSessionExpired(),
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