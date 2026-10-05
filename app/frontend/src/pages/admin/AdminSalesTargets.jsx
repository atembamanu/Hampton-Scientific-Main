import { useEffect, useState } from 'react';
import axios from 'axios';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminUser } from '../../utils/adminAuth';
import { AdminPageHeader, AdminLoadingState } from '../../components/admin/AdminPageHeader';
import { SalesPerformanceTable, SalesTargetCard } from '../../components/admin/SalesPerformance';

export const AdminSalesTargets = () => {
  const user = getAdminUser();
  const isSales = user?.role === 'sales';
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/field/performance`, { headers: getAdminHeader() })
      .then((res) => setPerformance(res.data))
      .catch(() => setPerformance(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLoadingState />;

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Sales targets"
        label="Sales"
        description="Monthly targets and commission from paid invoices (net of tax) for facilities each agent registered."
      />
      {isSales && performance?.agents?.[0] && (
        <SalesTargetCard own row={performance.agents[0]} month={performance.month} />
      )}
      {!isSales && (
        <SalesPerformanceTable rows={performance?.agents || []} month={performance?.month} />
      )}
    </div>
  );
};
