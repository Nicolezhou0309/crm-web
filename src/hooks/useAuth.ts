import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 useAuth Hook 初始化');
    
    // 获取当前用户
    const getUser = async () => {
      try {
        console.log('👤 获取用户信息...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('✅ 用户信息获取成功:', user?.email);
        setUser(user);
      } catch (error) {
        console.error('❌ 获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔐 认证状态变化: ${event}`, session?.user?.email);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  console.log(`👤 useAuth 状态: loading=${loading}, user=${user?.email}`);

  return { user, loading };
}; 