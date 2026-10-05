import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Building2, FileText, ShoppingCart, Receipt, Users } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';

const StatCard = ({ icon: Icon, label, value, to }) => (
  <Link to={to} className="editorial-panel p-5 hover:border-copper/30 transition-colors block">
    <Icon className="w-5 h-5 text-copper mb-3" />
    <p className="text-2xl font-bold text-ink">{value ?? '—'}</p>
    <p className="text-xs text-ink-muted mt-1">{label}</p>
  </Link>
);

export const FacilityDashboard = () => {
  const { user, getAuthHeader, hasPermission, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const headers = getAuthHeader();
      const [statsRes, branchesRes] = await Promise.all([
        axios.get(`${API_URL}/api/organizations/me/stats`, { headers }),
        axios.get(`${API_URL}/api/organizations/me/branch-activity`, { headers }),
      ]);
      setStats(statsRes.data);
      setBranches(branchesRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [getAuthHeader]);

  useLiveUpdates({
    token,
    types: ['quote.updated', 'quote.priced', 'order.updated', 'invoice.updated', 'delivery.updated', 'message.created'],
    onEvent: () => load(),
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-ink/5 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-ink/5 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    hasPermission('branches') && { icon: Building2, label: 'Branches', value: stats?.branches, to: '/dashboard/branches' },
    hasPermission('users') && { icon: Users, label: 'Users', value: stats?.users, to: '/dashboard/users' },
    hasPermission('quotes') && { icon: FileText, label: 'Quotes', value: stats?.quotes, to: '/dashboard/quotes' },
    hasPermission('orders') && { icon: ShoppingCart, label: 'Orders', value: stats?.orders, to: '/dashboard/orders' },
    hasPermission('invoices') && { icon: Receipt, label: 'Invoices', value: stats?.invoices, to: '/dashboard/invoices' },
  ].filter(Boolean);

  return (
    <div>
      <p className="editorial-label mb-2">Overview</p>
      <h1 className="app-page-title mb-2">{user?.organization?.name || user?.facilityName}</h1>
      <p className="text-sm text-ink-muted mb-8 capitalize">
        {user?.role?.replace(/_/g, ' ')}
        {` · ${stats?.activeBranches || 0} active branch${(stats?.activeBranches || 0) !== 1 ? 'es' : ''}`}
      </p>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 ${statCards.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {branches.length > 0 && (
        <div className="editorial-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-ink/10 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="font-semibold text-ink">Branch activity</h2>
            <Link to="/dashboard/branches" className="text-xs text-copper hover:underline">Manage branches</Link>
          </div>
          <div className="table-scroll">
            <table className="w-full text-sm" style={{ minWidth: '720px' }}>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Quotes</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.branchId} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                    <td className="px-5 py-3 font-medium text-ink">
                      {b.branchName}
                      {b.isMain && <span className="ml-2 text-[10px] text-copper">MAIN</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{b.branchCode}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3 text-right">{b.quotes}</td>
                    <td className="px-5 py-3 text-right">{b.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
