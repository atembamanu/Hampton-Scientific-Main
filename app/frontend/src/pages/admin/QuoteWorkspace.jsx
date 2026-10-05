import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Trash2, Download } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, canSeeBuyingPrice, getAdminUser, getAdminToken, canAssignSales, hasCompanyPermission } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { QuoteMessagesPopup } from '../../components/facility/QuoteMessagesPopup';
import { QuoteNotesPanel } from '../../components/facility/QuoteNotesPanel';
import { formatPrice, lineTotal, documentPricing, DEFAULT_TAX_RATE } from '../../utils/pricing';
import { formatDateTime } from '../../lib/utils';
import {
  DeliveryDetailsForm,
  snapshotToDeliveryForm,
  deliveryFormToSnapshot,
} from '../../components/admin/DeliveryDetailsForm';
import { AdminResetFilters } from '../../components/admin/AdminPageHeader';
import { EditorialDialog } from '../../components/admin/EditorialDialog';
import { useConfirm } from '../../components/ConfirmProvider';
import { SheetTabs } from '../../components/ui/SheetTabs';
import { SalesAssignSelect } from '../../components/admin/SalesAssignSelect';

const TABS = ['Overview', 'Items', 'Activity'];

// Only explicit buttons; review start / information requests / send quote
// happen through the modal, the message composer and the Items tab.
const ACTION_LABELS = {
  cancel: 'Cancel Quote',
  create_order: 'Create Order',
};
const HIDDEN_ACTIONS = new Set(['start_review', 'request_information', 'send_quote', 'resend', 'view_order']);

const OVERRIDE_LABELS = {
  under_review: 'Under Review',
  awaiting_information: 'Awaiting Information',
  awaiting_customer: 'Awaiting Customer (quote sent)',
  accepted: 'Accepted (on customer\'s behalf)',
  rejected: 'Rejected (on customer\'s behalf)',
  cancelled: 'Cancelled',
};

const OVERRIDE_HINTS = {
  awaiting_customer: 'Marks the current prices as sent to the customer without re-sending the quotation.',
  accepted: 'Records the customer\'s acceptance (e.g. by phone or email). You will then be able to create the order.',
  rejected: 'Records the customer\'s rejection. The note is stored as the rejection reason.',
  cancelled: 'Closes the quote. This cannot be undone.',
};

