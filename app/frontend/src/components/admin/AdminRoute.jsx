import { Navigate } from 'react-router-dom';
import { isAdminSession, getAdminUser, hasCompanyPermission } from '../../utils/adminAuth';

export const AdminRoute = ({ children, permission }) => {
  if (!isAdminSession()) {
    return <Navigate to="/sysadmin" replace />;
  }
  if (permission && !hasCompanyPermission(getAdminUser(), permission)) {
    return <Navigate to="/sysadmin/dashboard" replace />;
  }
  return children;
};
