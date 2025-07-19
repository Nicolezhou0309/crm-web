import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supaClient';
import SessionTimeoutWarning from '../components/SessionTimeoutWarning';

interface UserProfile {
  id: number;
  user_id: string;
  nickname?: string;
  avatar_url?: string;
}

interface UserContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
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
  setUserCache(user: any, profile: UserProfile | null) {
    try {
      localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
      localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
      this.updateLastActivity();
    } catch (error) {
      console.error('设置用户缓存失败:', error);
    }
  }

  // 获取用户缓存
  getUserCache(): { user: any | null; profile: UserProfile | null } | null {
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
      
      if (!userStr) return null;

      return {
        user: JSON.parse(userStr),
        profile: profileStr ? JSON.parse(profileStr) : null
      };
    } catch (error) {
      console.error('获取用户缓存失败:', error);
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
    localStorage.setItem(CACHE_KEYS.LAST_ACTIVITY, Date.now().toString());
  }

  // 检查会话是否超时
  isSessionExpired(): boolean {
    const lastActivity = localStorage.getItem(CACHE_KEYS.LAST_ACTIVITY);
    if (!lastActivity) return true;

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    return timeSinceLastActivity > SESSION_TIMEOUT;
  }

  // 获取会话剩余时间（毫秒）
  getSessionTimeRemaining(): number {
    const lastActivity = localStorage.getItem(CACHE_KEYS.LAST_ACTIVITY);
    if (!lastActivity) return 0;

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    return Math.max(0, SESSION_TIMEOUT - timeSinceLastActivity);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(SESSION_TIMEOUT);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  const cacheManager = UserCacheManager.getInstance();

  // 检查会话超时
  const checkSessionTimeout = useCallback(() => {
    const timeRemaining = cacheManager.getSessionTimeRemaining();
    setSessionTimeRemaining(timeRemaining);

    // 如果会话已过期
    if (cacheManager.isSessionExpired()) {
      console.log('[SESSION] 会话已超时，自动登出');
      handleLogout();
      return;
    }

    // 如果剩余时间少于警告阈值，显示警告
    if (timeRemaining <= WARNING_THRESHOLD && timeRemaining > 0) {
      setShowSessionWarning(true);
    } else {
      setShowSessionWarning(false);
    }
  }, []);

  // 处理登出
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      cacheManager.clearUserCache();
      setUser(null);
      setProfile(null);
      setSessionId(null);
      setLoading(false);
      setError(null);
      setShowSessionWarning(false);
      setSessionTimeRemaining(0);
    } catch (error) {
      console.error('登出失败:', error);
    }
  }, []);

  // 延长会话
  const extendSession = useCallback(() => {
    cacheManager.updateLastActivity();
    setShowSessionWarning(false);
    setSessionTimeRemaining(SESSION_TIMEOUT);
    console.log('[SESSION] 会话已延长');
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
    }, 10000); // 每10秒检查一次

    return () => clearInterval(checkInterval);
  }, [checkSessionTimeout]);

  // 页面可见性变化处理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时检查会话状态
        checkSessionTimeout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 检查缓存
      const cachedData = cacheManager.getUserCache();
      if (cachedData) {
        console.log('[USER] 使用缓存用户信息');
        setUser(cachedData.user);
        setProfile(cachedData.profile);
        setLoading(false);
        // 检查会话状态
        checkSessionTimeout();
        return;
      }

      // 检查环境变量
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取用户信息超时')), 10000);
      });
      
      const getUserPromise = supabase.auth.getUser();
      const result = await Promise.race([getUserPromise, timeoutPromise]) as any;
      const { data: { user }, error: userError } = result;
      
      if (userError) {
        console.error('[USER] 获取用户失败:', userError);
        setError(userError.message);
        setUser(null);
        setProfile(null);
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
            console.error('[USER] 获取用户 profile 失败:', profileError);
            setError(profileError.message);
            setProfile(null);
          } else {
            setProfile(profileData);
          }

          // 缓存用户信息
          cacheManager.setUserCache(user, profileData);
          
          // 生成新的会话ID
          const newSessionId = cacheManager.generateSessionId();
          setSessionId(newSessionId);
          
          // 检查会话状态
          checkSessionTimeout();
          
        } catch (profileErr) {
          console.error('[USER] 获取 profile 异常:', profileErr);
          setError('获取用户信息失败');
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        cacheManager.clearUserCache();
      }
    } catch (err) {
      console.error('[USER] 获取用户信息异常:', err);
      setError(err instanceof Error ? err.message : '获取用户信息失败');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [checkSessionTimeout]);

  // 清除用户缓存
  const clearUserCache = useCallback(() => {
    cacheManager.clearUserCache();
    console.log('[USER] 用户缓存已清除');
  }, []);

  useEffect(() => {
    refreshUser();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        refreshUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSessionId(null);
        setLoading(false);
        cacheManager.clearUserCache();
        setShowSessionWarning(false);
        setSessionTimeRemaining(0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    refreshUser,
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