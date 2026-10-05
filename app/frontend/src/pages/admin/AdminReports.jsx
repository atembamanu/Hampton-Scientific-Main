import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { formatPrice } from '../../utils/pricing';
import { FilterDateRange } from '../../components/FilterDateRange';
import { SheetTabs } from '../../components/ui/SheetTabs';
import {
  AdminPageHeader,
  AdminDataTable,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminEmptyState,
  AdminLoadingState,
} from '../../components/admin/AdminPageHeader';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'trend', label: 'Trend' },
];

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under review',
  awaiting_information: 'Awaiting information',
  awaiting_customer: 'Awaiting customer',
  accepted: 'Accepted',
  converted: 'Converted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const percent = (value) => (value == null ? '—' : `${value}%`);
const days = (value) => (value == null ? '—' : `${value} days`);

const compareValues = (left, right) => {
  const leftEmpty = left == null || left === '';
  const rightEmpty = right == null || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};

const sortRows = (rows, sort) => [...rows].sort((a, b) => {
  const result = compareValues(a[sort.key], b[sort.key]);
  return sort.dir === 'asc' ? result : -result;
});

const Metric = ({ label, value, hint }) => (
  <div className="editorial-panel p-5">
    <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-copper">{label}</p>
    <p className="text-2xl font-semibold tabular-nums mt-2 text-ink">{value}</p>
    {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
  </div>
);

const SortHeader = ({ label, sortKey, sort, onSort, align = 'left' }) => {
  const active = sort.key === sortKey;
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        className={`report-sort inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold ${active ? 'text-ink' : 'text-ink-faint hover:text-ink'}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
};

export const AdminReports = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [tab, setTab] = useState('overview');
  const [sorts, setSorts] = useState({
    facilities: { key: 'orderValue', dir: 'desc' },
    products: { key: 'revenue', dir: 'desc' },
    categories: { key: 'revenue', dir: 'desc' },
    monthly: { key: 'month', dir: 'asc' },
  });

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    axios.get(`${API_URL}/api/admin/reports`, { headers: getAdminHeader(), params })
      .then((res) => setReport(res.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const toggleSort = (table, key) => {
    setSorts((prev) => {
      const current = prev[table];
      if (current.key === key) {
        return { ...prev, [table]: { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } };
      }
      const textKey = key === 'name' || key === 'month' || key === 'county' || key === 'category';
      return { ...prev, [table]: { key, dir: textKey ? 'asc' : 'desc' } };
    });
  };

  const facilities = useMemo(
    () => sortRows(report?.facilities || [], sorts.facilities),
    [report, sorts.facilities],
  );
  const products = useMemo(
    () => sortRows(report?.products || [], sorts.products),
    [report, sorts.products],
  );
  const categories = useMemo(
    () => sortRows(report?.categories || [], sorts.categories),
    [report, sorts.categories],
  );
  const monthly = useMemo(
    () => sortRows(report?.monthly || [], sorts.monthly),
    [report, sorts.monthly],
  );

  const summary = report?.summary || {};
  const topFacility = [...(report?.facilities || [])].sort((a, b) => b.orderValue - a.orderValue)[0];
  const topProduct = [...(report?.products || [])].sort((a, b) => b.revenue - a.revenue)[0];
  const periodLabel = fromDate || toDate
    ? `${fromDate || 'Start'} to ${toDate || 'today'}`
    : 'All time';

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Reports"
        label="Analytics"
        description="Period figures follow the date range. Outstanding invoices, open orders, unread messages, and stock are the current position."
        actions={(
          <div className="w-full sm:w-56">
            <FilterDateRange
              from={fromDate}
              to={toDate}
              onChange={({ from, to }) => { setFromDate(from); setToDate(to); }}
            />
          </div>
        )}
      />

      <div className="mb-6">
        <SheetTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {loading ? <AdminLoadingState /> : !report ? (
        <AdminEmptyState>Reports could not be loaded.</AdminEmptyState>
      ) : tab === 'overview' && (
        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint mb-3">{periodLabel}</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Metric label="Quote value" value={formatPrice(summary.quoteValue)} hint={`${summary.quoteCount} quotes · avg ${formatPrice(summary.avgQuoteValue)}`} />
              <Metric label="Win rate" value={percent(summary.winRate)} hint={`${summary.won} won of ${summary.decided} decided`} />
              <Metric label="Order value" value={formatPrice(summary.orderValue)} hint={`${summary.orderCount} orders · avg ${formatPrice(summary.avgOrderValue)}`} />
              <Metric label="Gross profit" value={formatPrice(summary.grossProfit)} hint={`Margin ${percent(summary.marginRate)} where cost is known`} />
              <Metric label="Invoiced" value={formatPrice(summary.invoiced)} hint={`${summary.invoiceCount} invoices`} />
              <Metric label="Collected" value={formatPrice(summary.collected)} hint={`Collection ${percent(summary.collectionRate)}`} />
              <Metric label="Delivered" value={summary.delivered ?? 0} hint={days(summary.avgQuoteToOrderDays) === '—' ? 'No quote-to-order cycle yet' : `Avg quote to order ${days(summary.avgQuoteToOrderDays)}`} />
              <Metric label="Quoted, not ordered" value={(report.quotedNotOrdered || []).length} hint="Products requested in this period with no order" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint mb-3">Right now</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Metric label="Outstanding" value={formatPrice(summary.outstanding)} hint="Awaiting payment and overdue" />
              <Metric label="Overdue" value={formatPrice(summary.overdueValue)} hint={`${summary.overdueCount} invoices past due`} />
              <Metric label="Active orders" value={summary.activeOrders ?? 0} hint={`${summary.fulfilment} still to fulfil · ${summary.deliveries} in delivery`} />
              <Metric label="Needs attention" value={(summary.unreadMessages || 0) + (summary.outOfStock || 0)} hint={`${summary.unreadMessages} unread messages · ${summary.outOfStock} out of stock`} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="editorial-panel p-5 text-sm space-y-2">
              <p className="font-semibold text-ink">Where to act</p>
              {summary.overdueValue > 0 && <p>{formatPrice(summary.overdueValue)} is overdue. Collect that before chasing new quotes.</p>}
              {topFacility && <p>{topFacility.name} leads order value at {formatPrice(topFacility.orderValue)}.</p>}
              {topProduct && <p>{topProduct.name} is the highest-revenue product at {formatPrice(topProduct.revenue)}.</p>}
              {summary.winRate != null && summary.winRate < 40 && summary.decided > 0 && (
                <p>Win rate is {percent(summary.winRate)}. Review rejected and cancelled quotes before adding catalogue.</p>
              )}
              {!summary.overdueValue && !topFacility && !topProduct && <p>No commercial activity in this period.</p>}
            </div>
            <div className="editorial-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-ink/10 font-semibold text-sm">Quote pipeline</div>
              {(report.pipeline || []).length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-muted">No quotes in this period.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {report.pipeline.map((row) => (
                    <li key={row.status} className="px-5 py-3 flex items-center justify-between text-sm">
                      <span>{STATUS_LABELS[row.status] || row.status}</span>
                      <span className="tabular-nums text-ink-muted">{row.count} · {formatPrice(row.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {(report.quotedNotOrdered || []).length > 0 && (
            <div className="editorial-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-ink/10 font-semibold text-sm">Demand without an order</div>
              <ul className="divide-y divide-ink/5">
                {report.quotedNotOrdered.map((row) => (
                  <li key={row.name} className="px-5 py-3 flex items-center justify-between text-sm">
                    <span>{row.name}{row.category ? <span className="text-ink-muted"> · {row.category}</span> : null}</span>
                    <span className="tabular-nums text-ink-muted">{row.quotedQty} quoted</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && report && tab === 'facilities' && (
        facilities.length === 0 ? <AdminEmptyState>No facility activity in this period.</AdminEmptyState> : (
          <>
          <p className="text-xs text-ink-muted mb-3">Quotes, orders, and invoices follow the selected period. Outstanding and overdue are what is owed today.</p>
          <AdminDataTable minWidth={1400}>
            <AdminTableHead>
              <SortHeader label="Facility" sortKey="name" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} />
              <SortHeader label="County" sortKey="county" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} />
              <SortHeader label="Quotes" sortKey="quotes" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Quote value" sortKey="quoteValue" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Win rate" sortKey="conversionRate" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Orders" sortKey="orders" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Order value" sortKey="orderValue" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Margin" sortKey="margin" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Invoiced" sortKey="invoiced" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Collected" sortKey="collected" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Outstanding" sortKey="outstanding" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
              <SortHeader label="Overdue" sortKey="overdue" sort={sorts.facilities} onSort={(key) => toggleSort('facilities', key)} align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {facilities.map((row) => (
                <AdminTableRow key={row.id}>
                  <AdminTableTd>
                    {row.organizationId ? (
                      <Link to={`/sysadmin/facilities/${row.organizationId}`} className="font-medium text-brand hover:text-copper hover:underline">{row.name}</Link>
                    ) : row.name}
                  </AdminTableTd>
                  <AdminTableTd>{row.county || '—'}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.quotes}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.quoteValue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{percent(row.conversionRate)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.orders}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.orderValue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.margin)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.invoiced)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.collected)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.outstanding)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.overdue)}</AdminTableTd>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
          </>
        )
      )}

      {!loading && report && tab === 'products' && (
        products.length === 0 ? <AdminEmptyState>No products were ordered in this period.</AdminEmptyState> : (
          <AdminDataTable minWidth={900}>
            <AdminTableHead>
              <SortHeader label="Product" sortKey="name" sort={sorts.products} onSort={(key) => toggleSort('products', key)} />
              <SortHeader label="Category" sortKey="category" sort={sorts.products} onSort={(key) => toggleSort('products', key)} />
              <SortHeader label="Qty ordered" sortKey="quantity" sort={sorts.products} onSort={(key) => toggleSort('products', key)} align="right" />
              <SortHeader label="Qty quoted" sortKey="quotedQty" sort={sorts.products} onSort={(key) => toggleSort('products', key)} align="right" />
              <SortHeader label="Revenue" sortKey="revenue" sort={sorts.products} onSort={(key) => toggleSort('products', key)} align="right" />
              <SortHeader label="Margin" sortKey="margin" sort={sorts.products} onSort={(key) => toggleSort('products', key)} align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {products.map((row) => (
                <AdminTableRow key={row.name}>
                  <AdminTableTd className="font-medium">{row.name}</AdminTableTd>
                  <AdminTableTd>{row.category || '—'}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.quantity}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.quotedQty}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.revenue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.margin)}</AdminTableTd>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
        )
      )}

      {!loading && report && tab === 'categories' && (
        categories.length === 0 ? <AdminEmptyState>No category sales in this period.</AdminEmptyState> : (
          <AdminDataTable minWidth={720}>
            <AdminTableHead>
              <SortHeader label="Category" sortKey="name" sort={sorts.categories} onSort={(key) => toggleSort('categories', key)} />
              <SortHeader label="Qty ordered" sortKey="quantity" sort={sorts.categories} onSort={(key) => toggleSort('categories', key)} align="right" />
              <SortHeader label="Revenue" sortKey="revenue" sort={sorts.categories} onSort={(key) => toggleSort('categories', key)} align="right" />
              <SortHeader label="Margin" sortKey="margin" sort={sorts.categories} onSort={(key) => toggleSort('categories', key)} align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {categories.map((row) => (
                <AdminTableRow key={row.name}>
                  <AdminTableTd className="font-medium">{row.name}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.quantity}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.revenue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.margin)}</AdminTableTd>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
        )
      )}

      {!loading && report && tab === 'trend' && (
        monthly.length === 0 ? <AdminEmptyState>No monthly activity in this period.</AdminEmptyState> : (
          <AdminDataTable minWidth={980}>
            <AdminTableHead>
              <SortHeader label="Month" sortKey="month" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} />
              <SortHeader label="Quotes" sortKey="quotes" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
              <SortHeader label="Quote value" sortKey="quoteValue" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
              <SortHeader label="Orders" sortKey="orders" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
              <SortHeader label="Order value" sortKey="orderValue" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
              <SortHeader label="Invoiced" sortKey="invoiced" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
              <SortHeader label="Collected" sortKey="collected" sort={sorts.monthly} onSort={(key) => toggleSort('monthly', key)} align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {monthly.map((row) => (
                <AdminTableRow key={row.month}>
                  <AdminTableTd className="font-medium">{row.month}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.quotes}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.quoteValue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{row.orders}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.orderValue)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.invoiced)}</AdminTableTd>
                  <AdminTableTd className="text-right tabular-nums">{formatPrice(row.collected)}</AdminTableTd>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
        )
      )}
    </div>
  );
};
