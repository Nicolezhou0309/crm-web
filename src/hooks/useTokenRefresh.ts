import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { silentTokenRefresh, isTokenExpiringSoon } from '../utils/authUtils';

export const useTokenRefresh = () => {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const isMonitoringStartedRef = useRef(false); // 防止重复启动监控
  const refreshPromiseRef = useRef<Promise<any> | null>(null); // 防止重复刷新

  // 静默刷新token，不触发任何UI更新
  const refreshToken = useCallback(async () => {
    // 防止重复刷新
    if (isRefreshingRef.current) {
      return refreshPromiseRef.current;
    }

    // 防止频繁刷新：至少间隔5分钟
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 5 * 60 * 1000) {
      return { success: true, skipped: true };
    }

    try {
      isRefreshingRef.current = true;
      
      // 创建刷新Promise并保存引用
      refreshPromiseRef.current = (async () => {
        try {
          // 静默获取新session，不触发任何事件
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.warn('静默刷新token失败:', error);
            return { success: false, error };
          }
          
          if (session?.user) {
            lastRefreshTimeRef.current = now;
            return { success: true, session };
          } else {
            console.warn('静默刷新token: 无有效会话');
            return { success: false, error: '无有效会话' };
          }
        } catch (error) {
          console.error('静默刷新token异常:', error);
          return { success: false, error };
        }
      })();

      const result = await refreshPromiseRef.current;
      return result;
    } finally {
      isRefreshingRef.current = false;
      refreshPromiseRef.current = null;
    }
  }, []);

  // 检查并静默刷新即将过期的token
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && isTokenExpiringSoon(session, 30)) { // 30分钟内过期才刷新
        await refreshToken();
      }
    } catch (error) {
      // 静默处理错误，不输出日志避免干扰
    }
  }, [refreshToken]);

  // 设置定时检查token状态
  const startTokenMonitoring = useCallback(() => {
    // 防止重复启动
    if (isMonitoringStartedRef.current) {
      return;
    }

    // 清除之前的定时器
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // 每60分钟检查一次token状态
    refreshIntervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 60 * 60 * 1000);

    isMonitoringStartedRef.current = true;
  }, [checkAndRefreshToken]);

  // 停止token监控
  const stopTokenMonitoring = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    isMonitoringStartedRef.current = false;
  }, []);

  // 监听认证状态变化，但只处理登录登出，不处理token刷新
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        startTokenMonitoring();
      } else if (event === 'SIGNED_OUT') {
        stopTokenMonitoring();
      }
      // 移除TOKEN_REFRESHED事件监听，避免触发UI更新
    });

    // 初始化时检查用户状态
    const initTokenMonitoring = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !isMonitoringStartedRef.current) {
          startTokenMonitoring();
        }
      } catch (error) {
        // 静默处理错误
      }
    };

    initTokenMonitoring();

    return () => {
      subscription.unsubscribe();
      stopTokenMonitoring();
    };
  }, []); // 移除依赖项，避免重复执行

  return {
    refreshToken,
    checkAndRefreshToken,
    startTokenMonitoring,
    stopTokenMonitoring,
  };
}; 