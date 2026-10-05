import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { formatPrice, hasQuotedPrices } from '../../utils/pricing';
import { formatDateTime } from '../../lib/utils';
import { FilterDateRange } from '../../components/FilterDateRange';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { joinMulti } from '../../utils/multiFilter';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
  FacilityListMeta,
  FacilityPager,
} from '../../components/facility/FacilityListControls';

const QUOTE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'revision_proposed', label: 'Revision proposed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const Quotes = () => {
  const { getAuthHeader, branches, token } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [branchFilter, setBranchFilter] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = { page, limit };
      const statusKey = joinMulti(statusFilter);
      const branchKey = joinMulti(branchFilter);
      if (branchKey) params.branch_id = branchKey;
      if (statusKey) params.status = statusKey;
      if (appliedSearch) params.search = appliedSearch;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await axios.get(`${API_URL}/api/quotes`, { headers: getAuthHeader(), params });
      setQuotes(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [getAuthHeader, branchFilter, statusFilter, fromDate, toDate, page, limit, appliedSearch]);
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useLiveUpdates({
    token,
    types: ['quote.updated', 'quote.priced', 'message.created'],
    onEvent: () => load(),
  });

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—';
  const filtersActive = Boolean(search || statusFilter.length || branchFilter.length || fromDate || toDate);

  const download = async (id, number) => {
    try {
      const res = await axios.get(`${API_URL}/api/quotes/${id}/download`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const header = await blob.slice(0, 5).text();
      if (header !== '%PDF-') throw new Error('Download failed');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${number || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };
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
        <h1 className="app-page-title">Quotes</h1>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search quote reference, contact…"
        />
        <FacilityMultiSelect
          value={statusFilter}
          onChange={(values) => { setStatusFilter(values); setPage(1); }}
          options={QUOTE_STATUSES}
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

      <FacilityListMeta total={total} page={page} limit={limit} noun="quotes" />

      {loading ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : quotes.length === 0 ? (
        <div className="editorial-panel p-12 text-center">
          <p className="text-ink-muted mb-4">{total === 0 && !search && !statusFilter.length ? 'No quotes yet.' : 'No quotes match these filters.'}</p>
          <Link to="/dashboard/products" className="btn-primary">Browse products</Link>
        </div>
      ) : (
        <div className="editorial-panel overflow-hidden p-0">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                <th className="px-5 py-3">Quote reference</th>
                <th className="px-5 py-3">Requested By</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">List Subtotal</th>
                <th className="px-5 py-3">Quoted Total</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const quoted = hasQuotedPrices(q.items);
                return (
                  <tr key={q.id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                    <td className="px-5 py-3 font-medium">
                      <Link to={`/dashboard/quotes/${q.id}`} className="hover:text-copper hover:underline">
                        {q.quote_number || q.id.slice(0, 8).toUpperCase()}
                      </Link>
                      {q.unread_messages > 0 && (
                        <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{q.unread_messages} new</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{q.requested_by || q.contact_person || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{branchName(q.ordered_for_branch_id)}</td>
                    <td className="px-5 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-5 py-3 text-ink-muted">{formatPrice(q.list_subtotal || 0)}</td>
                    <td className="px-5 py-3">
                      {quoted ? (
                        <span className="font-semibold text-copper">{formatPrice(q.total || 0)}</span>
                      ) : (
                        <span className="text-ink-faint">Pending quote</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(q.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {quoted && (
                        <button
                          type="button"
                          onClick={() => download(q.id, q.quote_number)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-copper hover:bg-ink/5"
                          aria-label="Download quote"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
