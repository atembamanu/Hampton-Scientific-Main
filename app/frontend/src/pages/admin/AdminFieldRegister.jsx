import { Navigate } from 'react-router-dom';

import { getAdminUser } from '../../utils/adminAuth';

export const AdminFieldRegister = () => {
  const isSales = getAdminUser()?.role === 'sales';
  if (!isSales) return <Navigate to="/sysadmin/field" replace />;
  return <Navigate to="/sysadmin/field" replace state={{ registerFacility: true }} />;
};
