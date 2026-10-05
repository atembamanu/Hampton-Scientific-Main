import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isCompanyStaff } from '../../utils/adminAuth';
import { Forbidden } from './Forbidden';
import { facilityHomePath } from '../../utils/facilityHome';

export const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated, loading, hasPermission, user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && isCompanyStaff(user)) {
      logout();
    }
  }, [loading, isAuthenticated, user, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-ink-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (isCompanyStaff(user)) {
    return <Navigate to="/sysadmin" replace />;
  }

  if (permission && !hasPermission(permission)) {
    if (permission === 'dashboard') {
      return <Navigate to={facilityHomePath(user)} replace />;
    }
    return <Forbidden />;
  }

  return children;
};
