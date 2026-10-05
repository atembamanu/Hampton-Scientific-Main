import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useQuote } from '../../context/QuoteContext';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { QuotePricingSummary, QuoteLineSavings } from '../../components/facility/QuotePricingSummary';
import { QuoteNotesPanel } from '../../components/facility/QuoteNotesPanel';
import {
  formatPrice,
  hasQuotedPrices,
  itemListPrice,
  itemQuotedPrice,
  itemQuantity,
  lineTotal,
} from '../../utils/pricing';
import { formatDateTime } from '../../lib/utils';
import { useConfirm } from '../../components/ConfirmProvider';

export const QuoteDetail = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { getAuthHeader, branches, token, primaryBranchId } = useAuth();
  const { hasItems, loadReorderQuote } = useQuote();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const loadQuote = () => axios
    .get(`${API_URL}/api/quotes/${quoteId}`, { headers: getAuthHeader() })
    .then((res) => setQuote(res.data));

  useEffect(() => {
    loadQuote()
      .catch(() => toast.error('Could not load quote'))
      .finally(() => setLoading(false));
  }, [quoteId, getAuthHeader]);

  useLiveUpdates({
    token,
    quoteId,
    types: ['quote.updated', 'quote.priced', 'message.created', 'delivery.updated', 'order.updated'],
    onEvent: () => loadQuote().catch(() => {}),
  });

  const branchName = branches.find((b) => b.id === quote?.ordered_for_branch_id)?.name
    || branches.find((b) => b.id === primaryBranchId)?.name;
  const isQuoted = quote && hasQuotedPrices(quote.items);
  const isDraft = quote?.status === 'draft';
  const canAccept =
    quote?.status === 'quoted'
    && quote?.current_handler === 'CUSTOMER_REVIEW'
    && quote?.customer_response !== 'accepted'
    && isQuoted;

  const canRespond = canAccept && quote?.customer_response !== 'rejected';

  const continueDraft = async () => {
    if (hasItems) {
      const approved = await confirm({
        label: 'Continue quote',
        title: 'Replace the quote in progress?',
        description: 'Opening this draft will replace the items currently in your basket.',
        confirmLabel: 'Continue draft',
      });
      if (!approved) return;
    }
    const loaded = loadReorderQuote(quote);
    if (loaded) navigate('/dashboard/quote', { state: { fromReorder: true } });
  };

  const handleAccept = async () => {
    const approved = await confirm({
      label: 'Accept quote',
      title: 'Accept this quotation?',
      description: 'An order will be created at the quoted prices. You can track it under Orders.',
      confirmLabel: 'Accept and create order',
    });
    if (!approved) return;
    setAccepting(true);
    try {
      await axios.put(
        `${API_URL}/api/quotes/${quoteId}/respond`,
        { response: 'accepted' },
        { headers: getAuthHeader() },
      );
      toast.success('Quote accepted. Your order has been created.');
      navigate('/dashboard/orders');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept quote');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error('Please tell us why you are rejecting the quotation');
      return;
    }
    setRejecting(true);
    try {
      await axios.post(
        `${API_URL}/api/quotes/${quoteId}/reject`,
        { reason },
        { headers: getAuthHeader() },
      );
      toast.success('Quotation rejected');
      setRejectOpen(false);
      setRejectReason('');
      await loadQuote();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject quote');
    } finally {
      setRejecting(false);
    }
  };

  const download = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/quotes/${quoteId}/download`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const header = await blob.slice(0, 5).text();
      if (header !== '%PDF-') throw new Error('Download failed');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${quote.quote_number || quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  if (loading) return <p className="text-ink-muted text-sm">Loading…</p>;
  if (!quote) return <p className="text-ink-muted">Quote not found.</p>;

  return (
    <div className="pb-24">
      <Link to="/dashboard/quotes" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to quotes
      </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="editorial-label mb-2">Quote</p>
          <h1 className="app-page-title">{quote.quote_number || quote.id.slice(0, 8).toUpperCase()}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={
          quote.current_handler === 'AWAITING_INFORMATION'
            ? 'awaiting_information'
            : quote.status
        } />
        {isDraft && (
          <button
            type="button"
            onClick={continueDraft}
            className="btn-primary h-9 px-3 text-sm"
          >
            Continue editing
          </button>
        )}
        {isQuoted && (
          <button
            type="button"
            onClick={download}
            className="h-9 px-3 rounded-xl border border-ink/15 text-sm font-medium text-ink hover:bg-ink/5 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
        </div>
      </div>

      <div className="editorial-panel p-4 sm:p-6 mb-6 text-sm space-y-1">
        <p><span className="text-ink-muted">Facility:</span> <span className="font-medium">{quote.facility_name}</span></p>
        {branchName && <p><span className="text-ink-muted">Branch:</span> <span className="font-medium">{branchName}</span></p>}
        <p><span className="text-ink-muted">{isDraft ? 'Opened' : 'Submitted'}:</span> {formatDateTime(quote.created_at)}</p>
        {isDraft && (
          <p className="text-sm text-copper pt-2">
            This quote has not been sent to Hampton yet. Continue editing to change quantities or add products, then submit for review.
          </p>
        )}
        {quote.quoted_at && (
          <p><span className="text-ink-muted">Quoted:</span> {formatDateTime(quote.quoted_at)}</p>
        )}
      </div>

      <div className="editorial-panel overflow-hidden mb-6">
        <div className={`hidden md:grid gap-4 px-4 md:px-6 py-3 border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink-faint font-medium ${isQuoted ? 'md:grid-cols-[1fr_70px_110px_110px_100px]' : 'md:grid-cols-[1fr_70px_110px]'}`}>
          <span>Product</span>
          <span className="text-center">Qty</span>
          <span className="text-right">List Price</span>
          {isQuoted && <span className="text-right text-copper">Your Quoted Price</span>}
          {isQuoted && <span className="text-right">Total</span>}
        </div>
        <ul className="divide-y divide-ink/10">
          {(quote.items || []).map((item) => {
            const list = itemListPrice(item);
            const quoted = itemQuotedPrice(item);
            const qty = itemQuantity(item);
            return (
              <li
                key={item.id || item.product_id}
                className={`grid gap-3 md:gap-4 items-start p-4 md:px-6 ${isQuoted ? 'md:grid-cols-[1fr_70px_110px_110px_100px]' : 'md:grid-cols-[1fr_70px_110px]'}`}
              >
                <div>
                  <p className="font-semibold text-sm text-ink">{item.product_name}</p>
                  {item.notes && <p className="text-xs text-ink-muted mt-1">Note: {item.notes}</p>}
                  {isQuoted && <QuoteLineSavings item={item} />}
                </div>
                <p className="text-sm md:text-center">
                  <span className="text-xs text-ink-muted md:hidden">Qty: </span>
                  {qty}
                </p>
                <p className="text-sm md:text-right text-ink-muted">
                  <span className="text-xs text-ink-muted md:hidden">List price: </span>
                  {list > 0 ? formatPrice(list) : '—'}
                </p>
                {isQuoted && (
                  <>
                    <p className="text-sm md:text-right font-semibold text-copper">
                      <span className="text-xs text-ink-muted md:hidden font-normal">Quoted price: </span>
                      {quoted > 0 ? formatPrice(quoted) : '—'}
                    </p>
                    <p className="text-sm md:text-right font-medium">
                      <span className="text-xs text-ink-muted md:hidden font-normal">Total: </span>
                      {quoted > 0 ? formatPrice(lineTotal(quoted, qty)) : '—'}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,24rem)] items-start">
        <div className="editorial-panel p-4 sm:p-6">
          <QuoteNotesPanel additionalNotes={quote.additional_notes} items={quote.items} />
        </div>
        <QuotePricingSummary quote={quote} />
      </div>

      {canRespond && (
        <div className="mt-8 pt-6 border-t border-ink/10">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectOpen((v) => !v)}
              disabled={accepting || rejecting}
              className="h-10 px-4 rounded-xl border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Reject Quote
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting || rejecting}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
              Accept Quote & Create Order
            </button>
          </div>
          {rejectOpen && (
            <div className="mt-4 editorial-panel p-4 sm:p-5 border-red-200/60 bg-red-50/40">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-ink mb-2">
                Why are you rejecting this quotation?
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Prices are above our approved budget"
                className="w-full px-3 py-2 border border-ink/15 rounded-xl text-sm bg-white"
              />
              <p className="text-xs text-ink-muted mt-2">
                If you would rather negotiate, send us a message instead — the quote stays open while we talk.
              </p>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setRejectOpen(false); setRejectReason(''); }}
                  className="h-9 px-4 rounded-xl border border-ink/15 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejecting || rejectReason.trim().length < 3}
                  className="h-9 px-4 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm rejection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {quote.customer_response === 'accepted' && (
        <p className="text-sm text-emerald-700 mt-6">
          Quote accepted.{' '}
          <Link to="/dashboard/orders" className="text-copper hover:underline">View your orders</Link>
        </p>
      )}

      {quote.status === 'rejected' && (
        <div className="mt-6 text-sm text-red-700">
          <p className="font-medium">You rejected this quotation.</p>
          {quote.customer_notes && <p className="text-ink-muted mt-1">Reason: {quote.customer_notes}</p>}
        </div>
      )}

      <QuoteMessagesPopup
        quoteId={quoteId}
        headers={getAuthHeader()}
        unreadCount={quote.unread_messages || quote.unread_admin_messages || 0}
        token={token}
        onRead={() => loadQuote().catch(() => {})}
      />
    </div>
  );
};
