import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminToken, getAdminUser, canAssignSales, hasCompanyPermission } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { formatPrice, lineTotal, documentTax, documentNet } from '../../utils/pricing';
import { DocumentTotals } from '../../components/facility/DocumentTotals';
import {
  DeliveryDetailsForm,
  snapshotToDeliveryForm,
  deliveryFormToSnapshot,
} from '../../components/admin/DeliveryDetailsForm';
import { SheetTabs } from '../../components/ui/SheetTabs';
import { useConfirm } from '../../components/ConfirmProvider';
import { SalesAssignSelect } from '../../components/admin/SalesAssignSelect';

const ORDER_STATUSES = ['order_placed', 'processing', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'];

export const AdminOrderWorkspace = () => {
  const { orderId } = useParams();
  const confirm = useConfirm();
  const staffUser = getAdminUser();
  const canInvoice = hasCompanyPermission(staffUser, 'invoices');
  const canAssign = canAssignSales(staffUser);
  const tabs = canInvoice ? ['Overview', 'Items', 'Invoice', 'Activity'] : ['Overview', 'Items', 'Activity'];
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [agents, setAgents] = useState([]);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(snapshotToDeliveryForm());

  const headers = getAdminHeader();

  const load = async ({ hydrateDelivery = false } = {}) => {
    const [oRes, tRes] = await Promise.all([
      axios.get(`${API_URL}/api/admin/ops/orders/${orderId}`, { headers }),
      axios.get(`${API_URL}/api/admin/ops/orders/${orderId}/timeline`, { headers }).catch(() => ({ data: [] })),
    ]);
    setOrder(oRes.data);
    setTimeline(tRes.data || []);
    if (hydrateDelivery) {
      setDeliveryForm(snapshotToDeliveryForm(oRes.data.deliverySnapshot || {}));
    }
  };

  useEffect(() => {
    load({ hydrateDelivery: true }).catch(() => toast.error('Order not found')).finally(() => setLoading(false));
    if (canAssign) {
      axios.get(`${API_URL}/api/admin/field/agents`, { headers })
        .then((res) => setAgents(res.data?.agents || []))
        .catch(() => {});
    }
  }, [orderId]);

  useLiveUpdates({
    token: getAdminToken(),
    orderId,
    types: ['order.updated', 'delivery.updated', 'invoice.updated', 'message.created'],
    onEvent: (event) => {
      if (event?.type === 'poll') return;
      load().catch(() => {});
    },
  });

  const patchOrder = async (payload) => {
    if (order?.invoiceId && order.invoiceStatus && order.invoiceStatus !== 'none') {
      toast.error('Invoiced orders cannot be edited');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.patch(`${API_URL}/api/admin/ops/orders/${orderId}`, payload, { headers });
      setOrder(res.data);
      toast.success('Order updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const saveDelivery = async () => {
    if (order?.invoiceId && order.invoiceStatus && order.invoiceStatus !== 'none') {
      toast.error('Invoiced orders cannot be edited');
      return;
    }
    setSavingDelivery(true);
    try {
      const snap = order.deliverySnapshot || {};
      const res = await axios.patch(
        `${API_URL}/api/admin/ops/orders/${orderId}`,
        {
          deliverySnapshot: deliveryFormToSnapshot(deliveryForm, snap),
          delivery_snapshot: deliveryFormToSnapshot(deliveryForm, snap),
        },
        { headers },
      );
      setOrder(res.data);
      setDeliveryForm(snapshotToDeliveryForm(res.data.deliverySnapshot || {}));
      toast.success('Delivery details saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save delivery details');
    } finally {
      setSavingDelivery(false);
    }
  };

  const assignSales = async (agentId) => {
    setAssigning(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/ops/orders/${orderId}/assign`,
        { assigned_sales_user_id: agentId },
        { headers },
      );
      setOrder(res.data);
      toast.success(agentId ? 'Sales agent assigned' : 'Sales agent unassigned');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not assign sales agent');
    } finally {
      setAssigning(false);
    }
  };

  const createInvoice = async () => {
    if (!order.quoteId) {
      toast.error('This order has no source quote to invoice from');
      return;
    }
    const approved = await confirm({
      label: 'Create invoice',
      title: 'Create an invoice for this order?',
      description: 'The invoice will use the agreed order prices and quantities. You can send it to the customer after it is created.',
      confirmLabel: 'Create invoice',
    });
    if (!approved) return;
    setInvoicing(true);
    try {
      await axios.post(`${API_URL}/api/admin/invoices`, { quote_id: order.quoteId }, { headers });
      toast.success('Invoice created from agreed prices');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not create invoice');
    } finally {
      setInvoicing(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#006332]" /></div>;
  if (!order) return <p className="p-6">Order not found.</p>;

  const invoiced = Boolean(order.invoiceId) && order.invoiceStatus && order.invoiceStatus !== 'none';
  const locked = invoiced;

  return (
    <div className="min-w-0 space-y-6 pb-24 lg:p-6">
      <Link to="/sysadmin/orders" className="inline-flex items-center gap-2 text-sm text-[#006332] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500">Order workspace</p>
        <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
        <p className="text-sm text-gray-600">{order.organizationName} · {order.orderedForBranchName}</p>
        {order.quoteId && (
          <p className="text-sm mt-1">
            Source quote:{' '}
            <Link to={`/sysadmin/quotes/${order.quoteId}`} className="text-[#006332] font-semibold hover:underline">{order.quoteNumber}</Link>
          </p>
        )}
        {locked && (
          <p className="text-sm text-ink-muted mt-2">This order has been invoiced and is read-only.</p>
        )}
      </div>

      <SheetTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-1">Ordered by</p>
              <p className="font-medium">{order.orderedByName}</p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-1">Order status</p>
              <select
                value={order.status}
                disabled={saving || locked}
                onChange={(e) => patchOrder({ status: e.target.value })}
                className="mt-1 h-9 border rounded-lg px-2 text-sm w-full disabled:bg-gray-50"
              >
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-1">Total</p>
              <p className="text-xl font-bold text-[#006332]">{formatPrice(order.total ?? order.subtotal)}</p>
              <p className="text-xs text-gray-500 mt-2">Tax {formatPrice(documentTax(order))} · Net {formatPrice(documentNet(order))}</p>
            </div>
            <SalesAssignSelect
              agents={agents}
              value={order.assigned_sales_user_id}
              name={order.assigned_sales_name}
              canAssign={canAssign}
              disabled={assigning}
              onChange={assignSales}
              className="bg-white border rounded-xl p-5"
            />
          </div>
          <div className="bg-white border rounded-xl p-5">
            <DeliveryDetailsForm
              value={deliveryForm}
              onChange={setDeliveryForm}
              onSave={saveDelivery}
              saving={savingDelivery}
              readOnly={locked}
            />
          </div>
        </div>
      )}

      {tab === 'Items' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '720px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-400 border-b bg-gray-50">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">List price</th>
                <th className="px-4 py-2 text-right">Agreed price</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((it) => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{it.product_name}</td>
                  <td className="px-4 py-3 text-right">{it.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatPrice(it.list_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#006332]">{formatPrice(it.agreed_unit_price)}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(lineTotal(it.agreed_unit_price, it.quantity))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-4 border-t">
            <DocumentTotals document={order} className="max-w-sm ml-auto" />
          </div>
        </div>
      )}

      {tab === 'Invoice' && canInvoice && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          {order.invoiceId ? (
            <p>
              Invoice <Link to={`/sysadmin/invoices/${order.invoiceId}`} className="text-[#006332] font-semibold hover:underline">{order.invoiceNumber}</Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500">No invoice yet. The invoice will use this order’s agreed prices, not current list prices.</p>
              <button type="button" onClick={createInvoice} disabled={invoicing} className="h-9 px-4 rounded-lg bg-[#006332] text-white text-sm">
                {invoicing && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                Create invoice from order
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'Activity' && (
        <section className="bg-white border rounded-xl p-5">
          <ol className="space-y-3">
            {timeline.length === 0 && <p className="text-sm text-gray-500">No recorded activity yet.</p>}
            {timeline.map((ev, i) => (
              <li key={ev.id || i} className="text-sm">
                <p className="text-[11px] text-gray-400">{ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</p>
                <p className="text-gray-800">{ev.summary}</p>
                {ev.field_name && ev.previous_value && (
                  <p className="text-xs text-gray-500">{ev.field_name}: {ev.previous_value} → {ev.new_value}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <QuoteMessagesPopup
        quoteId={order.quoteId}
        headers={headers}
        unreadCount={order.unread_customer_messages || order.unread_messages || 0}
        token={getAdminToken()}
        adminMode
        facilityName={order.organizationName || ''}
        branchName={order.orderedForBranchName || ''}
        counterpartName={order.orderedByName || ''}
        onRead={() => load().catch(() => {})}
      />
    </div>
  );
};
