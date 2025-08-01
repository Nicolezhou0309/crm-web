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
      console.error('设置用户缓存失败:', error);
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
  const [error, setError] = useState<string | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(SESSION_TIMEOUT);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  
  // 使用简单的loading状态管理
  const [loading, setLoading] = useState(false);
  
  // 简化可见性管理 - 始终认为页面可见
  const isPageVisible = true;
  
  // 静默模式标志 - 始终为false
  const isSilentMode = false;
  
  // 可见性检查标志 - 始终为false
  const isVisibilityCheck = false;

  // 监控Loading状态变化，增加调用来源信息
  useEffect(() => {
    // 只在loading状态真正变化时才记录日志
    if (loading) {
      const stack = new Error().stack;
      const stackLines = stack?.split('\n') || [];
      let callerInfo = 'UserContext - 状态变化';
      let callerComponent = 'UserContext';
      let callerFile = 'UserContext.tsx';
      
      // 分析调用栈，获取调用来源信息
      for (let i = 1; i < stackLines.length; i++) {
        const line = stackLines[i];
        if (line.includes('UserContext.tsx') || line.includes('useEffect')) {
          continue; // 跳过UserContext自身的调用
        }
        
        // 提取文件名和行号
        const fileMatch = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (fileMatch) {
          const functionName = fileMatch[1];
          const filePath = fileMatch[2];
          const lineNumber = fileMatch[3];
          
          // 提取文件名（去掉路径）
          const fileName = filePath.split('/').pop()?.split('?')[0] || '未知文件';
          
          callerInfo = `${functionName} (${fileName}:${lineNumber})`;
          callerComponent = functionName;
          callerFile = fileName;
          break;
        }
        
        // 如果没有匹配到函数名，尝试提取文件信息
        const simpleFileMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
        if (simpleFileMatch) {
          const filePath = simpleFileMatch[1];
          const lineNumber = simpleFileMatch[2];
          const fileName = filePath.split('/').pop()?.split('?')[0] || '未知文件';
          
          callerInfo = `匿名函数 (${fileName}:${lineNumber})`;
          callerComponent = '匿名函数';
          callerFile = fileName;
          break;
        }
      }
      
      console.log('🔄 [UserContext] Loading状态变化', {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        loading: loading,
        hasUser: !!user,
        hasProfile: !!profile,
        visibilityState: document.visibilityState,
        callerInfo: callerInfo,
        callerComponent: callerComponent,
        callerFile: callerFile
      });
    }
  }, [loading, user, profile]); // 简化依赖，只监听关键状态

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
      console.error('清除用户缓存失败:', error);
    }
  }, []);

  // 检查会话超时
  const checkSessionTimeout = useCallback(() => {
    const timeRemaining = cacheManager.getSessionTimeRemaining();
    
    // 在静默模式下，不更新任何状态
    if (isSilentMode) {
      return;
    }
    
    // 只在时间变化超过5秒时才更新状态，避免频繁更新（从1秒增加到5秒）
    if (Math.abs(timeRemaining - sessionTimeRemaining) > 5000) {
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
  }, [handleLogout, sessionTimeRemaining, showSessionWarning, isSilentMode]);

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
    let lastActivityTime = 0;
    const ACTIVITY_THROTTLE = 5000; // 5秒节流
    
    const handleActivity = () => {
      const now = Date.now();
      // 只在距离上次活动超过5秒时才更新
      if (now - lastActivityTime > ACTIVITY_THROTTLE) {
        updateActivity();
        lastActivityTime = now;
      }
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
    }, 60000); // 从30秒增加到60秒检查一次

    return () => clearInterval(checkInterval);
  }, [checkSessionTimeout]);

  // 智能页面可见性变化处理 - 暂时禁用以避免页面刷新
  useEffect(() => {
    // 暂时禁用页面可见性变化处理，避免页面刷新
    return () => {};
    
    /*
    let lastVisibilityState = document.visibilityState;
    let visibilityChangeTimeout: NodeJS.Timeout | null = null;
    let lastCheckTime = 0;
    let isProcessing = false;
    let hiddenStartTime = 0;
    let visibilityChangeCount = 0; // 记录可见性变化次数
    
    const handleVisibilityChange = () => {
      const currentVisibilityState = document.visibilityState;
      const now = Date.now();
      
      // 避免重复处理相同的可见性状态
      if (currentVisibilityState === lastVisibilityState || isProcessing) {
        return;
      }
      
      // 清除之前的定时器
      if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
      }
      
      // 延迟处理，避免截图等短暂操作触发状态更新
      visibilityChangeTimeout = setTimeout(() => {
        if (currentVisibilityState === 'visible') {
          // 计算页面隐藏时长
          const hiddenDuration = now - hiddenStartTime;
          visibilityChangeCount++;
          
          // 智能处理策略：
          // 1. 页面隐藏超过5分钟才检查
          // 2. 可见性变化次数少于10次（避免频繁切换）
          // 3. 距离上次检查超过60秒
          if (hiddenDuration > 5 * 60 * 1000 && 
              visibilityChangeCount < 10 && 
              now - lastCheckTime > 60000) {
            
            // 只在会话即将过期时才检查
            const timeRemaining = cacheManager.getSessionTimeRemaining();
            if (timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0) {
              isProcessing = true;
              setIsVisibilityCheck(true);
              setIsSilentMode(true);
              
              // 静默检查会话状态
              checkSessionTimeout();
              lastCheckTime = now;
              
              // 重置处理状态
              setTimeout(() => {
                isProcessing = false;
                setIsVisibilityCheck(false);
                setIsSilentMode(false);
              }, 5000);
            }
          }
        } else if (currentVisibilityState === 'hidden') {
          // 记录页面隐藏开始时间
          hiddenStartTime = now;
        }
        lastVisibilityState = currentVisibilityState;
      }, 2000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
      }
    };
    */
  }, [checkSessionTimeout]);

  // 页面可见性状态监听 - 完全禁用以避免页面刷新
  useEffect(() => {
    // 暂时完全禁用页面可见性变化处理
    return () => {};
    
    /*
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsPageVisible(isVisible);
      
      // 页面隐藏时，设置静默模式
      if (!isVisible) {
        setIsSilentMode(true);
      } else {
        // 页面显示时，延迟恢复静默模式
        setTimeout(() => {
          setIsSilentMode(false);
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    */
  }, []);

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
            console.error('解析JWT token失败:', error);
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

  const refreshUser = useCallback(async (skipLoading = false) => {
    // 如果页面不可见，完全跳过所有操作
    if (document.visibilityState !== 'visible') {
      return;
    }
    
    try {
      // 优化loading状态设置逻辑
      const shouldSetLoading = !skipLoading && 
                              !isVisibilityCheck && 
                              !isSilentMode && 
                              isPageVisible &&
                              !user; // 只在没有用户时才设置loading
      
      if (shouldSetLoading) {
        setLoading(true);
      }
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
      
      // 优化缓存检查逻辑
      if (
        cachedData &&
        currentSessionUser &&
        cachedData.user?.id === currentSessionUser.id
      ) {
        // 只有当数据真正发生变化时才更新状态
        const userChanged = user?.id !== cachedData.user?.id;
        const profileChanged = profile?.id !== cachedData.profile?.id;
        const permissionsChanged = JSON.stringify(permissions) !== JSON.stringify(cachedData.permissions);
        
        if (userChanged) {
          setUser(cachedData.user);
        }
        if (profileChanged) {
          setProfile(cachedData.profile);
        }
        if (permissionsChanged) {
          setPermissions(cachedData.permissions);
        }
        
        if (shouldSetLoading) {
          setLoading(false);
        }
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
      const { data: { user: sessionUser }, error: userError } = result;
      
      if (userError) {
        setError(userError.message);
        setUser(null);
        setProfile(null);
        setPermissions(null);
        if (shouldSetLoading) {
          setLoading(false);
        }
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
          }

          // 缓存用户信息
          cacheManager.setUserCache(sessionUser, profileData);
          
          // 获取权限信息
          await refreshPermissions();
          
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
      const shouldSetLoading = !skipLoading && 
                              !isVisibilityCheck && 
                              !isSilentMode && 
                              isPageVisible &&
                              !user; // 只在没有用户时才设置loading
      if (shouldSetLoading) {
        setLoading(false);
      }
    }
  }, [isVisibilityCheck, isSilentMode, isPageVisible]);

  // 清除用户缓存
  const clearUserCache = useCallback(() => {
    cacheManager.clearUserCache();
  }, []);

  useEffect(() => {
    refreshUser();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 如果页面不可见，不处理任何认证状态变化
      if (document.visibilityState !== 'visible') {
        return;
      }
      
      // 在静默模式下，不处理任何认证状态变化
      if (isSilentMode || isVisibilityCheck) {
        return;
      }
      
      if (event === 'SIGNED_IN') {
        // 只在真正需要时才刷新用户信息
        if (!user || user.id !== session?.user?.id) {
          refreshUser();
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // token刷新时，完全静默处理，不更新任何状态
        if (session?.user) {
          // 只更新缓存，不触发状态变化
          if (profile) {
            cacheManager.setUserCache(session.user, profile, permissions);
          }
          // 静默更新活动时间，不触发状态更新
          cacheManager.updateLastActivity();
        }
      } else if (event === 'SIGNED_OUT') {
        // 只在用户状态真正需要改变时才更新
        if (user || profile || permissions) {
          setUser(null);
          setProfile(null);
          setPermissions(null);
          setSessionTimeRemaining(0);
          cacheManager.clearUserCache();
          setShowSessionWarning(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser, isSilentMode, isVisibilityCheck]);

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