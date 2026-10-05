import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminToken, getAdminUser, canAssignSales } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { formatDateTime } from '../../lib/utils';
import { branchOptionsForOrgs, joinMulti, parseMulti } from '../../utils/multiFilter';
import { FilterDateRange } from '../../components/FilterDateRange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CreateQuoteModal } from '../../components/admin/CreateQuoteModal';
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

const OPS_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awaiting_information', label: 'Awaiting Information' },
  { value: 'awaiting_customer', label: 'Awaiting Customer' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const QuoteQueue = ({ title = 'Quote Requests', defaultOpsStatus = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const canAssign = canAssignSales(getAdminUser());
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotes, setQuotes] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [initialClient, setInitialClient] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const appliedSearch = useDebouncedValue(search, 300);
  const rawStatus = searchParams.get('ops_status');
  const statusValues = rawStatus === null
    ? (defaultOpsStatus ? [defaultOpsStatus] : [])
    : parseMulti(rawStatus).filter((value) => value !== 'all');
  const orgIds = parseMulti(searchParams.get('organization_id'));
  const branchIds = parseMulti(searchParams.get('branch_id'));
  const assignedSalesIds = parseMulti(searchParams.get('assigned_sales_user_id'));
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';
  const statusKey = joinMulti(statusValues);
  const orgKey = joinMulti(orgIds);
  const branchKey = joinMulti(branchIds);
  const salesKey = joinMulti(assignedSalesIds);
  const branchOptions = branchOptionsForOrgs(orgs, orgIds);

  const load = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = { page: overrides.page ?? page, limit };
      const q = overrides.search !== undefined ? overrides.search : appliedSearch;
      if (statusKey) params.ops_status = statusKey;
      if (orgKey) params.organization_id = orgKey;
      if (branchKey) params.branch_id = branchKey;
      if (salesKey) params.assigned_sales_user_id = salesKey;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (q) params.search = q.trim();
      const res = await axios.get(`${API_URL}/api/admin/ops/quotes`, { headers: getAdminHeader(), params });
      const data = res.data || {};
      setQuotes(data.quotes || data.items || []);
      setMeta({
        total: data.total || 0,
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
    types: ['quote.updated', 'quote.priced', 'message.created', 'order.updated'],
    onEvent: () => load(),
  });
  useEffect(() => {
    axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader(), params: { scope: 'quotes' } })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : (res.data?.items || [])))
      .catch(() => {});
    if (canAssign) {
      axios.get(`${API_URL}/api/admin/field/agents`, { headers: getAdminHeader() })
        .then((res) => setAgents(res.data?.agents || []))
        .catch(() => {});
    }
  }, [canAssign]);

  useEffect(() => {
    if (title !== 'Quotes' || !location.state?.createQuote) return;
    setInitialClient(location.state.createQuote);
    setCreateOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate, title]);

  const writeMulti = (key, values) => {
    const next = new URLSearchParams(searchParams);
    const joined = joinMulti(values);
    if (joined) next.set(key, joined);
    else if (key === 'ops_status' && defaultOpsStatus) next.set(key, 'all');
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

  const filtersActive = Boolean(
    search.trim()
    || statusKey !== (defaultOpsStatus || '')
    || orgKey
    || branchKey
    || salesKey
    || fromDate
    || toDate
  );

  const resetFilters = () => {
    setSearch('');
    const next = new URLSearchParams();
    if (defaultOpsStatus) next.set('ops_status', defaultOpsStatus);
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className="w-full">
      <AdminPageHeader
        title={title}
        label="Sales"
        actions={title === 'Quotes' ? (
          <button type="button" className="btn-primary inline-flex h-10 items-center gap-2 px-4 text-sm" onClick={() => { setInitialClient(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" /> Create quote
          </button>
        ) : null}
      />

      <AdminFilterBar>
        <div className="filter-search relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <AdminFilterInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                load({ search, page: 1 });
              }
            }}
            placeholder="Search quote #, facility, contact…"
            className="w-full pl-9"
          />
        </div>
        <AdminMultiSelect
          value={statusValues}
          onChange={(values) => writeMulti('ops_status', values)}
          placeholder="All statuses"
          options={OPS_STATUSES}
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
        <AdminResetFilters disabled={!filtersActive} onReset={resetFilters} />
      </AdminFilterBar>

      <AdminTableShell loading={loading} hasRows={quotes.length > 0} empty="No quotes match these filters.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun={title === 'Quotes' ? 'quotes' : 'quote requests'} />
        <AdminDataTable minWidth={1200}>
          <AdminTableHead>
            <AdminTableTh>Quote reference</AdminTableTh>
            <AdminTableTh className="min-w-[220px]">Facility / Branch</AdminTableTh>
            <AdminTableTh className="min-w-[180px]">Requested by</AdminTableTh>
            <AdminTableTh>Items</AdminTableTh>
            <AdminTableTh>Submitted</AdminTableTh>
            <AdminTableTh>Last activity</AdminTableTh>
            <AdminTableTh>Status</AdminTableTh>
            <AdminTableTh>Assigned</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {quotes.map((q) => (
              <AdminTableRow key={q.id}>
                <AdminTableTd nowrap>
                  <Link to={`/sysadmin/quotes/${q.id}`} className="font-semibold text-brand hover:text-copper hover:underline">
                    {q.quote_number || q.id.slice(0, 8).toUpperCase()}
                  </Link>
                  {q.unread_messages > 0 && (
                    <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{q.unread_messages} new</span>
                  )}
                </AdminTableTd>
                <AdminTableTd>
                  <p className="font-medium text-ink truncate max-w-[280px]">{q.organization_name}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[280px]">{q.branch_name || '—'}</p>
                  {q.is_guest && (
                    <span className="mt-1 inline-flex text-[10px] uppercase tracking-wide bg-copper/10 text-copper px-1.5 py-0.5 rounded-full">Guest</span>
                  )}
                </AdminTableTd>
                <AdminTableTd>
                  <span className="block truncate max-w-[220px] text-ink">{q.requested_by}</span>
                </AdminTableTd>
                <AdminTableTd nowrap>{q.item_count}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{formatDateTime(q.created_at)}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{formatDateTime(q.last_activity || q.updated_at)}</AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={q.ops_status} /></AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{q.assigned_sales_name || '—'}</AdminTableTd>
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
      {title === 'Quotes' && (
        <CreateQuoteModal
          open={createOpen}
          onOpenChange={(next) => {
            setCreateOpen(next);
            if (!next) setInitialClient(null);
          }}
          initialClient={initialClient}
          onCreated={(quoteId) => {
            setCreateOpen(false);
            setInitialClient(null);
            if (quoteId) navigate(`/sysadmin/quotes/${quoteId}`);
            else load({ page: 1 });
          }}
        />
      )}
    </div>
  );
};
