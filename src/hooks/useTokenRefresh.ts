import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { silentTokenRefresh, isTokenExpiringSoon } from '../utils/authUtils';

export const useTokenRefresh = () => {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // 主动刷新token
  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) {
      console.log('Token刷新已在进行中，跳过');
      return;
    }

    try {
      isRefreshingRef.current = true;
      console.log('开始主动刷新token...');
      
      const result = await silentTokenRefresh();
      
      if (result.success) {
        console.log('Token主动刷新成功');
      } else {
        console.warn('Token主动刷新失败:', result.error);
      }
    } catch (error) {
      console.error('Token主动刷新异常:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // 检查并刷新即将过期的token
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && isTokenExpiringSoon(session, 10)) { // 10分钟内过期
        console.log('检测到token即将过期，主动刷新');
        await refreshToken();
      }
    } catch (error) {
      console.error('检查token过期状态失败:', error);
    }
  }, [refreshToken]);

  // 设置定时检查token状态
  const startTokenMonitoring = useCallback(() => {
    // 清除之前的定时器
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // 每5分钟检查一次token状态
    refreshIntervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 5 * 60 * 1000);

    console.log('Token监控已启动');
  }, [checkAndRefreshToken]);

  // 停止token监控
  const stopTokenMonitoring = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
      console.log('Token监控已停止');
    }
  }, []);

  // 监听认证状态变化
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('用户登录，启动token监控');
        startTokenMonitoring();
      } else if (event === 'SIGNED_OUT') {
        console.log('用户登出，停止token监控');
        stopTokenMonitoring();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token已自动刷新');
      }
    });

    // 初始化时检查用户状态
    const initTokenMonitoring = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        startTokenMonitoring();
      }
    };

    initTokenMonitoring();

    return () => {
      subscription.unsubscribe();
      stopTokenMonitoring();
    };
  }, [startTokenMonitoring, stopTokenMonitoring]);

  return {
    refreshToken,
    checkAndRefreshToken,
    startTokenMonitoring,
    stopTokenMonitoring,
  };
}; 