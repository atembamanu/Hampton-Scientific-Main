import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminToken, getAdminUser, canAssignSales } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { formatPrice, documentTax, documentNet } from '../../utils/pricing';
import { branchOptionsForOrgs, joinMulti, parseMulti } from '../../utils/multiFilter';
import { FilterDateRange } from '../../components/FilterDateRange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminFilterInput,
  AdminMultiSelect,
  AdminResetFilters,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminListMeta,
  AdminPager,
  AdminTableShell,
} from '../../components/admin/AdminPageHeader';

export const AdminOrders = () => {
  const canAssign = canAssignSales(getAdminUser());
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const statuses = parseMulti(searchParams.get('status'));
  const orgIds = parseMulti(searchParams.get('organization_id'));
  const branchIds = parseMulti(searchParams.get('branch_id'));
  const assignedSalesIds = parseMulti(searchParams.get('assigned_sales_user_id'));
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';
  const [search, setSearch] = useState('');
  const appliedSearch = useDebouncedValue(search, 300);
  const branchOptions = branchOptionsForOrgs(orgs, orgIds);
  const statusKey = joinMulti(statuses);
  const orgKey = joinMulti(orgIds);
  const branchKey = joinMulti(branchIds);
  const salesKey = joinMulti(assignedSalesIds);

  const load = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = { page: overrides.page ?? page, limit };
      const q = overrides.search !== undefined ? overrides.search : appliedSearch;
      if (statusKey) params.status = statusKey;
      if (orgKey) params.organization_id = orgKey;
      if (branchKey) params.branch_id = branchKey;
      if (salesKey) params.assigned_sales_user_id = salesKey;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (q && q.trim()) params.search = q.trim();
      const res = await axios.get(`${API_URL}/api/admin/ops/orders`, { headers: getAdminHeader(), params });
      const data = res.data || {};
      const rows = Array.isArray(data) ? data : (data.orders || data.items || []);
      setOrders(rows);
      setMeta({
        total: Array.isArray(data) ? rows.length : (data.total || 0),
        page: data.page || params.page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusKey, orgKey, branchKey, salesKey, fromDate, toDate, appliedSearch, page, limit]);
  useEffect(() => { setPage(1); }, [statusKey, orgKey, branchKey, salesKey, fromDate, toDate, appliedSearch]);
  useLiveUpdates({
    token: getAdminToken(),
    types: ['order.updated', 'delivery.updated', 'invoice.updated'],
    onEvent: () => load(),
  });
  useEffect(() => {
    axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader(), params: { scope: 'orders' } })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : (res.data?.items || []))).catch(() => {});
    if (canAssign) {
      axios.get(`${API_URL}/api/admin/field/agents`, { headers: getAdminHeader() })
        .then((res) => setAgents(res.data?.agents || [])).catch(() => {});
    }
  }, [canAssign]);

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

  const writeDates = (from, to) => {
    const next = new URLSearchParams(searchParams);
    if (from) next.set('from_date', from);
    else next.delete('from_date');
    if (to) next.set('to_date', to);
    else next.delete('to_date');
    setSearchParams(next);
  };

  const filtersActive = Boolean(search.trim() || statusKey || orgKey || branchKey || salesKey || fromDate || toDate);

  return (
    <div className="w-full">
      <AdminPageHeader title="Orders" label="Sales" />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              load({ search, page: 1 });
            }
          }}
          placeholder="Search order #"
          className="w-full"
        />
        <AdminMultiSelect
          value={statuses}
          onChange={(values) => writeMulti('status', values)}
          placeholder="All statuses"
          options={['order_placed', 'processing', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => ({
            value: s,
            label: s.replace(/_/g, ' '),
          }))}
        />
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
        {canAssign && (
          <AdminMultiSelect
            value={assignedSalesIds}
            onChange={(values) => writeMulti('assigned_sales_user_id', values)}
            placeholder="All sales agents"
            searchPlaceholder="Search agents…"
            options={agents.map((a) => ({ value: a.id, label: a.name || a.email }))}
          />
        )}
        <FilterDateRange from={fromDate} to={toDate} onChange={({ from, to }) => writeDates(from, to)} />
        <AdminResetFilters
          disabled={!filtersActive}
          onReset={() => {
            setSearch('');
            setPage(1);
            setSearchParams({});
          }}
        />
      </AdminFilterBar>

      <AdminTableShell loading={loading} hasRows={orders.length > 0} empty="No orders found.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="orders" />
        <AdminDataTable minWidth={1280}>
          <AdminTableHead>
            <AdminTableTh>Order reference</AdminTableTh>
            <AdminTableTh className="min-w-[200px]">Facility</AdminTableTh>
            <AdminTableTh className="min-w-[160px]">Ordered by</AdminTableTh>
            <AdminTableTh>Total</AdminTableTh>
            <AdminTableTh>Tax</AdminTableTh>
            <AdminTableTh>Net</AdminTableTh>
            <AdminTableTh>Assigned</AdminTableTh>
            <AdminTableTh>Order</AdminTableTh>
            <AdminTableTh>Invoice</AdminTableTh>
            <AdminTableTh className="w-12"><span className="sr-only">Actions</span></AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {orders.map((o) => (
              <AdminTableRow key={o.id}>
                <AdminTableTd nowrap>
                  <Link to={`/sysadmin/orders/${o.id}`} className="font-semibold text-brand hover:text-copper hover:underline">{o.orderNumber}</Link>
                  <p className="text-xs text-ink-faint mt-0.5">                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}</p>
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[240px]">{o.organizationName}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[240px]">{o.orderedForBranchName}</p>
                </AdminTableTd>
                <AdminTableTd>
                  <span className="block truncate max-w-[200px]">{o.orderedByName}</span>
                </AdminTableTd>
                <AdminTableTd nowrap className="font-medium">{formatPrice(o.total ?? o.subtotal)}</AdminTableTd>
                <AdminTableTd nowrap>{formatPrice(documentTax(o))}</AdminTableTd>
                <AdminTableTd nowrap>{formatPrice(documentNet(o))}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{o.assigned_sales_name || '—'}</AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={o.status} /></AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={o.invoiceStatus} /></AdminTableTd>
                <AdminTableTd nowrap className="text-right">
                  <RowActionsMenu
                    items={[
                      { label: 'View quote', to: o.quoteId ? `/sysadmin/quotes/${o.quoteId}` : undefined, disabled: !o.quoteId },
                    ]}
                  />
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
        <AdminPager
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          limit={meta.limit}
          onPage={setPage}
          onLimit={(next) => { setLimit(next); setPage(1); }}
        />
      </AdminTableShell>
    </div>
  );
};
