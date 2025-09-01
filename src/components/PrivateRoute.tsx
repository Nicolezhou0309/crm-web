import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../context/UserContext';
import LoadingScreen from './LoadingScreen';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { profile, loading: profileLoading } = useUser();

  // 如果认证检查还在进行中，显示加载屏幕
  if (isLoading) {
    return <LoadingScreen type="auth" message="正在验证用户身份..." subtitle="请稍候，我们正在检查您的登录状态" />;
  }
  
  // 如果 profile 还在加载中，显示加载屏幕
  if (profileLoading) {
    return <LoadingScreen type="auth" message="正在加载用户信息..." subtitle="请稍候，我们正在获取您的个人资料" />;
  }
  
  // 如果未认证或没有用户信息，重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  
  // 如果用户已认证但没有 profile 信息，也重定向到登录页
  if (!profile) {
    console.warn('用户已认证但缺少 profile 信息，重定向到登录页');
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
} 