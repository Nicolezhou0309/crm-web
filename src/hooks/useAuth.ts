import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // 获取当前用户
    const getUser = async () => {
      try { 
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.warn('获取用户信息失败:', error);
          
          // 如果是会话丢失错误，尝试刷新会话
          if (error.message?.includes('Auth session missing') && retryCount < 2) {
            console.log('检测到会话丢失，尝试刷新会话...');
            setRetryCount(prev => prev + 1);
            
            // 尝试刷新会话
            const { data: { session }, error: refreshError } = await supabase.auth.getSession();
            if (!refreshError && session?.user) {
              console.log('会话刷新成功');
              setUser(session.user);
              setSessionError(null);
              setRetryCount(0);
            } else {
              setSessionError(error.message);
              setUser(null);
            }
          } else {
            setSessionError(error.message);
            setUser(null);
          }
        } else {
          setUser(user);
          setSessionError(null);
          setRetryCount(0);
        }
      } catch (error: any) { 
        console.error('认证会话错误:', error);
        setSessionError(error.message || '认证会话丢失');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('认证状态变化:', event, session?.user?.email);
        
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          setUser(null);
          setSessionError(null);
          setRetryCount(0);
        } else if (session?.user) {
          setUser(session.user);
          setSessionError(null);
          setRetryCount(0);
        } else {
          setUser(null);
          setSessionError('会话已过期，请重新登录');
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [retryCount]);

  // 手动刷新会话
  const refreshSession = async () => {
    try {
      setLoading(true);
      setRetryCount(0);
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('刷新会话失败:', error);
        setSessionError(error.message);
        setUser(null);
      } else if (session?.user) {
        setUser(session.user);
        setSessionError(null);
      } else {
        setUser(null);
        setSessionError('会话已过期，请重新登录');
      }
    } catch (error: any) {
      console.error('刷新会话异常:', error);
      setSessionError(error.message || '刷新会话失败');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 强制登出
  const forceSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSessionError(null);
      setRetryCount(0);
    } catch (error) {
      console.error('强制登出失败:', error);
    }
  };

  return { 
    user, 
    loading, 
    sessionError,
    refreshSession,
    forceSignOut,
    retryCount
  };
}; 