import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { invoiceDisplayStatus } from '../../utils/invoiceStatus';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { formatPrice, lineTotal } from '../../utils/pricing';
import { DocumentTotals } from '../../components/facility/DocumentTotals';
import { formatDateTime } from '../../lib/utils';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';

export const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const { getAuthHeader, token } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => axios.get(`${API_URL}/api/invoices/${invoiceId}`, { headers: getAuthHeader() })
    .then((res) => setInvoice(res.data));

  useEffect(() => {
    load()
      .catch(() => toast.error('Could not load invoice'))
      .finally(() => setLoading(false));
  }, [invoiceId, getAuthHeader]);

  useLiveUpdates({
    token,
    invoiceId,
    types: ['invoice.updated', 'message.created'],
    onEvent: () => load().catch(() => {}),
  });

  const download = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/invoices/${invoiceId}/download`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const header = await blob.slice(0, 5).text();
      if (header !== '%PDF-') throw new Error('Download failed');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  if (loading) return <p className="text-ink-muted text-sm">Loading…</p>;
  if (!invoice) return <p className="text-ink-muted">Invoice not found.</p>;

  return (
    <div className="pb-24">
      <Link to="/dashboard/invoices" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to invoices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="editorial-label mb-2">Invoice</p>
          <h1 className="app-page-title">{invoice.invoice_number}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={download}
            className="h-9 px-3 rounded-xl border border-ink/15 text-sm font-medium text-ink hover:bg-ink/5 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <StatusBadge status={invoiceDisplayStatus(invoice)} />
        </div>
      </div>

      <div className="editorial-panel p-4 sm:p-6 mb-6 text-sm space-y-1">
        <p><span className="text-ink-muted">Issued:</span> {formatDateTime(invoice.created_at)}</p>
        {invoice.facility_name && (
          <p><span className="text-ink-muted">Facility:</span> <span className="font-medium">{invoice.facility_name}</span></p>
        )}
        {invoice.branch_name && (
          <p><span className="text-ink-muted">Branch:</span> <span className="font-medium">{invoice.branch_name}</span></p>
        )}
        {invoice.due_date && (
          <p><span className="text-ink-muted">Due:</span> {new Date(invoice.due_date).toLocaleDateString()}</p>
        )}
        {invoice.order_id && (
          <p>
            <span className="text-ink-muted">Order:</span>{' '}
            <Link to={`/dashboard/orders/${invoice.order_id}`} className="text-copper hover:underline">
              {invoice.order_number || 'View order'}
            </Link>
          </p>
        )}
        {invoice.quote_id && (
          <p>
            <span className="text-ink-muted">Quote:</span>{' '}
            <Link to={`/dashboard/quotes/${invoice.quote_id}`} className="text-copper hover:underline">
              {invoice.quote_number || 'View quote'}
            </Link>
          </p>
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
            {(invoice.items || []).map((item) => {
              const agreed = item.unit_price ?? item.modified_price ?? 0;
              const list = item.list_price ?? item.original_price ?? 0;
              return (
                <tr key={item.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">{item.product_name}</td>
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
                <DocumentTotals document={invoice} className="max-w-sm ml-auto" />
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      <QuoteMessagesPopup
        quoteId={invoice.quote_id}
        headers={getAuthHeader()}
        unreadCount={invoice.unread_admin_messages || invoice.unread_messages || 0}
        token={token}
        onRead={() => load().catch(() => {})}
      />
    </div>
  );
};
