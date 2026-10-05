import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Download, Loader2, Send, Truck } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { getAdminToken } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { formatPrice, lineTotal } from '../../utils/pricing';
import { DocumentTotals } from '../../components/facility/DocumentTotals';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { SheetTabs } from '../../components/ui/SheetTabs';
import { invoiceDisplayStatus as displayStatus } from '../../utils/invoiceStatus';
import { useConfirm } from '../../components/ConfirmProvider';

const TABS = ['Overview', 'Line items', 'Documents'];

export const AdminInvoiceWorkspace = () => {
  const { invoiceId } = useParams();
  const confirm = useConfirm();
  const [invoice, setInvoice] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const headers = getAdminHeader();

  const load = async () => {
    const res = await axios.get(`${API_URL}/api/admin/invoices/${invoiceId}`, { headers });
    setInvoice(res.data);
  };

  useEffect(() => {
    load().catch(() => toast.error('Invoice not found')).finally(() => setLoading(false));
  }, [invoiceId]);

  useLiveUpdates({
    token: getAdminToken(),
    invoiceId,
    types: ['invoice.updated', 'order.updated', 'message.created'],
    onEvent: () => load().catch(() => {}),
  });

  const downloadBlob = async (url, filename) => {
    const res = await axios.get(url, { headers, responseType: 'blob' });
    const contentType = res.headers['content-type'] || '';
    if (contentType.includes('application/json') || (res.data && res.data.type === 'application/json')) {
      throw new Error('Download failed');
    }
    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  const downloadPdf = async () => {
    try {
      await downloadBlob(
        `${API_URL}/api/admin/invoices/${invoice.id}/download`,
        `Invoice_${invoice.invoice_number}.pdf`,
      );
    } catch {
      toast.error('Failed to download invoice PDF');
    }
  };

  const downloadDeliveryNote = async () => {
    try {
      await downloadBlob(
        `${API_URL}/api/admin/invoices/${invoice.id}/delivery-note`,
        `DeliveryNote_${invoice.invoice_number}.pdf`,
      );
    } catch {
      toast.error('Failed to download delivery note');
    }
  };

  const resendInvoice = async () => {
    setActing(true);
    try {
      await axios.post(`${API_URL}/api/admin/invoices/${invoice.id}/resend`, {}, { headers });
      toast.success('Invoice email sent');
    } catch {
      toast.error('Failed to send invoice');
    } finally {
      setActing(false);
    }
  };

  const markPaid = async () => {
    const approved = await confirm({
      label: 'Record payment',
      title: 'Mark this invoice as paid?',
      description: 'The balance will be cleared and the invoice will show as paid. Use this after you have received the payment.',
      confirmLabel: 'Mark as paid',
    });
    if (!approved) return;
    setActing(true);
    try {
      await axios.put(`${API_URL}/api/admin/invoices/${invoice.id}/mark-paid`, { payment_method: 'manual' }, { headers });
      toast.success('Invoice marked as paid');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark as paid');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminLoadingState />;
  if (!invoice) return <AdminEmptyState>Invoice not found.</AdminEmptyState>;

  const items = invoice.items || [];
  const status = displayStatus(invoice);
  const isPaid = status === 'paid';

  return (
    <div className="w-full space-y-6 pb-24">
      <Link to="/sysadmin/invoices" className="inline-flex items-center gap-2 text-sm text-brand hover:text-copper hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to invoices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="editorial-label mb-1">Invoice workspace</p>
          <h1 className="app-page-title">{invoice.invoice_number}</h1>
          <p className="text-sm text-ink-muted mt-2">{invoice.facility_name}</p>
          <p className="text-sm text-ink-faint">
            {invoice.contact_person} · {invoice.email}
            {invoice.created_at ? ` · Issued ${new Date(invoice.created_at).toLocaleString()}` : ''}
          </p>
        </div>
        <OpsStatusBadge status={status} />
      </div>

      {!isPaid && status === 'overdue' && (
        <div className="editorial-panel border-amber-200/60 bg-amber-50/50 p-5">
          <p className="font-semibold text-amber-900">Payment overdue</p>
          <p className="text-sm text-amber-800 mt-1">
            Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'} · {formatPrice(invoice.total)} outstanding
          </p>
        </div>
      )}

      {invoice.quote_id && (
        <p className="text-sm text-ink-muted">
          Source quote:{' '}
          <Link to={`/sysadmin/quotes/${invoice.quote_id}`} className="text-brand font-medium hover:text-copper hover:underline">
            Open quote workspace
          </Link>
        </p>
      )}

      <SheetTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="editorial-panel p-5 space-y-3">
            <h2 className="font-semibold text-ink">Billing details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm break-words">
              <dt className="text-ink-muted">Contact</dt>
              <dd>{invoice.contact_person}</dd>
              <dt className="text-ink-muted">Phone</dt>
              <dd>{invoice.phone || '—'}</dd>
              <dt className="text-ink-muted">Email</dt>
              <dd className="truncate">{invoice.email}</dd>
              <dt className="text-ink-muted">Address</dt>
              <dd>{invoice.address || '—'}</dd>
              <dt className="text-ink-muted">Payment terms</dt>
              <dd>{invoice.payment_terms || 'Net 30'}</dd>
              <dt className="text-ink-muted">Due date</dt>
              <dd>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}</dd>
              {isPaid && invoice.paid_at && (
                <>
                  <dt className="text-ink-muted">Paid on</dt>
                  <dd>{new Date(invoice.paid_at).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </section>
          <section className="editorial-panel p-5 space-y-3">
            <h2 className="font-semibold text-ink">Totals</h2>
            <DocumentTotals document={invoice} />
          </section>
        </div>
      )}

      {tab === 'Line items' && (
        <div className="editorial-panel overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '720px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10 bg-cream/50">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">List</th>
                <th className="px-5 py-3">Agreed</th>
                <th className="px-5 py-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{it.product_name}</p>
                    {it.category && <p className="text-xs text-ink-muted">{it.category}</p>}
                  </td>
                  <td className="px-5 py-3.5">{it.quantity}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{formatPrice(it.original_price || it.list_price)}</td>
                  <td className="px-5 py-3.5">{formatPrice(it.modified_price || it.unit_price)}</td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {formatPrice(lineTotal(it.modified_price || it.unit_price, it.quantity))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-5 py-4 border-t border-ink/10">
            <DocumentTotals document={invoice} className="max-w-sm ml-auto" />
          </div>
        </div>
      )}

      {tab === 'Documents' && (
        <section className="editorial-panel p-5">
          <h2 className="font-semibold text-ink mb-4">Documents & actions</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={downloadPdf} className="btn-secondary inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button type="button" onClick={downloadDeliveryNote} className="btn-secondary inline-flex items-center gap-2">
              <Truck className="w-4 h-4" /> Delivery note
            </button>
            <button type="button" onClick={resendInvoice} disabled={acting} className="btn-secondary inline-flex items-center gap-2">
              <Send className="w-4 h-4" /> Email to customer
            </button>
            {!isPaid && (
              <button type="button" onClick={markPaid} disabled={acting} className="btn-primary inline-flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Mark paid
              </button>
            )}
          </div>
        </section>
      )}

      <QuoteMessagesPopup
        quoteId={invoice.quote_id}
        headers={headers}
        unreadCount={invoice.unread_customer_messages || invoice.unread_messages || 0}
        token={getAdminToken()}
        adminMode
        facilityName={invoice.facility_name || ''}
        branchName={invoice.branch_name || ''}
        counterpartName={invoice.contact_person || ''}
        onRead={() => load().catch(() => {})}
      />
    </div>
  );
};

const AdminLoadingState = () => (
  <div className="py-16 flex justify-center w-full">
    <Loader2 className="w-6 h-6 animate-spin text-copper" />
  </div>
);

const AdminEmptyState = ({ children }) => (
  <div className="editorial-panel p-12 text-center text-ink-muted w-full">{children}</div>
);
