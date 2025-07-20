import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    // 获取当前用户
    const getUser = async () => {
      try { 
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.warn('获取用户信息失败:', error);
          setSessionError(error.message);
          setUser(null);
        } else {
          setUser(user);
          setSessionError(null);
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
        } else if (session?.user) {
          setUser(session.user);
          setSessionError(null);
        } else {
          setUser(null);
          setSessionError('会话已过期，请重新登录');
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 手动刷新会话
  const refreshSession = async () => {
    try {
      setLoading(true);
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

  return { 
    user, 
    loading, 
    sessionError,
    refreshSession 
  };
}; 