export const QuoteWorkspace = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [quote, setQuote] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [items, setItems] = useState([]);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [includeVat, setIncludeVat] = useState(true);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(snapshotToDeliveryForm());
  const [catalog, setCatalog] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [reviewPrompt, setReviewPrompt] = useState(false);
  const [reviewDeclined, setReviewDeclined] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [agents, setAgents] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const headers = getAdminHeader();
  const staffUser = getAdminUser();
  const showBuying = canSeeBuyingPrice(staffUser);
  const canAssign = canAssignSales(staffUser);
  const canSeeInvoices = hasCompanyPermission(staffUser, 'invoices');

  const load = async ({ hydrateForms = true } = {}) => {
    const [qRes, tRes] = await Promise.all([
      axios.get(`${API_URL}/api/admin/ops/quotes/${quoteId}`, { headers }),
      axios.get(`${API_URL}/api/admin/ops/quotes/${quoteId}/timeline`, { headers }).catch(() => ({ data: [] })),
    ]);
    setQuote(qRes.data);
    setTimeline(tRes.data || []);
    if (!hydrateForms) return qRes.data;
    setItems((qRes.data.items || []).map((it) => ({
      ...it,
      quoted_quantity: it.quoted_quantity || it.quantity,
      buying_price: it.buying_price ?? 0,
      unit_price: it.unit_price || 0,
      admin_notes: it.admin_notes || '',
    })));
    setTaxRate(qRes.data.tax_rate || DEFAULT_TAX_RATE);
    setIncludeVat(qRes.data.include_vat !== false);
    setDeliveryForm(snapshotToDeliveryForm(qRes.data.delivery_snapshot || {}));
    return qRes.data;
  };

  useEffect(() => {
    setReviewDeclined(false);
    load()
      .then((data) => {
        if (data?.ops_status === 'submitted') setReviewPrompt(true);
      })
      .catch(() => toast.error('Could not load quote'))
      .finally(() => setLoading(false));
    axios.get(`${API_URL}/api/admin/products`, { headers }).catch(() => axios.get(`${API_URL}/api/products`))
      .then((res) => setCatalog(res.data || []))
      .catch(() => {});
    if (canAssign) {
      axios.get(`${API_URL}/api/admin/field/agents`, { headers })
        .then((res) => setAgents(res.data?.agents || []))
        .catch(() => {});
    }
  }, [quoteId]);

  useLiveUpdates({
    token: getAdminToken(),
    quoteId,
    types: ['quote.updated', 'quote.priced', 'quote.drafted', 'message.created', 'delivery.updated', 'order.updated', 'invoice.updated'],
    onEvent: (event) => {
      if (event?.type === 'poll') return;
      load({ hydrateForms: event?.type === 'delivery.updated' }).catch(() => {});
    },
  });

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCatalogProduct = (product) => {
    const productId = product.id || product.product_id;
    if (items.some((it) => it.product_id === productId || it.product_id === product.product_id)) {
      toast.message('Product is already on this quote');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        product_id: productId,
        product_name: product.name,
        category: product.category_name || 'General',
        quantity: 1,
        quoted_quantity: 1,
        list_price: Number(product.price || 0),
        buying_price: Number(product.buying_price || 0),
        unit_price: Number(product.price || 0),
        admin_notes: '',
        in_stock: product.in_stock,
      },
    ]);
    setCatalogQuery('');
    setShowAddProduct(false);
  };

  const catalogMatches = catalog.filter((p) => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q)
      || (p.product_id || '').toLowerCase().includes(q)
      || (p.category_name || '').toLowerCase().includes(q)
    );
  }).slice(0, 12);

  const qtyOf = (it) => it.quoted_quantity || it.quantity || 1;
  const liveDoc = { items, tax_rate: taxRate, include_vat: includeVat };
  const pricing = documentPricing(liveDoc);
  const quotedSubtotal = pricing.quotedSubtotal;
  const costSubtotal = items.reduce((sum, it) => sum + lineTotal(it.buying_price, qtyOf(it)), 0);
  const listSubtotal = pricing.listSubtotal;
  const taxAmount = pricing.taxAmount;
  const total = pricing.total;
  const discount = pricing.discount;
  const grossProfit = quotedSubtotal - costSubtotal;

  const itemPayload = () => items.map((it) => ({
    id: it.id || undefined,
    product_id: it.product_id,
    product_name: it.product_name,
    category: it.category || 'General',
    buying_price: showBuying ? Number(it.buying_price || 0) : undefined,
    unit_price: Number(it.unit_price || 0),
    quoted_quantity: Number(qtyOf(it)),
    quantity: Number(qtyOf(it)),
    list_price: Number(it.list_price || 0),
    admin_notes: it.admin_notes || '',
  }));

  const allPriced = items.length > 0 && items.every((it) => Number(it.unit_price || 0) > 0);

  const assignSales = async (agentId) => {
    setAssigning(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/ops/quotes/${quoteId}/assign`,
        { assigned_sales_user_id: agentId },
        { headers },
      );
      setQuote(res.data);
      toast.success(agentId ? 'Sales agent assigned' : 'Sales agent unassigned');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not assign sales agent');
    } finally {
      setAssigning(false);
    }
  };

  const sendQuote = async () => {
    if (quote?.order_id) {
      toast.error('This quote has been converted to an order and cannot be edited');
      return;
    }
    if (!allPriced) {
      toast.error('Enter a quoted price for every line before sending the quote');
      return;
    }
    const resending = quote?.ops_status === 'awaiting_customer';
    const approved = await confirm(resending
      ? {
        label: 'Send quote',
        title: 'Resend this quotation?',
        description: 'The customer will receive the updated prices and the quote stays with them until they respond.',
        confirmLabel: 'Resend quote',
      }
      : {
        label: 'Send quote',
        title: 'Send this quotation?',
        description: 'The customer will be asked to accept or reject these prices. The quote moves to Awaiting Customer.',
        confirmLabel: 'Send quote',
      });
    if (!approved) return;
    setSaving(true);
    try {
      await axios.patch(
        `${API_URL}/api/admin/ops/quotes/${quoteId}`,
        {
          items: itemPayload(),
          discount_amount: Number(discount || 0),
          tax_rate: Number(taxRate || DEFAULT_TAX_RATE),
          include_vat: includeVat,
        },
        { headers },
      );
      await axios.post(
        `${API_URL}/api/admin/quotes/${quoteId}/modify`,
        {
          facility_name: quote.facility_name,
          contact_person: quote.contact_person,
          email: quote.email,
          phone: quote.phone,
          address: quote.address,
          items: items.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            category: it.category || 'General',
            quantity: Number(qtyOf(it)),
            original_price: Number(it.list_price || 0),
            modified_price: Number(it.unit_price || 0),
            buying_price: showBuying ? Number(it.buying_price || 0) : undefined,
            notes: it.admin_notes || '',
          })),
          discount_amount: Number(discount || 0),
          tax_rate: Number(taxRate || DEFAULT_TAX_RATE),
          include_vat: includeVat,
          validity_days: 30,
        },
        { headers },
      );
      toast.success(resending ? 'Updated quotation sent to customer' : 'Quotation sent to customer');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send quote');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (quote?.order_id) {
      toast.error('This quote has been converted to an order and cannot be edited');
      return;
    }
    setSaving(true);
    try {
      await axios.patch(
        `${API_URL}/api/admin/ops/quotes/${quoteId}`,
        {
          items: itemPayload(),
          discount_amount: Number(discount || 0),
          tax_rate: Number(taxRate || DEFAULT_TAX_RATE),
          include_vat: includeVat,
        },
        { headers },
      );
      toast.success('Quote saved');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save quote');
    } finally {
      setSaving(false);
    }
  };

  const saveDelivery = async () => {
    if (quote?.order_id) {
      toast.error('This quote has been converted to an order and cannot be edited');
      return;
    }
    setSavingDelivery(true);
    try {
      const res = await axios.patch(
        `${API_URL}/api/admin/ops/quotes/${quoteId}`,
        { delivery_snapshot: deliveryFormToSnapshot(deliveryForm, quote.delivery_snapshot || {}) },
        { headers },
      );
      setQuote(res.data);
      setDeliveryForm(snapshotToDeliveryForm(res.data.delivery_snapshot || {}));
      toast.success('Delivery details saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save delivery details');
    } finally {
      setSavingDelivery(false);
    }
  };

  const runAction = async (action) => {
    if (action === 'cancel') {
      const approved = await confirm({
        label: 'Cancel quote',
        title: 'Cancel this quote?',
        description: 'The customer will no longer be able to accept it. This cannot be undone.',
        confirmLabel: 'Cancel quote',
        tone: 'danger',
      });
      if (!approved) return;
    }
    if (action === 'create_order') {
      const approved = await confirm({
        label: 'Create order',
        title: 'Create an order from this quote?',
        description: 'The order will use the accepted quoted prices and quantities.',
        confirmLabel: 'Create order',
      });
      if (!approved) return;
    }
    setActing(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/ops/quotes/${quoteId}/workflow`,
        { action },
        { headers },
      );
      if (action === 'create_order' && res.data.order) {
        toast.success(`Order ${res.data.order.orderNumber} created`);
        navigate(`/sysadmin/orders/${res.data.order.id}`);
        return;
      }
      toast.success(action === 'start_review' ? 'Review started' : 'Status updated');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const startReview = async () => {
    setReviewPrompt(false);
    await runAction('start_review');
  };

  const declineReview = () => {
    setReviewPrompt(false);
    setReviewDeclined(true);
  };

  const openStatusModal = () => {
    setOverrideTarget('');
    setOverrideNote('');
    setStatusModal(true);
  };

  const submitOverride = async () => {
    if (!overrideTarget) {
      toast.error('Choose the new status');
      return;
    }
    if (overrideNote.trim().length < 3) {
      toast.error('Add a note explaining the change');
      return;
    }
    if (overrideTarget === 'cancelled') {
      const approved = await confirm({
        label: 'Cancel quote',
        title: 'Cancel this quote?',
        description: 'The customer will no longer be able to accept it. This cannot be undone.',
        confirmLabel: 'Cancel quote',
        tone: 'danger',
      });
      if (!approved) return;
    }
    setActing(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/ops/quotes/${quoteId}/status`,
        { status: overrideTarget, note: overrideNote.trim() },
        { headers },
      );
      toast.success(`Status changed to ${OVERRIDE_LABELS[overrideTarget] || overrideTarget}`);
      setStatusModal(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change status');
    } finally {
      setActing(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/ops/quotes/${quoteId}/download`, {
        headers,
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
      toast.error('Failed to download quote PDF');
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-copper" /></div>;
  }
  if (!quote) return <p className="p-6 text-ink-muted">Quote not found.</p>;

  const ops = quote.ops_status;
  const converted = Boolean(quote.order_id) || ops === 'converted';
  const closed = converted || ops === 'rejected' || ops === 'cancelled';
  const notStarted = ops === 'submitted';
  // Prices/items are editable only while staff are actively working the quote.
  const locked = closed || notStarted || ops === 'accepted';
  const lockReason = converted
    ? 'This quotation is locked because it has been converted to an order.'
    : notStarted
      ? 'Prices are locked until the review is started.'
      : ops === 'accepted'
        ? 'This quotation has been accepted; prices are now agreed. Create the order to continue.'
        : closed
          ? `This quotation is ${ops} and can no longer be edited.`
          : '';
  const actions = converted
    ? (quote.available_actions || []).filter((a) => a === 'view_order')
    : (quote.available_actions || []);
  const buttonActions = actions.filter((a) => !HIDDEN_ACTIONS.has(a) && a !== 'create_order');
  const overrideTargets = quote.available_status_overrides || [];
  const canSendQuote = !locked && (ops === 'under_review' || ops === 'awaiting_information' || ops === 'awaiting_customer');

  return (
    <div className="w-full space-y-6 pb-24">
      <Link to="/sysadmin/quotes" className="inline-flex items-center gap-2 text-sm text-brand hover:text-copper hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to quotes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="editorial-label mb-1">Quote workspace</p>
          <h1 className="app-page-title">{quote.quote_number || quote.id.slice(0, 8)}</h1>
          <p className="text-sm text-ink-muted mt-2">
            {quote.organization_name}
            {quote.branch_name ? ` · ${quote.branch_name}` : ''}
            {quote.is_guest ? ' · Guest request' : ''}
          </p>
          <p className="text-sm text-ink-faint">Requested by {quote.requested_by} · {formatDateTime(quote.created_at)}</p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
          <OpsStatusBadge status={ops} />
          <button type="button" onClick={downloadPdf} className="btn-secondary inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {notStarted && reviewDeclined && (
        <div className="editorial-panel border-amber-200/60 bg-amber-50/50 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-800">Review not started</p>
            <p className="text-sm text-amber-700">You are viewing this request read-only. Start the review to edit prices and message the customer.</p>
          </div>
          <button type="button" onClick={startReview} disabled={acting} className="btn-primary">
            Start Review
          </button>
        </div>
      )}

      {ops === 'awaiting_information' && (
        <div className="editorial-panel border-purple-200/60 bg-purple-50/50 p-5">
          <p className="font-semibold text-purple-800">Awaiting information from the customer</p>
          <p className="text-sm text-purple-700">The quote returns to Under Review automatically when the customer replies. You can still price lines and send the quote.</p>
        </div>
      )}

      {ops === 'accepted' && !converted && (
        <div className="editorial-panel border-emerald-200/60 bg-emerald-50/50 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-emerald-800">Quote accepted</p>
            <p className="text-sm text-emerald-700">Quoted prices will become agreed order prices.</p>
          </div>
          <button type="button" onClick={() => runAction('create_order')} disabled={acting} className="btn-primary">
            Create Order
          </button>
        </div>
      )}

      {ops === 'rejected' && (
        <div className="editorial-panel border-red-200/60 bg-red-50/50 p-5">
          <p className="font-semibold text-red-800">Quote rejected</p>
          {quote.customer_notes && <p className="text-sm text-red-700 mt-1">Reason: {quote.customer_notes}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.includes('view_order') && quote.order_id && (
          <Link to={`/sysadmin/orders/${quote.order_id}`} className="btn-primary inline-flex items-center h-9 px-4 text-sm">
            View Order
          </Link>
        )}
        {canSendQuote && (
          <button
            type="button"
            disabled={saving || acting || !allPriced}
            onClick={sendQuote}
            title={allPriced ? '' : 'Enter a quoted price for every line first'}
            className="btn-primary h-9 px-4 text-sm disabled:opacity-60"
          >
            {ops === 'awaiting_customer' ? 'Resend Quote' : 'Send Quote'}
          </button>
        )}
        {!closed && overrideTargets.length > 0 && (
          <button
            type="button"
            disabled={acting}
            onClick={openStatusModal}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-ink/15 text-ink hover:bg-ink/5"
          >
            Change status
          </button>
        )}
        {buttonActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={acting || saving}
            onClick={() => runAction(action)}
            className={`h-9 px-4 rounded-lg text-sm font-medium ${action === 'cancel' ? 'border border-red-200 text-red-600' : 'btn-primary'}`}
          >
            {ACTION_LABELS[action] || action}
          </button>
        ))}
      </div>

      <EditorialDialog
        open={reviewPrompt}
        onClose={declineReview}
        label="Quote request"
        titleId="start-review-title"
        title="Start reviewing this quote?"
        description="Starting the review moves the request to Under Review and unlocks pricing. If you only want to look, you can view it read-only."
      >
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={declineReview} className="h-10 px-4 text-sm border border-ink/15 rounded bg-white hover:bg-ink/5">
            View only
          </button>
          <button type="button" onClick={startReview} disabled={acting} className="btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {acting && <Loader2 className="w-4 h-4 animate-spin" />}
            Start Review
          </button>
        </div>
      </EditorialDialog>

      <EditorialDialog
        open={statusModal}
        onClose={() => setStatusModal(false)}
        label="Quote status"
        titleId="change-status-title"
        title="Change quote status"
        description="Use this when the customer cannot act in the portal, or to correct the workflow. The note is recorded in the activity trail."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">New status</label>
            <select
              value={overrideTarget}
              onChange={(e) => setOverrideTarget(e.target.value)}
              className="w-full h-10 px-3 border border-ink/15 rounded-lg text-sm bg-white"
            >
              <option value="">Select…</option>
              {overrideTargets.map((target) => (
                <option key={target} value={target}>{OVERRIDE_LABELS[target] || target}</option>
              ))}
            </select>
            {overrideTarget && OVERRIDE_HINTS[overrideTarget] && (
              <p className="text-xs text-ink-muted mt-1">{OVERRIDE_HINTS[overrideTarget]}</p>
            )}
            {(overrideTarget === 'awaiting_customer' || overrideTarget === 'accepted') && !quote.all_lines_priced && (
              <p className="text-xs text-red-600 mt-1">Every line needs a saved quoted price before this status can be set.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Note (required)</label>
            <textarea
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              rows={3}
              placeholder="e.g. Customer confirmed acceptance by phone on 12 Sep"
              className="w-full px-3 py-2 border border-ink/15 rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setStatusModal(false)} className="h-10 px-4 text-sm border border-ink/15 rounded bg-white hover:bg-ink/5">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitOverride}
              disabled={acting || !overrideTarget || overrideNote.trim().length < 3}
              className="btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {acting && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply
            </button>
          </div>
        </div>
      </EditorialDialog>

      <SheetTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="editorial-panel p-5">
            <p className="text-xs text-ink-faint mb-1">Facility</p>
            <p className="font-medium text-ink">{quote.organization_name || quote.facility_name}</p>
            {quote.branch_name && <p className="text-sm text-ink-muted mt-1">{quote.branch_name}</p>}
          </div>
          <div className="editorial-panel p-5">
            <p className="text-xs text-ink-faint mb-1">Requested by</p>
            <p className="font-medium text-ink">{quote.requested_by || quote.contact_person}</p>
            <p className="text-sm text-ink-muted mt-1">{quote.email}</p>
            {quote.phone && <p className="text-sm text-ink-muted">{quote.phone}</p>}
          </div>
          <div className="editorial-panel p-5">
            <p className="text-xs text-ink-faint mb-1">Quoted total</p>
            <p className="text-xl font-bold text-brand">{formatPrice(total)}</p>
            <p className="text-xs text-ink-muted mt-1">{items.length} item{items.length === 1 ? '' : 's'}</p>
          </div>
          <SalesAssignSelect
            agents={agents}
            value={quote.assigned_sales_user_id}
            name={quote.assigned_sales_name}
            canAssign={canAssign}
            disabled={assigning}
            onChange={assignSales}
          />
          {quote.order_id && (
            <div className="editorial-panel p-5">
              <p className="text-xs text-ink-faint mb-1">Linked order</p>
              <Link to={`/sysadmin/orders/${quote.order_id}`} className="text-brand font-semibold hover:underline">
                {quote.order_number}
              </Link>
            </div>
          )}
          {canSeeInvoices && quote.invoice_id && (
            <div className="editorial-panel p-5">
              <p className="text-xs text-ink-faint mb-1">Linked invoice</p>
              <div className="flex items-center gap-2">
                <Link to={`/sysadmin/invoices/${quote.invoice_id}`} className="text-brand font-semibold hover:underline">
                  {quote.invoice_number}
                </Link>
                <OpsStatusBadge status={quote.invoice_status} />
              </div>
            </div>
          )}
          <div className="editorial-panel p-5 sm:col-span-2 xl:col-span-3">
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
        <section className="editorial-panel overflow-hidden">
          <div className="px-5 py-3 border-b border-ink/5 bg-cream/40 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {locked
                ? lockReason
                : showBuying
                  ? 'Buying price is admin-only (supplier cost). List price is the catalogue selling estimate. Quoted price is what the facility will pay. Save keeps changes internal; Send Quote publishes them and moves the quote to Awaiting Customer.'
                  : 'List price is the catalogue selling estimate. Quoted price is what the facility will pay. Save keeps changes internal; Send Quote publishes them and moves the quote to Awaiting Customer.'}
            </p>
            {!locked && (
            <button type="button" onClick={() => setShowAddProduct((v) => !v)} className="h-8 px-3 rounded-lg border border-ink/15 text-xs font-medium inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add product
            </button>
            )}
          </div>
          {showAddProduct && !locked && (
            <div className="px-5 py-3 border-b border-ink/10 bg-white">
              <div className="filter-bar mb-2">
              <input
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search catalogue…"
                className="w-full h-9 px-3 border border-ink/15 rounded-lg text-sm"
              />
              <AdminResetFilters disabled={!catalogQuery.trim()} onReset={() => setCatalogQuery('')} />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-ink/5">
                {catalogMatches.map((p) => (
                  <button
                    key={p.id || p.product_id}
                    type="button"
                    onClick={() => addCatalogProduct(p)}
                    className="w-full text-left py-2 px-1 text-sm hover:bg-cream/60 flex justify-between gap-3"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-ink-muted ml-2">{p.product_id}</span>
                    </span>
                    <span className="text-xs text-ink-muted whitespace-nowrap">{formatPrice(p.price)}</span>
                  </button>
                ))}
                {catalogMatches.length === 0 && <p className="text-xs text-ink-muted py-2">No matching products.</p>}
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table className={`w-full text-sm ${showBuying ? 'min-w-[980px]' : 'min-w-[760px]'}`}>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10 bg-cream/50">
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Req.</th>
                  <th className="px-4 py-2">Quoted qty</th>
                  <th className="px-4 py-2">Stock</th>
                  {showBuying && <th className="px-4 py-2 text-right">Buying</th>}
                  <th className="px-4 py-2 text-right">List</th>
                  <th className="px-4 py-2 text-right">Quoted</th>
                  {showBuying && <th className="px-4 py-2 text-right">Margin</th>}
                  <th className="px-4 py-2 text-right">Line total</th>
                  {!locked && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {items.map((it, idx) => {
                  const lineQuoted = lineTotal(it.unit_price, qtyOf(it));
                  const lineCost = lineTotal(it.buying_price, qtyOf(it));
                  const lineMargin = lineQuoted - lineCost;
                  return (
                    <tr key={it.id || idx} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{it.product_name}</p>
                        {it.notes && <p className="text-xs text-ink-muted mt-1">Note: {it.notes}</p>}
                        {locked ? (
                          it.admin_notes ? <p className="text-xs text-ink-muted mt-1">{it.admin_notes}</p> : null
                        ) : (
                        <input
                          value={it.admin_notes || ''}
                          onChange={(e) => updateItem(idx, { admin_notes: e.target.value })}
                          placeholder="Admin note"
                          className="mt-2 w-full h-8 px-2 border border-ink/15 rounded text-xs bg-white/80"
                        />
                        )}
                      </td>
                      <td className="px-4 py-3">{it.quantity}</td>
                      <td className="px-4 py-3">
                        {locked ? qtyOf(it) : (
                        <input
                          type="number"
                          min={1}
                          value={it.quoted_quantity}
                          onChange={(e) => updateItem(idx, { quoted_quantity: parseInt(e.target.value, 10) || 1 })}
                          className="w-20 h-8 px-2 border border-ink/15 rounded text-sm bg-white/80"
                        />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${it.in_stock === false ? 'text-red-600' : 'text-emerald-700'}`}>
                          {it.in_stock === false ? 'Out of stock' : it.in_stock === true ? 'In stock' : '—'}
                        </span>
                      </td>
                      {showBuying && (
                        <td className="px-4 py-3 text-right">
                          {locked ? formatPrice(it.buying_price) : (
                          <input
                            type="number"
                            min={0}
                            value={it.buying_price}
                            onChange={(e) => updateItem(idx, { buying_price: parseFloat(e.target.value) || 0 })}
                            className="w-28 h-8 px-2 border border-amber-200 rounded text-sm text-right bg-amber-50/50"
                            title="Admin only — supplier cost"
                          />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-ink-muted whitespace-nowrap">{formatPrice(it.list_price)}</td>
                      <td className="px-4 py-3 text-right">
                        {locked ? (
                          <span className="font-semibold text-brand">{formatPrice(it.unit_price)}</span>
                        ) : (
                        <input
                          type="number"
                          min={0}
                          value={it.unit_price}
                          onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-28 h-8 px-2 border border-ink/15 rounded text-sm text-right font-semibold text-brand bg-white/80"
                        />
                        )}
                      </td>
                      {showBuying && (
                        <td className={`px-4 py-3 text-right whitespace-nowrap text-xs font-medium ${lineMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatPrice(lineMargin)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatPrice(lineQuoted)}</td>
                      {!locked && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-700"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-ink/10 space-y-2 text-sm">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,24rem)] items-start pb-3 border-b border-ink/5">
              <QuoteNotesPanel additionalNotes={quote.additional_notes} items={items} />
              <div className="space-y-2">
                {showBuying && <div className="flex justify-between text-ink-muted"><span>Cost (buying)</span><span>{formatPrice(costSubtotal)}</span></div>}
                {showBuying && <div className="flex justify-between font-medium text-emerald-800"><span>Est. gross profit</span><span>{formatPrice(grossProfit)}</span></div>}
                <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>{formatPrice(listSubtotal)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Discount</span><span>-{formatPrice(discount)}</span></div>
                <div className="flex justify-between items-center gap-3">
                  <label className="text-ink-muted flex items-center gap-2">
                    <input type="checkbox" checked={includeVat} disabled={locked} onChange={(e) => setIncludeVat(e.target.checked)} />
                    VAT ({taxRate}%)
                  </label>
                  <span>{formatPrice(includeVat ? taxAmount : 0)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-ink/10">
                  <span>Total</span>
                  <span className="text-brand">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
            {!locked && (
            <div className="flex flex-wrap justify-end items-center gap-2 pt-1">
              {!allPriced && (
                <p className="text-xs text-amber-700 mr-auto">Enter a quoted price for every line to enable Send Quote.</p>
              )}
              <button type="button" onClick={saveDraft} disabled={saving} className="h-9 px-4 rounded-lg border border-ink/15 text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                Save
              </button>
              {canSendQuote && (
              <button type="button" onClick={sendQuote} disabled={saving || !allPriced} className="btn-primary disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                {ops === 'awaiting_customer' ? 'Resend Quote' : 'Send Quote'}
              </button>
              )}
            </div>
            )}
          </div>
        </section>
      )}

      {tab === 'Activity' && (
        <section className="editorial-panel p-5">
          <ol className="space-y-3">
            {timeline.length === 0 && <p className="text-sm text-ink-muted">No recorded activity yet.</p>}
            {timeline.map((ev, i) => (
              <li key={ev.id || i} className="text-sm">
                <p className="text-[11px] text-ink-faint">{formatDateTime(ev.created_at)}</p>
                <p className="text-ink">{ev.summary}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <QuoteMessagesPopup
        quoteId={quoteId}
        headers={headers}
        unreadCount={quote.unread_messages || quote.unread_customer_messages || 0}
        token={getAdminToken()}
        adminMode
        facilityName={quote.organization_name || quote.facility_name || ''}
        branchName={quote.branch_name || ''}
        counterpartName={quote.requested_by || quote.contact_person || ''}
        canRequestInformation={ops === 'under_review' || ops === 'awaiting_information'}
        disabledReason={notStarted ? 'Start the review before messaging the customer.' : ''}
        onRead={() => load({ hydrateForms: false }).catch(() => {})}
      />
    </div>
  );
};
