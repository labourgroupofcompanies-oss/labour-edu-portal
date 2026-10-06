import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import AccessDenied403 from './AccessDenied403';
import LogoPreloader from '../common/LogoPreloader';

const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LogoPreloader fullScreen={true} size="lg" text="Authenticating Platform Session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuper = user.role === 'super_admin' || user.role === 'platform_developer' || user.isPlatformDeveloper || (user.email || '').toLowerCase() === 'shrtgallery3@gmail.com';
  if (!isSuper) {
    return <AccessDenied403 />;
  }

  return children;
};

export default SuperAdminRoute;
