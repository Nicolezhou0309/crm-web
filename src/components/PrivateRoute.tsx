import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../supaClient';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import LoadingScreen from './LoadingScreen';

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();

  if (loading) return <LoadingScreen type="auth" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
} 