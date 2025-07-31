import { useEffect, useRef } from 'react';
import { supabase } from '../supaClient';

/**
 * 静默认证Hook - 专门处理token刷新，不触发任何UI更新
 */
export const useSilentAuth = () => {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const lastCheckTimeRef = useRef<number>(0);

  // 静默检查token状态
  const checkTokenSilently = async () => {
    const now = Date.now();
    // 增加检查间隔，避免频繁检查
    if (now - lastCheckTimeRef.current < 5 * 60 * 1000) { // 5分钟内不重复检查
      return;
    }
    lastCheckTimeRef.current = now;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.expires_at) {
        const expiresAt = new Date(session.expires_at);
        const currentTime = new Date();
        const thresholdMs = 60 * 60 * 1000; // 从30分钟增加到60分钟阈值
        
        // 如果token在60分钟内过期，静默刷新
        if ((expiresAt.getTime() - currentTime.getTime()) <= thresholdMs) {
          await refreshTokenSilently();
        }
      }
    } catch (error) {
      // 完全静默处理错误
    }
  };

  // 静默刷新token
  const refreshTokenSilently = async () => {
    if (isRefreshingRef.current) return;
    
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 10 * 60 * 1000) return; // 从5分钟增加到10分钟内不重复刷新
    
    try {
      isRefreshingRef.current = true;
      
      // 静默获取新session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        lastRefreshTimeRef.current = now;
      }
    } catch (error) {
      // 完全静默处理错误
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // 启动静默监控
  const startSilentMonitoring = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // 从60分钟增加到180分钟检查一次，减少检查频率
    refreshIntervalRef.current = setInterval(() => {
      checkTokenSilently();
    }, 180 * 60 * 1000);
  };

  // 停止静默监控
  const stopSilentMonitoring = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  useEffect(() => {
    // 初始化时检查用户状态
    const initSilentAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          startSilentMonitoring();
        }
      } catch (error) {
        // 静默处理错误
      }
    };

    initSilentAuth();

    // 监听认证状态变化，但不触发任何UI更新
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        startSilentMonitoring();
      } else if (event === 'SIGNED_OUT') {
        stopSilentMonitoring();
      }
      // 完全忽略TOKEN_REFRESHED事件
    });

    return () => {
      subscription.unsubscribe();
      stopSilentMonitoring();
    };
  }, []);

  return {
    checkTokenSilently,
    refreshTokenSilently,
    startSilentMonitoring,
    stopSilentMonitoring,
  };
}; 