import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { tokenManager } from '../utils/tokenManager';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: (navigate?: any) => Promise<void>;
  checkAuth: () => Promise<{ isValid: boolean; user?: any; error?: string }>;
  refreshAuth: () => Promise<void>;
}

export const useAuth = (): AuthState & AuthActions => {
  const { user, loading: userLoading, refreshUser } = useUser();
  const [authError, setAuthError] = useState<string | null>(null);
  
  const authCheckRef = useRef<boolean>(false);

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    try {
      setAuthError(null);
      
      const authStatus = await tokenManager.checkAuthStatus();
      
      if (!authStatus.isValid) {
        setAuthError(authStatus.error || '认证失败');
      }
      
      return authStatus;
    } catch (error) {
      console.error('useAuth - 认证检查失败:', error);
      const errorMessage = error instanceof Error ? error.message : '认证检查异常';
      setAuthError(errorMessage);
      return { isValid: false, error: errorMessage };
    }
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuthError(null);
      
      const { data, error } = await tokenManager.signInWithPassword(email, password);
      
      if (error) {
        const errorMessage = error instanceof Error ? error.message : '登录失败';
        setAuthError(errorMessage);
        return { success: false, error: errorMessage };
      }
      
      if (data?.user) {
        // 登录成功后立即刷新用户状态
        try {
          await refreshUser();
        } catch (error) {
          console.error('登录成功后刷新用户状态失败:', error);
        }
        return { success: true };
      } else {
        setAuthError('登录响应异常');
        return { success: false, error: '登录响应异常' };
      }
    } catch (error) {
      console.error('useAuth - 登录异常:', error);
      const errorMessage = error instanceof Error ? error.message : '登录异常';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // 登出
  const logout = useCallback(async (navigate?: any) => {
    try {
      await tokenManager.logout(navigate);
      setAuthError(null);
    } catch (error) {
      console.error('useAuth - 登出失败:', error);
      setAuthError(error instanceof Error ? error.message : '登出失败');
    }
  }, []);

  // 刷新认证状态
  const refreshAuth = useCallback(async () => {
    try {
      await refreshUser();
      await checkAuth();
    } catch (error) {
      console.error('useAuth - 刷新认证状态失败:', error);
    }
  }, [refreshUser, checkAuth]);

  // 初始化认证状态
  useEffect(() => {
    if (!authCheckRef.current) {
      authCheckRef.current = true;
      checkAuth();
    }
  }, [checkAuth]);

  // 基于UserContext状态计算认证状态
  const isAuthenticated = !!user;
  const isLoading = userLoading;

  return {
    // 状态
    isAuthenticated,
    isLoading,
    user,
    error: authError,
    
    // 操作
    login,
    logout,
    checkAuth,
    refreshAuth,
  };
};