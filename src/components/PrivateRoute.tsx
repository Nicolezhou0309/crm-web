import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../supaClient';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();

  if (loading) return null; // 可加loading动画
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
} 