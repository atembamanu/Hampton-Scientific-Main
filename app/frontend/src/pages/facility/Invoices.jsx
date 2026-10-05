import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { INVOICE_STATUS_OPTIONS, INVOICE_AWAITING_PAYMENT, INVOICE_OVERDUE, invoiceDisplayStatus } from '../../utils/invoiceStatus';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { FilterDateRange } from '../../components/FilterDateRange';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { joinMulti } from '../../utils/multiFilter';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
  FacilityListMeta,
  FacilityPager,
} from '../../components/facility/FacilityListControls';

const INVOICE_STATUSES = INVOICE_STATUS_OPTIONS;
const AMOUNT_DUE_STATUSES = [INVOICE_AWAITING_PAYMENT, INVOICE_OVERDUE];

export const Invoices = () => {
  const { getAuthHeader, token, branches } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [amountTotal, setAmountTotal] = useState(0);
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
    const params = { page, limit };
    const statusKey = joinMulti(statusFilter);
    const branchKey = joinMulti(branchFilter);
    if (statusKey) params.status = statusKey;
    if (branchKey) params.branch_id = branchKey;
    if (appliedSearch) params.search = appliedSearch;
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    const res = await axios.get(`${API_URL}/api/invoices`, { headers: getAuthHeader(), params });
    setInvoices(res.data.items || []);
    setTotal(res.data.total || 0);
    setAmountTotal(Number(res.data.amount_total || 0));
    setPages(res.data.pages || 1);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [getAuthHeader, statusFilter, branchFilter, fromDate, toDate, page, limit, appliedSearch]);
  useEffect(() => {
    const t = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useLiveUpdates({
    token,
    types: ['invoice.updated'],
    onEvent: () => load().catch(() => {}),
  });

  const filtersActive = Boolean(search || statusFilter.length || branchFilter.length || fromDate || toDate);
  const showAmountDue = statusFilter.length > 0
    && statusFilter.every((status) => AMOUNT_DUE_STATUSES.includes(status));
  const amountLabel = statusFilter.length === 1 && statusFilter[0] === INVOICE_OVERDUE
    ? 'Overdue total'
    : 'Amount due';
  const resetFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter([]);
    setBranchFilter([]);
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const download = async (id, number) => {
    try {
      const res = await axios.get(`${API_URL}/api/invoices/${id}/download`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const header = await blob.slice(0, 5).text();
      if (header !== '%PDF-') {
        throw new Error('Download failed');
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${number || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <p className="editorial-label mb-2">Billing</p>
        <h1 className="app-page-title">Invoices</h1>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice reference, facility, contact…"
        />
        <FacilityMultiSelect
          value={statusFilter}
          onChange={(values) => { setStatusFilter(values); setPage(1); }}
          options={INVOICE_STATUSES}
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

      <FacilityListMeta
        total={total}
        page={page}
        limit={limit}
        noun="invoices"
        amountTotal={showAmountDue ? amountTotal : null}
        amountLabel={amountLabel}
      />

      {loading ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : invoices.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">
          {total === 0 && !search && !statusFilter.length ? 'No invoices yet.' : 'No invoices match these filters.'}
        </div>
      ) : (
        <div className="editorial-panel overflow-hidden p-0">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '960px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                <th className="px-5 py-3">Invoice reference</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/dashboard/invoices/${inv.id}`} className="text-ink hover:text-copper hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{inv.facility_name}</td>
                  <td className="px-5 py-3">KES {Number(inv.total || 0).toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusBadge status={invoiceDisplayStatus(inv)} /></td>
                  <td className="px-5 py-3 text-ink-muted">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => download(inv.id, inv.invoice_number)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-copper hover:bg-ink/5 hover:text-copper/80">
                        <Download className="w-4 h-4" />
                      </button>
                      <RowActionsMenu
                        items={[
                          { label: 'View invoice', to: `/dashboard/invoices/${inv.id}` },
                          { label: 'View order', to: inv.order_id ? `/dashboard/orders/${inv.order_id}` : undefined, disabled: !inv.order_id },
                          { label: 'View quote', to: inv.quote_id ? `/dashboard/quotes/${inv.quote_id}` : undefined, disabled: !inv.quote_id },
                        ]}
                      />
                    </div>
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
