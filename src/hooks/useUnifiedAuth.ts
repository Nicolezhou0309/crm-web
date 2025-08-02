import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supaClient';

interface AuthState {
  isProcessing: boolean;
  lastRefreshTime: number;
  lastActivityTime: number;
}

export const useUnifiedAuth = () => {
  const authStateRef = useRef<AuthState>({
    isProcessing: false,
    lastRefreshTime: 0,
    lastActivityTime: Date.now(),
  });

  // 智能token刷新
  const smartTokenRefresh = useCallback(async () => {
    const now = Date.now();
    const state = authStateRef.current;
    
    // 防止频繁刷新：至少间隔5分钟
    if (now - state.lastRefreshTime < 5 * 60 * 1000) {
      return { success: true, skipped: true };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.expires_at) {
        const expiresAt = new Date(session.expires_at);
        const timeUntilExpiry = expiresAt.getTime() - now;
        
        // 如果token在30分钟内过期，主动刷新
        if (timeUntilExpiry <= 30 * 60 * 1000) {
          await supabase.auth.getSession(); // 触发刷新
          state.lastRefreshTime = now;
          return { success: true, refreshed: true };
        }
      }
      
      return { success: true, skipped: true };
    } catch (error) {
      console.warn('智能token刷新失败:', error);
      return { success: false, error };
    }
  }, []);

  // 更新活动时间
  const updateActivity = useCallback(() => {
    authStateRef.current.lastActivityTime = Date.now();
  }, []);

  // 统一的认证状态处理
  const handleAuthStateChange = useCallback(async (event: string, _session: any) => {
    const state = authStateRef.current;
    
    if (state.isProcessing) {
      return;
    }
    
    state.isProcessing = true;
    
    try {
      switch (event) {
        case 'SIGNED_IN':
          // 登录成功，更新活动时间
          updateActivity();
          break;
        case 'SIGNED_OUT':
          // 登出，重置状态
          state.lastRefreshTime = 0;
          state.lastActivityTime = 0;
          break;
        case 'TOKEN_REFRESHED':
          // 静默处理token刷新，不触发UI更新
          state.lastRefreshTime = Date.now();
          updateActivity();
          break;
      }
    } finally {
      state.isProcessing = false;
    }
  }, [updateActivity]);

  useEffect(() => {
    // 设置认证状态监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
    
    // 设置活动监听器
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => updateActivity();
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // 启动智能token监控
    const refreshInterval = setInterval(() => {
      smartTokenRefresh();
    }, 10 * 60 * 1000); // 每10分钟检查一次

    return () => {
      subscription.unsubscribe();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(refreshInterval);
    };
  }, [handleAuthStateChange, smartTokenRefresh, updateActivity]);

  return {
    smartTokenRefresh,
    updateActivity,
    getAuthState: () => authStateRef.current,
  };
};