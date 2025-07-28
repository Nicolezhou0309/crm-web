import { supabase } from '../supaClient';

/**
 * 静默刷新token，不触发页面刷新
 */
export const silentTokenRefresh = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('静默刷新token失败:', error);
      return { success: false, error };
    }
    
    if (session?.user) {
      console.log('Token静默刷新成功');
      return { success: true, session };
    } else {
      console.warn('静默刷新token: 无有效会话');
      return { success: false, error: '无有效会话' };
    }
  } catch (error) {
    console.error('静默刷新token异常:', error);
    return { success: false, error };
  }
};

/**
 * 检查token是否即将过期
 */
export const isTokenExpiringSoon = (session: any, thresholdMinutes: number = 5) => {
  if (!session?.expires_at) return false;
  
  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  
  return (expiresAt.getTime() - now.getTime()) <= thresholdMs;
};

/**
 * 安全的登出函数，使用React Router导航
 */
export const safeSignOut = async (navigate: any) => {
  try {
    await supabase.auth.signOut();
    // 使用React Router导航，不刷新页面
    navigate('/login', { replace: true });
  } catch (error) {
    console.error('安全登出失败:', error);
    // 如果导航失败，回退到页面刷新
    window.location.href = '/login';
  }
};

/**
 * 获取当前用户会话
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('获取会话失败:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('获取会话异常:', error);
    return null;
  }
};

/**
 * 检查用户是否已登录
 */
export const isUserLoggedIn = async () => {
  const session = await getCurrentSession();
  return !!session?.user;
}; 