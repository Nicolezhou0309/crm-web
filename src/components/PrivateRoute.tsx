import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../supaClient';
import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLogin(!!data.user);
      setLoading(false);
    });
  }, []);

  if (loading) return null; // 可加loading动画
  if (!isLogin) return <Navigate to="/login" replace />;
  return <>{children}</>;
} 