import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { isAdminRole } from '../types';

/** Sends signed-out visitors to /login and brings them back to where they were headed. */
export const RequireAuth: React.FC = () => {
  const { session } = useAuthContext();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
};

/** UI-level gate only. The backend enforces the admin role on every /api/admin/** call. */
export const RequireAdmin: React.FC = () => {
  const { session } = useAuthContext();
  if (!isAdminRole(session?.role)) {
    return <Navigate to={session ? `/s/${session.societyId}` : '/login'} replace />;
  }
  return <Outlet />;
};

export const HomeRedirect: React.FC = () => {
  const { session } = useAuthContext();
  return <Navigate to={session ? `/s/${session.societyId}` : '/login'} replace />;
};
