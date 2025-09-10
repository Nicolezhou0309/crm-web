import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import SessionTimeoutWarning from '../components/SessionTimeoutWarning';
import { safeParseJWT } from '../utils/authUtils';
import { tokenManager } from '../utils/tokenManager';


interface UserProfile {
  id: number;
  user_id: string;
  nickname?: string;
  organization_id?: string;
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
  profileLoading: boolean; // 新增：专门用于 profile 加载状态
  error: string | null;
  refreshUser: () => Promise<void>;
  clearUserCache: () => void;
  sessionTimeRemaining: number;
  isSessionExpired: boolean;
  // 新增：用户信息缓存功能
  getCachedUserInfo: (userId: string) => Promise<{ displayName: string; nickname?: string; email?: string }>;
  clearUserInfoCache: () => void;
  // 新增：统一的用户数据管理
  avatarUrl: string | null;
  userPoints: number;
  avatarLoading: boolean;
  pointsLoading: boolean;
  refreshAvatar: (forceRefresh?: boolean) => Promise<void>;
  refreshUserPoints: () => Promise<void>;
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
  const [profileLoading, setProfileLoading] = useState(false); // 新增：profile 加载状态
  
  // 新增：统一的用户数据状态
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  
  // 用户信息缓存
  const userInfoCache = useRef<Map<string, { 
    data: { displayName: string; nickname?: string; email?: string }; 
    timestamp: number; 
  }>>(new Map());
  
  // 新增：请求去重和缓存机制
  const requestCache = useRef<Map<string, { 
    data: any; 
    timestamp: number; 
    promise?: Promise<any>;
  }>>(new Map());
  
  const CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 1年缓存（用户信息很少变化）
  const AVATAR_CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 头像1年缓存（头像很少变化）
  const POINTS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 积分7天缓存（积分变化频率中等）
  
  // 使用 useRef 来避免循环依赖
  const userRef = useRef(user);
  userRef.current = user;

