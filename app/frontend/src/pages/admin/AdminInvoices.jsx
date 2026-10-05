import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { getAdminToken } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { formatPrice, documentTax, documentNet } from '../../utils/pricing';
import { parseMulti } from '../../utils/multiFilter';
import { INVOICE_AWAITING_PAYMENT, INVOICE_STATUS_OPTIONS, invoiceDisplayStatus } from '../../utils/invoiceStatus';
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

const displayStatus = (inv) => invoiceDisplayStatus(inv);

// Older bookmarks / dashboard links used pending/unpaid; treat them as awaiting_payment.
const normalizeStatusParams = (values) =>
  Array.from(new Set(values.map((v) => (v === 'pending' || v === 'unpaid' ? INVOICE_AWAITING_PAYMENT : v))));

export const AdminInvoices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const statuses = normalizeStatusParams(parseMulti(searchParams.get('status')));
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const appliedSearch = useDebouncedValue(search, 300);
  const statusKey = statuses.join(',');

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (statusKey) params.status = statusKey;
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await axios.get(`${API_URL}/api/admin/invoices`, {
        headers: getAdminHeader(),
        params,
      });
      const data = res.data || {};
      setInvoices(data.invoices || []);
      setMeta({
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, limit, statusKey, appliedSearch, fromDate, toDate]);
  useEffect(() => { setPage(1); }, [statusKey, appliedSearch, fromDate, toDate]);
  useLiveUpdates({
    token: getAdminToken(),
    types: ['invoice.updated'],
    onEvent: () => load(),
  });

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
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

  return (
    <div className="w-full">
      <AdminPageHeader title="Invoices" label="Sales" />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
          placeholder="Search invoice #, facility, contact…"
          className="w-full"
        />
        <AdminMultiSelect
          value={statuses}
          onChange={(values) => updateParam('status', values.join(','))}
          placeholder="All statuses"
          options={INVOICE_STATUS_OPTIONS}
        />
        <FilterDateRange from={fromDate} to={toDate} onChange={({ from, to }) => writeDates(from, to)} />
        <AdminResetFilters
          disabled={!Boolean(search.trim() || statuses.length || fromDate || toDate)}
          onReset={() => {
            setSearch('');
            setSearchParams({});
          }}
        />
      </AdminFilterBar>

      <AdminTableShell loading={loading} hasRows={invoices.length > 0} empty="No invoices match these filters.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="invoices" />
        <AdminDataTable minWidth={1240}>
          <AdminTableHead>
            <AdminTableTh>Invoice reference</AdminTableTh>
            <AdminTableTh className="min-w-[220px]">Facility</AdminTableTh>
            <AdminTableTh className="min-w-[160px]">Contact</AdminTableTh>
            <AdminTableTh>Total</AdminTableTh>
            <AdminTableTh>Tax</AdminTableTh>
            <AdminTableTh>Net</AdminTableTh>
            <AdminTableTh>Issued</AdminTableTh>
            <AdminTableTh>Due</AdminTableTh>
            <AdminTableTh>Status</AdminTableTh>
            <AdminTableTh className="w-12"><span className="sr-only">Actions</span></AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {invoices.map((inv) => (
              <AdminTableRow key={inv.id}>
                <AdminTableTd nowrap>
                  <Link
                    to={`/sysadmin/invoices/${inv.id}`}
                    className="font-semibold text-brand hover:text-copper hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[260px] font-medium text-ink">{inv.facility_name}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[260px]">{inv.email}</p>
                </AdminTableTd>
                <AdminTableTd>
                  <span className="block truncate max-w-[200px]">{inv.contact_person}</span>
                </AdminTableTd>
                <AdminTableTd nowrap className="font-medium">{formatPrice(inv.total)}</AdminTableTd>
                <AdminTableTd nowrap>{formatPrice(documentTax(inv))}</AdminTableTd>
                <AdminTableTd nowrap>{formatPrice(documentNet(inv))}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">
                  {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                </AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                </AdminTableTd>
                <AdminTableTd nowrap><OpsStatusBadge status={displayStatus(inv)} /></AdminTableTd>
                <AdminTableTd nowrap className="text-right">
                  <RowActionsMenu
                    items={[
                      { label: 'View order', to: inv.order_id ? `/sysadmin/orders/${inv.order_id}` : undefined, disabled: !inv.order_id },
                      { label: 'View quote', to: inv.quote_id ? `/sysadmin/quotes/${inv.quote_id}` : undefined, disabled: !inv.quote_id },
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
