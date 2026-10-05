import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { branchOptionsForOrgs, joinMulti, parseMulti } from '../../utils/multiFilter';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminMultiSelect,
  AdminResetFilters,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminEmptyState,
  AdminLoadingState,
} from '../../components/admin/AdminPageHeader';

export const AdminDeliveries = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const orgIds = parseMulti(searchParams.get('organization_id'));
  const branchIds = parseMulti(searchParams.get('branch_id'));
  const orgKey = joinMulti(orgIds);
  const branchKey = joinMulti(branchIds);
  const branchOptions = branchOptionsForOrgs(orgs, orgIds);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader() })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : (res.data?.items || [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (orgKey) params.organization_id = orgKey;
    if (branchKey) params.branch_id = branchKey;
    setLoading(true);
    axios.get(`${API_URL}/api/admin/ops/orders`, { headers: getAdminHeader(), params })
      .then((res) => {
        const rows = (res.data || []).filter((o) =>
          ['dispatched', 'out_for_delivery', 'processing', 'order_placed', 'pending'].includes(o.status)
          || ['dispatched', 'out_for_delivery', 'processing', 'pending'].includes(o.deliveryStatus),
        );
        setOrders(rows);
      })
      .finally(() => setLoading(false));
  }, [orgKey, branchKey]);

  const writeMulti = (key, values) => {
    const next = new URLSearchParams(searchParams);
    const joined = joinMulti(values);
    if (joined) next.set(key, joined);
    else next.delete(key);
    if (key === 'organization_id') {
      const allowed = new Set(branchOptionsForOrgs(orgs, values).map((branch) => branch.value));
      const kept = parseMulti(next.get('branch_id')).filter((id) => allowed.has(id));
      if (kept.length) next.set('branch_id', kept.join(','));
      else next.delete('branch_id');
    }
    setSearchParams(next);
  };

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Deliveries"
        label="Fulfilment"
        description="Fulfilment queue. Delivery status is tracked separately from order and invoice status."
      />

      <AdminFilterBar>
        <AdminMultiSelect
          value={orgIds}
          onChange={(values) => writeMulti('organization_id', values)}
          placeholder="All facilities"
          searchPlaceholder="Search facilities…"
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
        />
        {branchOptions.length > 0 && (
          <AdminMultiSelect
            value={branchIds}
            onChange={(values) => writeMulti('branch_id', values)}
            placeholder="All branches"
            options={branchOptions}
          />
        )}
        <AdminResetFilters
          disabled={!orgKey && !branchKey}
          onReset={() => setSearchParams({})}
        />
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState />
      ) : orders.length === 0 ? (
        <AdminEmptyState>No deliveries in progress.</AdminEmptyState>
      ) : (
        <AdminDataTable minWidth={900}>
          <AdminTableHead>
            <AdminTableTh>Order</AdminTableTh>
            <AdminTableTh className="min-w-[240px]">Facility</AdminTableTh>
            <AdminTableTh>Order status</AdminTableTh>
            <AdminTableTh>Delivery</AdminTableTh>
            <AdminTableTh>Shipments</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {orders.map((o) => (
              <AdminTableRow key={o.id}>
                <AdminTableTd nowrap>
                  <Link to={`/sysadmin/orders/${o.id}`} className="font-semibold text-brand hover:text-copper hover:underline">{o.orderNumber}</Link>
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[280px]">{o.organizationName}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[280px]">{o.orderedForBranchName}</p>
                </AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={o.status} /></AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={o.deliveryStatus} /></AdminTableTd>
                <AdminTableTd nowrap>{(o.shipments || []).length}</AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      )}
    </div>
  );
};