  // 处理登出
  const handleLogout = useCallback(async () => {
    try {
      // 使用统一的退出登录方法
      await tokenManager.logout();
      // 清理本地状态
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
    // 防止重复调用，但允许在登录成功后调用
    if (loading && !user) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // 使用TokenManager的统一认证状态检查
      const authStatus = await tokenManager.checkAuthStatus();
      
      if (!authStatus.isValid) {
        console.warn('认证状态无效:', authStatus.error);
        
        // 如果是JWT用户不存在错误，尝试清理认证状态
        if (authStatus.error && authStatus.error.includes('does not exist')) {
          console.log('检测到JWT用户不存在错误，清理认证状态...');
          await tokenManager.resetAuthState();
        }
        
        // 简化认证失败处理：直接清除状态，不进行任何刷新操作
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setError(null); // 不设置错误状态，让路由自然处理
        setLoading(false);
        return;
      }
      
      const sessionUser = authStatus.user;
      
              if (sessionUser) {
          setUser(sessionUser);
          setProfileLoading(true); // 开始加载 profile
          
          // 获取用户 profile 信息
          try {
          const { data: profileData, error: profileError } = await supabase
            .from('users_profile')
            .select('*')
            .eq('user_id', sessionUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (profileError) {
            // 如果profile不存在，尝试创建
            if (profileError.code === 'PGRST116') {
              console.log('用户profile不存在，正在创建...');
              try {
                const { data: newProfile, error: createError } = await supabase
                  .from('users_profile')
                  .insert({
                    user_id: sessionUser.id,
                    email: sessionUser.email,
                    nickname: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || '用户',
                    status: 'active'
                  })
                  .select()
                  .single();
                
                if (createError) {
                  console.error('创建profile失败:', createError);
                  setError(`创建用户档案失败: ${createError.message}`);
                  // 创建失败时，创建一个临时的profile对象，避免重定向循环
                  setProfile({
                    id: 0,
                    user_id: sessionUser.id,
                    nickname: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || '用户',
                    avatar_url: undefined,
                    password_set: undefined
                  });
                } else {
                  console.log('成功创建用户profile:', newProfile);
                  setProfile(newProfile);
                }
              } catch (createErr) {
                console.error('创建profile异常:', createErr);
                setError(`创建用户档案异常: ${createErr}`);
                // 创建异常时，也创建一个临时的profile对象
                setProfile({
                  id: 0,
                  user_id: sessionUser.id,
                  nickname: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || '用户',
                  avatar_url: undefined,
                  password_set: undefined
                });
              }
            } else {
              setError(profileError.message);
              // 其他错误时，也创建一个临时的profile对象
              setProfile({
                id: 0,
                user_id: sessionUser.id,
                nickname: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || '用户',
                avatar_url: undefined,
                password_set: undefined
              });
            }
          } else {
            setProfile(profileData);
            // 获取权限信息
            try {
              const { data: { session } } = await supabase.auth.getSession();
              
              // 使用安全的JWT解析
              let isSuperAdmin = false;
              
              if (session?.access_token) {
                const tokenPayload = safeParseJWT(session.access_token);
                isSuperAdmin = tokenPayload?.role === 'service_role';
              }
              
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
          
                  } finally {
            setProfileLoading(false); // profile 加载完成
          }
        } else {
          setUser(null);
          setProfile(null);
          setPermissions(null);
          setProfileLoading(false); // 没有用户时也设置 profileLoading 为 false
        }
          } catch (err) {
        console.error('refreshUser: 刷新失败', err);
        setError(err instanceof Error ? err.message : '获取用户信息失败');
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setLoading(false);
      }
  }, []); // 移除loading依赖，避免循环调用

  // 清除用户缓存
  const clearUserCache = useCallback(() => {
    localStorage.removeItem('last_activity_timestamp');
  }, []);

  // 获取缓存的用户信息
  const getCachedUserInfo = useCallback(async (userId: string) => {
    const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
    const now = Date.now();
    
    // 检查缓存
    const cached = userInfoCache.current.get(userId);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    try {
      // 异步获取用户信息，不阻塞主线程
      const { data: userProfile } = await supabase
        .from('users_profile')
        .select('nickname, email')
        .eq('id', userId)
        .single();

      const userInfo = {
        displayName: userProfile?.nickname || userProfile?.email || '未知用户',
        nickname: userProfile?.nickname,
        email: userProfile?.email
      };

      // 缓存结果
      userInfoCache.current.set(userId, {
        data: userInfo,
        timestamp: now
      });

      return userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return { displayName: '未知用户' };
    }
  }, []);

  // 清除用户信息缓存
  const clearUserInfoCache = useCallback(() => {
    userInfoCache.current.clear();
  }, []);

  // 新增：统一的头像管理
  const refreshAvatar = useCallback(async (forceRefresh = false) => {
    if (!profile?.id) {
      setAvatarUrl(null);
      return;
    }

    const cacheKey = `avatar_${profile.id}`;
    const cached = requestCache.current.get(cacheKey);
    const now = Date.now();

    // 检查缓存是否有效（除非强制刷新）
    if (!forceRefresh && cached && (now - cached.timestamp) < AVATAR_CACHE_DURATION) {
      setAvatarUrl(cached.data);
      return;
    }

    // 如果强制刷新，清除现有缓存和进行中的请求
    if (forceRefresh) {
      requestCache.current.delete(cacheKey);
    }

    // 如果已有进行中的请求且不是强制刷新，等待它完成
    if (cached?.promise && !forceRefresh) {
      try {
        const result = await cached.promise;
        setAvatarUrl(result);
        return;
      } catch (error) {
        console.error('等待头像请求失败:', error);
      }
    }

    setAvatarLoading(true);
    
    // 创建新的请求Promise
    const requestPromise = (async () => {
      try {
        const { data: profileData } = await supabase
          .from('users_profile')
          .select('avatar_url, updated_at')
          .eq('user_id', profile.user_id)
          .single();
        
        const avatarUrl = profileData?.avatar_url || null;
        
        // 缓存结果
        requestCache.current.set(cacheKey, {
          data: avatarUrl,
          timestamp: now
        });
        
        return avatarUrl;
      } catch (error) {
        console.error('获取头像失败:', error);
        return null;
      }
    })();

    // 如果是强制刷新，立即缓存Promise以避免重复请求
    if (forceRefresh) {
      requestCache.current.set(cacheKey, {
        data: null, // 临时值
        timestamp: now,
        promise: requestPromise
      });
    }
    
    try {
      const avatarUrl = await requestPromise;
      setAvatarUrl(avatarUrl);
    } catch (error) {
      console.error('头像请求失败:', error);
      setAvatarUrl(null);
    } finally {
      setAvatarLoading(false);
    }
  }, [profile]);

  // 新增：统一的积分管理
  const refreshUserPoints = useCallback(async () => {
    if (!profile?.id) {
      setUserPoints(0);
      return;
    }

    const cacheKey = `points_${profile.id}`;
    const cached = requestCache.current.get(cacheKey);
    const now = Date.now();

    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < POINTS_CACHE_DURATION) {
      setUserPoints(cached.data);
      return;
    }

    // 如果已有进行中的请求，等待它完成
    if (cached?.promise) {
      try {
        const result = await cached.promise;
        setUserPoints(result);
        return;
      } catch (error) {
        console.error('等待积分请求失败:', error);
      }
    }

    setPointsLoading(true);
    
    try {
      // 动态导入积分API
      const { getUserPointsInfo } = await import('../api/pointsApi');
      const data = await getUserPointsInfo(Number(profile.id));
      const points = data.wallet.total_points || 0;
      
      // 缓存结果
      requestCache.current.set(cacheKey, {
        data: points,
        timestamp: now
      });
      
      setUserPoints(points);
    } catch (error) {
      console.error('获取用户积分失败:', error);
      setUserPoints(0);
    } finally {
      setPointsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    // 简化的初始化逻辑，避免循环
    const initUser = async () => {
      try {
        // 直接检查认证状态，不进行复杂的刷新
        const authStatus = await tokenManager.checkAuthStatus();
        
        if (authStatus.isValid && authStatus.user) {
          setUser(authStatus.user);
          setProfileLoading(true); // 开始加载 profile
          
          // 获取用户 profile 信息（简化版本，不触发复杂的权限检查）
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('users_profile')
              .select('*')
              .eq('user_id', authStatus.user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (profileError) {
              // 如果profile不存在，尝试创建
              if (profileError.code === 'PGRST116') {
                console.log('初始化时用户profile不存在，正在创建...');
                try {
                  const { data: newProfile, error: createError } = await supabase
                    .from('users_profile')
                    .insert({
                      user_id: authStatus.user.id,
                      email: authStatus.user.email,
                      nickname: authStatus.user.user_metadata?.full_name || authStatus.user.email?.split('@')[0] || '用户',
                      status: 'active'
                    })
                    .select()
                    .single();
                  
                  if (!createError && newProfile) {
                    console.log('初始化时成功创建用户profile:', newProfile);
                    setProfile(newProfile);
                  } else if (createError) {
                    console.error('初始化时创建profile失败:', createError);
                    // 创建失败时，创建一个临时的profile对象
                    setProfile({
                      id: 0,
                      user_id: authStatus.user.id,
                      nickname: authStatus.user.user_metadata?.full_name || authStatus.user.email?.split('@')[0] || '用户',
                      avatar_url: undefined,
                      password_set: undefined
                    });
                  }
                } catch (createErr) {
                  console.error('初始化时创建profile异常:', createErr);
                  // 创建异常时，也创建一个临时的profile对象
                  setProfile({
                    id: 0,
                    user_id: authStatus.user.id,
                    nickname: authStatus.user.user_metadata?.full_name || authStatus.user.email?.split('@')[0] || '用户',
                    avatar_url: undefined,
                    password_set: undefined
                  });
                }
              }
            } else if (profileData) {
              setProfile(profileData);
            }
          } catch (profileErr) {
            console.error('初始化时获取profile失败:', profileErr);
          } finally {
            setProfileLoading(false); // profile 加载完成
            setLoading(false); // 整体加载完成
          }
        } else {
          // 如果是JWT用户不存在错误，尝试清理认证状态
          if (authStatus.error && authStatus.error.includes('does not exist')) {
            console.log('初始化时检测到JWT用户不存在错误，清理认证状态...');
            await tokenManager.resetAuthState();
          }
          
          setUser(null);
          setProfile(null);
          setPermissions(null);
          setLoading(false);
        }
      } catch (error) {
        // 网络错误或其他异常时，确保loading状态正确
        console.error('初始化用户状态失败:', error);
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setLoading(false);
      }
    };
    
    // 直接初始化，不设置延迟
    initUser();
    
    // 启动token管理器的自动刷新和认证状态监听
    const stopAutoRefresh = tokenManager.startAutoRefresh();
    
    // 使用统一的token管理器监听认证状态变化
    const unsubscribe = tokenManager.addAuthStateListener((event, session) => {
      
      if (event === 'SIGNED_IN' && session?.user) {
        // 立即更新用户状态，不检查用户ID差异
        setUser(session.user);
        setProfileLoading(true); // 开始加载 profile
        
        // 异步获取用户 profile 信息，等待完成后再设置 loading: false
        const fetchProfile = async () => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('users_profile')
              .select('*')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (profileError) {
              // 如果profile不存在，尝试创建
              if (profileError.code === 'PGRST116') {
                console.log('登录时用户profile不存在，正在创建...');
                try {
                  const { data: newProfile, error: createError } = await supabase
                    .from('users_profile')
                    .insert({
                      user_id: session.user.id,
                      email: session.user.email,
                      nickname: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '用户',
                      status: 'active'
                    })
                    .select()
                    .single();
                  
                  if (!createError && newProfile) {
                    console.log('登录时成功创建用户profile:', newProfile);
                    setProfile(newProfile);
                  } else if (createError) {
                    console.error('登录时创建profile失败:', createError);
                    // 创建失败时，创建一个临时的profile对象
                    setProfile({
                      id: 0,
                      user_id: session.user.id,
                      nickname: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '用户',
                      avatar_url: undefined,
                      password_set: undefined
                    });
                  }
                } catch (createErr) {
                  console.error('登录时创建profile异常:', createErr);
                  // 创建异常时，也创建一个临时的profile对象
                  setProfile({
                    id: 0,
                    user_id: session.user.id,
                    nickname: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '用户',
                    avatar_url: undefined,
                    password_set: undefined
                  });
                }
              }
            } else if (profileData) {
              setProfile(profileData);
            }
          } catch (profileErr) {
            console.error('获取用户profile失败:', profileErr);
          } finally {
            setProfileLoading(false); // profile 加载完成
            setLoading(false); // 整体加载完成
          }
        };
        
        // 立即执行，等待完成
        fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setPermissions(null);
        setSessionTimeRemaining(0);
        setShowSessionWarning(false);
      }
    });

    return () => {
      unsubscribe();
      stopAutoRefresh();
    };
  }, []); // 移除refreshUser依赖，避免循环

  // 监听用户信息更新事件
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshUser();
    };

    window.addEventListener('profile_updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile_updated', handleProfileUpdate);
    };
  }, [refreshUser]);

  // 新增：profile变化时自动刷新头像和积分
  useEffect(() => {
    if (profile?.id) {
      refreshAvatar();
      refreshUserPoints();
    } else {
      setAvatarUrl(null);
      setUserPoints(0);
    }
  }, [profile, refreshAvatar, refreshUserPoints]);

  const value: UserContextType = {
    user,
    profile,
    permissions,
    loading,
    profileLoading,
    error,
    refreshUser,
    clearUserCache,
    sessionTimeRemaining,
    isSessionExpired: sessionTimeRemaining <= 0,
    getCachedUserInfo,
    clearUserInfoCache,
    // 新增：统一的用户数据
    avatarUrl,
    userPoints,
    avatarLoading,
    pointsLoading,
    refreshAvatar,
    refreshUserPoints,
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
