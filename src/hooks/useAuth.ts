import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取当前用户
    const getUser = async () => {
      try { 
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) { 
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}; 