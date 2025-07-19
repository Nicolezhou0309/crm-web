import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supaClient';

interface UserProfile {
  id: number;
  user_id: string;
  nickname?: string;
  avatar_url?: string;
}

interface UserContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 检查环境变量
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取用户信息超时')), 10000); // 增加到10秒
      });
      
      const getUserPromise = supabase.auth.getUser();
      const result = await Promise.race([getUserPromise, timeoutPromise]) as any;
      const { data: { user }, error: userError } = result;
      
      if (userError) {
        console.error('[USER] 获取用户失败:', userError);
        setError(userError.message);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (user) {
        setUser(user);
        
        // 获取用户 profile 信息
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('users_profile')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (profileError) {
            console.error('[USER] 获取用户 profile 失败:', profileError);
            setError(profileError.message);
            setProfile(null);
          } else {
            setProfile(profileData);
          }
        } catch (profileErr) {
          console.error('[USER] 获取 profile 异常:', profileErr);
          setError('获取用户信息失败');
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('[USER] 获取用户信息异常:', err);
      setError(err instanceof Error ? err.message : '获取用户信息失败');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        refreshUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    refreshUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}; 