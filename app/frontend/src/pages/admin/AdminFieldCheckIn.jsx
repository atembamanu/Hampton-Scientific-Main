import { Navigate, useParams } from 'react-router-dom';

import { getAdminUser } from '../../utils/adminAuth';

export const AdminFieldCheckIn = () => {
  const { prospectId } = useParams();
  const isSales = getAdminUser()?.role === 'sales';
  if (!isSales) return <Navigate to="/sysadmin/field" replace />;
  return (
    <Navigate
      to="/sysadmin/field"
      replace
      state={{ visitForm: { mode: 'create', prospectId: prospectId || null } }}
    />
  );
};
