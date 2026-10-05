import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format, startOfDay, subMonths } from 'date-fns';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { FilterDateRange } from '../../components/FilterDateRange';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
} from '../../components/facility/FacilityListControls';
import { SheetTabs } from '../../components/ui/SheetTabs';
import { formatDate } from '../../lib/utils';
import { joinMulti } from '../../utils/multiFilter';

const defaultFrom = () => format(subMonths(startOfDay(new Date()), 6), 'yyyy-MM-dd');
const defaultTo = () => format(startOfDay(new Date()), 'yyyy-MM-dd');

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'activity', label: 'Activity' },
];

const Metric = ({ label, value, hint, to }) => {
  const body = (
    <>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-copper">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-2 text-ink">{value ?? '—'}</p>
      {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="editorial-panel p-5 hover:border-copper/30 transition-colors block">
        {body}
      </Link>
    );
  }
  return <div className="editorial-panel p-5">{body}</div>;
};

const BarChart = ({ rows }) => {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.orders || 0, row.quotes || 0, row.items || 0)));
  if (!rows.length) {
    return <p className="text-sm text-ink-muted px-5 py-8">No activity in this period.</p>;
  }
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-4 text-[11px] text-ink-muted mb-4">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-copper" /> Orders</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink/50" /> Quotes</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-copper/30" /> Items</span>
      </div>
      <div className="flex items-end gap-2 h-40 overflow-x-auto">
        {rows.map((row) => (
          <div key={row.month} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              <div className="w-1/3 min-h-[2px] rounded-t-sm bg-copper" style={{ height: `${((row.orders || 0) / max) * 100}%` }} title={`${row.orders} orders`} />
              <div className="w-1/3 min-h-[2px] rounded-t-sm bg-ink/50" style={{ height: `${((row.quotes || 0) / max) * 100}%` }} title={`${row.quotes} quotes`} />
              <div className="w-1/3 min-h-[2px] rounded-t-sm bg-copper/30" style={{ height: `${((row.items || 0) / max) * 100}%` }} title={`${row.items} items`} />
            </div>
            <span className="text-[10px] text-ink-muted truncate w-full text-center">{row.label || row.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const productKey = (product) => product.productId || product.productName;
const categoryName = (product) => product.category || 'Uncategorised';

const matchesProduct = (product, search, categories) => {
  const query = search.trim().toLowerCase();
  const matchesSearch = !query || [product.productName, product.category, product.sku].some((value) =>
    String(value || '').toLowerCase().includes(query)
  );
  const matchesCategory = categories.length === 0 || categories.includes(categoryName(product));
  return matchesSearch && matchesCategory;
};

const ProductListFilters = ({ search, onSearch, categories, onCategories, options }) => {
  const active = Boolean(search.trim() || categories.length);
  return (
    <FacilityFilterBar>
      <FacilitySearchInput
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search product, category…"
      />
      <FacilityMultiSelect
        value={categories}
        onChange={onCategories}
        options={options}
        placeholder="All categories"
        searchPlaceholder="Search category…"
      />
      <FacilityResetFilters
        disabled={!active}
        onReset={() => { onSearch(''); onCategories([]); }}
      />
    </FacilityFilterBar>
  );
};

export const Reports = () => {
  const { getAuthHeader, isBranchManager, branches: authBranches, primaryBranchId } = useAuth();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [branchFilter, setBranchFilter] = useState([]);
  const [tab, setTab] = useState('overview');
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState([]);

  const branch = authBranches?.find((b) => b.id === primaryBranchId);
  const showBranchFilter = !isBranchManager && (authBranches || []).length > 1;
  const tabs = useMemo(
    () => (reports?.branches?.length ? [...TABS, { id: 'branches', label: 'Branches' }] : TABS),
    [reports],
  );

  useEffect(() => {
    const headers = getAuthHeader();
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    const branchKey = joinMulti(branchFilter);
    if (branchKey) params.branch_id = branchKey;
    setLoading(true);
    axios.get(`${API_URL}/api/organizations/me/reports`, { headers, params })
      .then((res) => setReports(res.data))
      .catch(() => setReports(null))
      .finally(() => setLoading(false));
  }, [getAuthHeader, fromDate, toDate, branchFilter]);

  const summary = reports?.summary || {};
  const restock = reports?.restock || [];
  const products = reports?.products || [];
  const categories = reports?.categories || [];
  const monthly = reports?.monthly || [];
  const catMax = Math.max(1, ...categories.map((row) => row.quantity || 0));
  const categoryOptions = useMemo(() => {
    const names = [...new Set(products.map(categoryName))];
    return names.sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [products]);
  const filteredRestock = restock.filter((product) => matchesProduct(product, productSearch, categoryFilter));
  const filteredProducts = products.filter((product) => matchesProduct(product, productSearch, categoryFilter));

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
        <div>
          <p className="editorial-label mb-2">Analytics</p>
          <h1 className="app-page-title mb-2">Reports</h1>
          <p className="text-sm text-ink-muted max-w-2xl">
            {isBranchManager && branch ? `${branch.name} · ` : ''}
            Track fulfilment, familiar catalogue lines, and what is due to come around again.
          </p>
        </div>
      </div>

      <FacilityFilterBar>
        <FilterDateRange
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => { setFromDate(from); setToDate(to); }}
        />
        {showBranchFilter && (
          <FacilityMultiSelect
            value={branchFilter}
            onChange={setBranchFilter}
            options={(authBranches || []).map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            searchPlaceholder="Search branch…"
          />
        )}
        <FacilityResetFilters
          disabled={fromDate === defaultFrom() && toDate === defaultTo() && branchFilter.length === 0}
          onReset={() => {
            setFromDate(defaultFrom());
            setToDate(defaultTo());
            setBranchFilter([]);
          }}
        />
      </FacilityFilterBar>

      {loading ? (
        <p className="text-ink-muted text-sm">Loading reports…</p>
      ) : !reports ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">Could not load reports.</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <Metric label="Quotes" value={summary.quotes} hint="Opened in this period" to="/dashboard/quotes" />
            <Metric label="Ready for you" value={summary.quotesReady} hint="Priced quotes you can convert" to="/dashboard/quotes" />
            <Metric label="Orders placed" value={summary.orders} hint={summary.avgDaysBetweenOrders ? `Typical gap ${summary.avgDaysBetweenOrders} days` : 'Shipments requested'} to="/dashboard/orders" />
            <Metric label="Items received" value={summary.itemsReceived} hint="Units delivered" />
            <Metric label="On the way" value={summary.onTheWay} hint={summary.itemsOnTheWay ? `${summary.itemsOnTheWay} units in transit` : 'Dispatch and delivery'} />
            <Metric label="Fulfilment" value={summary.fulfilmentRate == null ? '—' : `${summary.fulfilmentRate}%`} hint="Delivered of active orders" />
            <Metric label="Regular lines" value={summary.repeatLines} hint={`${summary.catalogueLines || 0} catalogue lines used`} />
            <Metric label="Due to restock" value={summary.dueToRestock} hint="Familiar lines coming around again" />
          </div>

          <SheetTabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === 'overview' && (
            <div className="mt-6 space-y-6">
              {restock.length > 0 && (
                <div className="editorial-panel overflow-hidden">
                  <div className="px-5 py-4 border-b border-ink/10">
                    <h2 className="font-semibold text-ink">Coming around again</h2>
                    <p className="text-xs text-ink-muted mt-1">
                      Based on how often you usually order these lines.
                    </p>
                  </div>
                  <div className="px-5 pt-4">
                    <ProductListFilters
                      search={productSearch}
                      onSearch={setProductSearch}
                      categories={categoryFilter}
                      onCategories={setCategoryFilter}
                      options={categoryOptions}
                    />
                  </div>
                  {filteredRestock.length === 0 ? (
                    <p className="text-sm text-ink-muted px-5 pb-8">No lines match these filters.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="w-full text-sm" style={{ minWidth: '720px' }}>
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                            <th className="px-5 py-3">Product</th>
                            <th className="px-5 py-3">Category</th>
                            <th className="px-5 py-3 text-right">Qty</th>
                            <th className="px-5 py-3">Last ordered</th>
                            <th className="px-5 py-3">Cadence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRestock.map((product) => (
                            <tr key={productKey(product)} className="border-b border-ink/5">
                              <td className="px-5 py-3 font-medium text-ink">{product.productName}</td>
                              <td className="px-5 py-3 text-ink-muted">{categoryName(product)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{product.typicalQuantity}</td>
                              <td className="px-5 py-3 text-ink-muted whitespace-nowrap">
                                {formatDate(product.lastOrderedAt)}
                                {product.daysSinceLastOrder != null ? ` · ${product.daysSinceLastOrder}d` : ''}
                              </td>
                              <td className="px-5 py-3 text-ink-muted">
                                {product.typicalIntervalDays ? `Every ${product.typicalIntervalDays}d` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {summary.awaitingYou > 0 && (
                <div className="editorial-panel overflow-hidden">
                  <div className="px-5 py-4 border-b border-ink/10 flex justify-between items-center">
                    <div>
                      <h2 className="font-semibold text-ink">Waiting on you</h2>
                      <p className="text-xs text-ink-muted mt-1">Priced or revised quotes you can convert or reply to.</p>
                    </div>
                    <Link to="/dashboard/quotes" className="text-xs text-copper hover:underline">All quotes</Link>
                  </div>
                  <div className="table-scroll">
                    <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                          <th className="px-5 py-3">Quote</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Lines</th>
                          <th className="px-5 py-3">Opened</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reports.openActions || []).map((row) => (
                          <tr key={row.id} className="border-b border-ink/5">
                            <td className="px-5 py-3 font-medium">
                              <Link to={`/dashboard/quotes/${row.id}`} className="hover:text-copper hover:underline">
                                {row.number || row.id.slice(0, 8)}
                              </Link>
                            </td>
                            <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                            <td className="px-5 py-3 text-right tabular-nums">{row.itemCount}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatDate(row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-5 gap-6">
                <div className="editorial-panel overflow-hidden lg:col-span-3">
                  <div className="px-5 py-4 border-b border-ink/10">
                    <h2 className="font-semibold text-ink">Activity by month</h2>
                    <p className="text-xs text-ink-muted mt-1">Orders, quotes, and item quantities.</p>
                  </div>
                  <BarChart rows={monthly} />
                </div>
                <div className="editorial-panel overflow-hidden lg:col-span-2">
                  <div className="px-5 py-4 border-b border-ink/10">
                    <h2 className="font-semibold text-ink">Category mix</h2>
                    <p className="text-xs text-ink-muted mt-1">Units ordered, not value.</p>
                  </div>
                  {categories.length === 0 ? (
                    <p className="text-sm text-ink-muted px-5 py-8">No ordered lines in this period.</p>
                  ) : (
                    <div className="px-5 py-4 space-y-3">
                      {categories.map((row) => (
                        <div key={row.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-ink truncate pr-3">{row.name}</span>
                            <span className="text-ink-muted tabular-nums shrink-0">{row.quantity} · {row.lines} lines</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-ink/5 overflow-hidden">
                            <div className="h-full bg-copper" style={{ width: `${(row.quantity / catMax) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {products.length === 0 && restock.length === 0 && (
                <div className="editorial-panel p-12 text-center">
                  <p className="text-ink-muted mb-4">No orders in this period yet. Browse the catalogue to start the next quote.</p>
                  <Link to="/dashboard/products" className="btn-primary">Browse products</Link>
                </div>
              )}
            </div>
          )}

          {tab === 'catalogue' && (
            <div className="mt-6 editorial-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-ink/10">
                <h2 className="font-semibold text-ink">Every line ordered</h2>
                <p className="text-xs text-ink-muted mt-1">Quantity, cadence, and last delivery for lines used in this period.</p>
              </div>
              {products.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-ink-muted mb-4">No catalogue lines in this period.</p>
                  <Link to="/dashboard/products" className="btn-primary">Browse products</Link>
                </div>
              ) : (
                <>
                  <div className="px-5 pt-4">
                    <ProductListFilters
                      search={productSearch}
                      onSearch={setProductSearch}
                      categories={categoryFilter}
                      onCategories={setCategoryFilter}
                      options={categoryOptions}
                    />
                  </div>
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-ink-muted px-5 pb-8">No lines match these filters.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="w-full text-sm" style={{ minWidth: '800px' }}>
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                            <th className="px-5 py-3">Product</th>
                            <th className="px-5 py-3">Category</th>
                            <th className="px-5 py-3 text-right">Times</th>
                            <th className="px-5 py-3 text-right">Qty</th>
                            <th className="px-5 py-3 text-right">Received</th>
                            <th className="px-5 py-3">Last ordered</th>
                            <th className="px-5 py-3">Cadence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((product) => (
                            <tr key={productKey(product)} className="border-b border-ink/5">
                              <td className="px-5 py-3 font-medium text-ink">
                                {product.productName}
                                {product.dueToRestock && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wider text-copper">Due</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-ink-muted">{categoryName(product)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{product.orderCount}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{product.quantity}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{product.deliveredQuantity}</td>
                              <td className="px-5 py-3 text-ink-muted whitespace-nowrap">
                                {formatDate(product.lastOrderedAt)}
                                {product.daysSinceLastOrder != null ? ` · ${product.daysSinceLastOrder}d` : ''}
                              </td>
                              <td className="px-5 py-3 text-ink-muted">
                                {product.typicalIntervalDays ? `Every ${product.typicalIntervalDays}d` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div className="mt-6 grid lg:grid-cols-2 gap-6">
              <div className="editorial-panel overflow-hidden">
                <div className="px-5 py-4 border-b border-ink/10 flex justify-between items-center">
                  <h2 className="font-semibold text-ink">Recent orders</h2>
                  <Link to="/dashboard/orders" className="text-xs text-copper hover:underline">All orders</Link>
                </div>
                {(reports.recentOrders || []).length === 0 ? (
                  <p className="text-sm text-ink-muted px-5 py-8">No orders in this period.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="w-full text-sm" style={{ minWidth: '520px' }}>
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                          <th className="px-5 py-3">Order</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Items</th>
                          <th className="px-5 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reports.recentOrders || []).map((order) => (
                          <tr key={order.id} className="border-b border-ink/5">
                            <td className="px-5 py-3 font-medium">
                              <Link to={`/dashboard/orders/${order.id}`} className="hover:text-copper hover:underline">
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                            <td className="px-5 py-3 text-right tabular-nums">{order.itemCount}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatDate(order.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="editorial-panel overflow-hidden">
                <div className="px-5 py-4 border-b border-ink/10 flex justify-between items-center">
                  <h2 className="font-semibold text-ink">Quote history</h2>
                  <Link to="/dashboard/quotes" className="text-xs text-copper hover:underline">All quotes</Link>
                </div>
                {(reports.quoteHistory || []).length === 0 ? (
                  <p className="text-sm text-ink-muted px-5 py-8">No quotes in this period.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="w-full text-sm" style={{ minWidth: '520px' }}>
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                          <th className="px-5 py-3">Quote</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Lines</th>
                          <th className="px-5 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reports.quoteHistory || []).map((quote) => (
                          <tr key={quote.id} className="border-b border-ink/5">
                            <td className="px-5 py-3 font-medium">
                              <Link to={`/dashboard/quotes/${quote.id}`} className="hover:text-copper hover:underline">
                                {quote.quoteNumber || quote.id.slice(0, 8)}
                              </Link>
                            </td>
                            <td className="px-5 py-3"><StatusBadge status={quote.status} /></td>
                            <td className="px-5 py-3 text-right tabular-nums">{quote.itemCount}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatDate(quote.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'branches' && (
            <div className="mt-6 editorial-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-ink/10">
                <h2 className="font-semibold text-ink">Branch activity</h2>
                <p className="text-xs text-ink-muted mt-1">Quotes, orders, and units in this period.</p>
              </div>
              <div className="table-scroll">
                <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                      <th className="px-5 py-3">Branch</th>
                      <th className="px-5 py-3 text-right">Quotes</th>
                      <th className="px-5 py-3 text-right">Orders</th>
                      <th className="px-5 py-3 text-right">Items</th>
                      <th className="px-5 py-3 text-right">Delivered</th>
                      <th className="px-5 py-3 text-right">On the way</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.branches || []).map((row) => (
                      <tr key={row.branchId} className="border-b border-ink/5">
                        <td className="px-5 py-3 font-medium">
                          {row.branchName}
                          {row.isMain && <span className="ml-2 text-[10px] text-copper">MAIN</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.quotes}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.orders}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.items}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.delivered}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.onTheWay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
