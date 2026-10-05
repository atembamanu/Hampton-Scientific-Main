import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../../context/AuthContext';
import { useQuote } from '../../context/QuoteContext';
import { useConfirm } from '../../components/ConfirmProvider';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { formatDateTime } from '../../lib/utils';
import { FilterDateRange } from '../../components/FilterDateRange';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { joinMulti } from '../../utils/multiFilter';
import { startOrderAgain } from '../../utils/orderAgain';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
  FacilityListMeta,
  FacilityPager,
} from '../../components/facility/FacilityListControls';

const ORDER_STATUSES = [
  { value: 'order_placed', label: 'Order placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const Orders = () => {
  const { getAuthHeader, branches, token } = useAuth();
  const { hasItems, loadReorderQuote } = useQuote();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = { page, limit };
      const branchKey = joinMulti(branchFilter);
      const statusKey = joinMulti(statusFilter);
      if (branchKey) params.branch_id = branchKey;
      if (statusKey) params.status = statusKey;
      if (appliedSearch) params.search = appliedSearch;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await axios.get(`${API_URL}/api/orders`, { headers: getAuthHeader(), params });
      setOrders(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [getAuthHeader, branchFilter, statusFilter, fromDate, toDate, page, limit, appliedSearch]);
  useEffect(() => {
    const t = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useLiveUpdates({
    token,
    types: ['order.updated', 'delivery.updated'],
    onEvent: () => load(),
  });

  const filtersActive = Boolean(search || statusFilter.length || branchFilter.length || fromDate || toDate);
  const resetFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter([]);
    setBranchFilter([]);
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6">
        <p className="editorial-label mb-2">Procurement</p>
        <h1 className="app-page-title">Orders</h1>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order reference, quote, ordered by…"
        />
        <FacilityMultiSelect
          value={statusFilter}
          onChange={(values) => { setStatusFilter(values); setPage(1); }}
          options={ORDER_STATUSES}
          placeholder="All statuses"
          searchPlaceholder="Search status…"
        />
        {branches.length > 1 && (
          <FacilityMultiSelect
            value={branchFilter}
            onChange={(values) => { setBranchFilter(values); setPage(1); }}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            searchPlaceholder="Search branch…"
          />
        )}
        <FilterDateRange
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => { setFromDate(from); setToDate(to); setPage(1); }}
        />
        <FacilityResetFilters disabled={!filtersActive} onReset={resetFilters} />
      </FacilityFilterBar>

      <FacilityListMeta total={total} page={page} limit={limit} noun="orders" />

      {loading ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">
          {total === 0 && !search && !statusFilter.length ? 'No orders yet.' : 'No orders match these filters.'}
        </div>
      ) : (
        <div className="editorial-panel overflow-hidden p-0">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                <th className="px-5 py-3">Order reference</th>
                <th className="px-5 py-3">Ordered for</th>
                <th className="px-5 py-3">Ordered by</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Order Date</th>
                <th className="px-5 py-3">Dispatched Date</th>
                <th className="px-5 py-3">Delivered Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/dashboard/orders/${o.id}`} className="hover:text-copper hover:underline">{o.orderNumber}</Link>
                  </td>
                  <td className="px-5 py-3">{o.orderedForBranchName}</td>
                  <td className="px-5 py-3 text-ink-muted">{o.orderedByName}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(o.orderedAt || o.createdAt)}</td>
                  <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(o.dispatchedAt)}</td>
                  <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(o.deliveredAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu
                      items={[
                        { label: 'View quote', to: o.quoteId ? `/dashboard/quotes/${o.quoteId}` : undefined, disabled: !o.quoteId },
                        {
                          label: 'Order again',
                          onSelect: () => startOrderAgain({
                            order: o,
                            getAuthHeader,
                            hasItems,
                            confirm,
                            loadReorderQuote,
                            navigate,
                          }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <FacilityPager
            page={page}
            pages={pages}
            total={total}
            limit={limit}
            onPage={setPage}
            onLimit={(n) => { setLimit(n); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
};
