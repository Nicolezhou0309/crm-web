import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import LoadingScreen from './LoadingScreen';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();

  if (loading) return <LoadingScreen type="auth" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
} 