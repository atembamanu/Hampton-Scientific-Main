import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight, Loader2, FileText, ShoppingCart, Truck, Receipt,
  MessageSquare, Clock,
} from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminUser, getAdminToken, hasCompanyPermission } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { INVOICE_AWAITING_PAYMENT, OPEN_INVOICE_STATUSES } from '../../utils/invoiceStatus';

const ACTIVE_ORDERS = 'order_placed,processing,dispatched,out_for_delivery';
const FULFILMENT_ORDERS = 'order_placed,processing';
const DELIVERY_ORDERS = 'dispatched,out_for_delivery';

const STAT_CARDS = [
  { key: 'new_quote_requests', label: 'New quote requests', to: '/sysadmin/quote-requests?ops_status=submitted', icon: FileText },
  { key: 'quotes_awaiting_customer', label: 'Awaiting customer', to: '/sysadmin/quotes?ops_status=awaiting_customer', icon: Clock },
  { key: 'accepted_awaiting_order', label: 'Accepted, no order', to: '/sysadmin/quotes?ops_status=accepted', icon: FileText },
  { key: 'active_orders', label: 'Active orders', to: `/sysadmin/orders?status=${ACTIVE_ORDERS}`, icon: ShoppingCart },
  { key: 'orders_requiring_fulfilment', label: 'Needs fulfilment', to: `/sysadmin/orders?status=${FULFILMENT_ORDERS}`, icon: ShoppingCart },
  { key: 'deliveries_in_progress', label: 'Deliveries in progress', to: `/sysadmin/orders?status=${DELIVERY_ORDERS}`, icon: Truck },
  { key: 'outstanding_invoices', label: 'Outstanding invoices', to: `/sysadmin/invoices?status=${OPEN_INVOICE_STATUSES.join(',')}`, icon: Receipt },
  { key: 'awaiting_payment_invoices', label: 'Awaiting payment', to: `/sysadmin/invoices?status=${INVOICE_AWAITING_PAYMENT}`, icon: Receipt },
];

const ACTION_ITEMS = [
  { key: 'new_quote_requests', label: 'New quote requests', to: '/sysadmin/quote-requests?ops_status=submitted' },
  { key: 'unread_customer_messages', label: 'Customer messages awaiting response', to: '/sysadmin/messages?unread=1' },
  { key: 'accepted_awaiting_order', label: 'Accepted quotes awaiting order creation', to: '/sysadmin/quotes?ops_status=accepted' },
  { key: 'orders_requiring_fulfilment', label: 'Orders awaiting fulfilment', to: `/sysadmin/orders?status=${FULFILMENT_ORDERS}` },
  { key: 'overdue_invoices', label: 'Invoices overdue', to: '/sysadmin/invoices?status=overdue' },
];

const WAITING_ITEMS = [
  { key: 'quotes_awaiting_customer', label: 'Quotes awaiting customer response', to: '/sysadmin/quotes?ops_status=awaiting_customer' },
  { key: 'awaiting_information', label: 'Questions awaiting customer clarification', to: '/sysadmin/quotes?ops_status=awaiting_information' },
  { key: 'deliveries_in_progress', label: 'Delivery confirmations in progress', to: `/sysadmin/orders?status=${DELIVERY_ORDERS}` },
];

const INVOICE_KEYS = new Set(['outstanding_invoices', 'awaiting_payment_invoices', 'overdue_invoices']);
const OPS_ONLY_KEYS = new Set(['orders_requiring_fulfilment', 'deliveries_in_progress']);

const StatCard = ({ icon: Icon, label, value, to }) => (
  <Link to={to} className="editorial-panel p-5 hover:border-copper/30 transition-colors block group">
    <Icon className="w-5 h-5 text-copper mb-3" />
    <p className="text-2xl font-bold text-ink">{value ?? 0}</p>
    <p className="text-xs text-ink-muted mt-1">{label}</p>
    <p className="text-[11px] text-copper font-medium mt-3 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      Open <ArrowRight className="w-3 h-3" />
    </p>
  </Link>
);

const QueuePanel = ({ title, accent, items, stats }) => (
  <section className="editorial-panel overflow-hidden">
    <div className="px-5 py-4 border-b border-ink/10">
      <h2 className={`text-sm font-semibold uppercase tracking-wider ${accent}`}>{title}</h2>
    </div>
    <ul className="divide-y divide-ink/5">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            to={item.to}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-ink/[0.02] transition-colors group"
          >
            <span className="text-sm text-ink flex items-center gap-3">
              <span className="inline-flex min-w-[2rem] justify-center font-bold text-ink tabular-nums">
                {stats[item.key] ?? 0}
              </span>
              <span className="text-ink-muted group-hover:text-ink transition-colors">{item.label}</span>
            </span>
            <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-copper transition-colors" />
          </Link>
        </li>
      ))}
    </ul>
  </section>
);

export const OpsDashboard = () => {
  const adminUser = getAdminUser();
  const canSeeInvoices = hasCompanyPermission(adminUser, 'invoices');
  const isSales = adminUser?.role === 'sales';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => axios.get(`${API_URL}/api/admin/ops-stats`, { headers: getAdminHeader() })
    .then((res) => setStats(res.data))
    .catch(() => setStats({}));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useLiveUpdates({
    token: getAdminToken(),
    types: ['quote.updated', 'quote.priced', 'order.updated', 'invoice.updated', 'message.created', 'delivery.updated'],
    onEvent: () => load(),
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-ink/5 rounded w-56" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 bg-ink/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {};
  const visibleForSales = (item) => !INVOICE_KEYS.has(item.key) && !OPS_ONLY_KEYS.has(item.key);
  const statCards = STAT_CARDS.filter((card) => (canSeeInvoices || !INVOICE_KEYS.has(card.key)) && (!isSales || visibleForSales(card)));
  const actionItems = ACTION_ITEMS.filter((item) => (canSeeInvoices || !INVOICE_KEYS.has(item.key)) && (!isSales || visibleForSales(item)));
  const waitingItems = WAITING_ITEMS.filter((item) => !isSales || visibleForSales(item));
  const actionTotal = actionItems.reduce((sum, item) => sum + (s[item.key] ?? 0), 0);
  const waitingTotal = waitingItems.reduce((sum, item) => sum + (s[item.key] ?? 0), 0);

  return (
    <div>
      <p className="editorial-label mb-2">
        Welcome back{adminUser?.firstName ? `, ${adminUser.firstName}` : ''}
      </p>
      <h1 className="app-page-title mb-2">
        {isSales ? 'Sales' : 'Operations'} <span className="text-copper">dashboard</span>
      </h1>
      <p className="text-sm text-ink-muted mb-8 max-w-2xl">
        {isSales
          ? 'Your quotes, orders, and customer messages — scoped to work assigned to you.'
          : 'What needs your attention right now — and what is waiting on the customer.'}
      </p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={s[card.key]}
            to={card.to}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <QueuePanel
          title={`Action required · ${actionTotal}`}
          accent="text-copper"
          items={actionItems}
          stats={s}
        />
        <QueuePanel
          title={`Awaiting customer · ${waitingTotal}`}
          accent="text-ink"
          items={waitingItems}
          stats={s}
        />
      </div>
    </div>
  );
};
