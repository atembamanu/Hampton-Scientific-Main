import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useQuote } from '../../context/QuoteContext';
import { useConfirm } from '../../components/ConfirmProvider';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { formatPrice, lineTotal } from '../../utils/pricing';
import { DocumentTotals } from '../../components/facility/DocumentTotals';
import { formatDateTime } from '../../lib/utils';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { startOrderAgain } from '../../utils/orderAgain';

export const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader, token } = useAuth();
  const { hasItems, loadReorderQuote } = useQuote();
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => axios.get(`${API_URL}/api/orders/${orderId}`, { headers: getAuthHeader() })
    .then((res) => setOrder(res.data));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [orderId, getAuthHeader]);

  useLiveUpdates({
    token,
    orderId,
    types: ['order.updated', 'delivery.updated', 'invoice.updated', 'message.created'],
    onEvent: () => load().catch(() => {}),
  });

  if (loading) return <p className="text-ink-muted text-sm">Loading…</p>;
  if (!order) return <p className="text-ink-muted">Order not found.</p>;

  const snap = order.deliverySnapshot || {};
  const riderName = snap.rider_name;
  const riderNo = snap.rider_no || snap.rider_phone;
  const receiverName = snap.contact_name || snap.receiver_name;
  const receiverPhone = snap.phone || snap.receiver_phone;

  return (
    <div className="pb-24">
      <Link to="/dashboard/orders" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="editorial-label mb-2">Order</p>
          <h1 className="app-page-title">{order.orderNumber}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <RowActionsMenu
            items={[
              { label: 'View quote', to: order.quoteId ? `/dashboard/quotes/${order.quoteId}` : undefined, disabled: !order.quoteId },
              {
                label: 'Order again',
                onSelect: () => startOrderAgain({
                  order,
                  getAuthHeader,
                  hasItems,
                  confirm,
                  loadReorderQuote,
                  navigate,
                }),
              },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Order Date</p>
          <p className="font-medium text-ink">{formatDateTime(order.orderedAt || order.createdAt)}</p>
        </div>
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Dispatched Date</p>
          <p className="font-medium text-ink">{formatDateTime(order.dispatchedAt)}</p>
        </div>
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Delivered Date</p>
          <p className="font-medium text-ink">{formatDateTime(order.deliveredAt)}</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 ${(riderName || riderNo) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Ordered by</p>
          <p className="font-medium text-ink">{order.orderedByName}</p>
          {order.orderedByJobTitle && <p className="text-sm text-ink-muted">{order.orderedByJobTitle}</p>}
        </div>
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Ordered for</p>
          <p className="font-medium text-ink">{order.orderedForBranchName}</p>
        </div>
        <div className="editorial-panel p-5">
          <p className="editorial-label mb-2">Deliver to</p>
          <p className="font-medium text-ink">{order.deliveryLabel || snap.label || snap.location || '—'}</p>
          {(snap.address_line || snap.addressLine) && (
            <p className="text-sm text-ink-muted mt-1">{snap.address_line || snap.addressLine}</p>
          )}
          {receiverName && <p className="text-sm text-ink-muted mt-1">{receiverName}</p>}
          {receiverPhone && <p className="text-sm text-ink-muted">{receiverPhone}</p>}
        </div>
        {(riderName || riderNo) && (
          <div className="editorial-panel p-5">
            <p className="editorial-label mb-2">Delivery rider</p>
            {riderName && <p className="font-medium text-ink">{riderName}</p>}
            {riderNo && <p className="text-sm text-ink-muted mt-1">{riderNo}</p>}
          </div>
        )}
      </div>

      <div className="editorial-panel overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-ink/10 font-semibold text-ink">Line items</div>
        <div className="table-scroll">
        <table className="w-full text-sm" style={{ minWidth: '720px' }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3 text-right">Qty</th>
              <th className="px-5 py-3 text-right">List Price</th>
              <th className="px-5 py-3 text-right text-copper">Agreed Price</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => {
              const agreed = item.agreed_unit_price ?? item.unit_price ?? 0;
              const list = item.list_price ?? 0;
              return (
                <tr key={item.id} className="border-b border-ink/5">
                  <td className="px-5 py-3">
                    <p className="font-medium">{item.product_name}</p>
                    {item.notes && <p className="text-xs text-ink-muted mt-0.5">{item.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-right">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-ink-muted">{list > 0 ? formatPrice(list) : '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-copper">{formatPrice(agreed)}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatPrice(lineTotal(agreed, item.quantity))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-5 py-4">
                <DocumentTotals document={order} className="max-w-sm ml-auto" />
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      <QuoteMessagesPopup
        quoteId={order.quoteId}
        headers={getAuthHeader()}
        unreadCount={order.unread_admin_messages || order.unread_messages || 0}
        token={token}
        onRead={() => load().catch(() => {})}
      />
    </div>
  );
};
