import { useEffect, useMemo, useState } from 'react';

import { Link, Navigate, useNavigate } from 'react-router-dom';

import axios from 'axios';

import { toast } from 'sonner';

import { Minus, Plus, Trash2, Loader2, ShoppingBag, Search } from 'lucide-react';
import { FacilityResetFilters } from '../../components/facility/FacilityListControls';



import { useQuote } from '../../context/QuoteContext';

import { useAuth } from '../../context/AuthContext';

import { API_URL } from '../../config/apiBaseUrl';

import { EditorialField } from '../../components/template/EditorialSection';

import { Input } from '../../components/ui/input';
import { formatPrice, sumListSubtotal } from '../../utils/pricing';



const formatApiError = (err, fallback) => {

  const detail = err.response?.data?.detail;

  if (Array.isArray(detail)) {

    return detail.map((item) => item.msg || JSON.stringify(item)).join(', ');

  }

  if (typeof detail === 'string') {

    return detail;

  }

  return fallback;

};



export const FacilityQuoteBasket = () => {

  const navigate = useNavigate();

  const {

    quoteItems,

    quoteReference,

    draftQuoteId,

    quoteExtras,

    updateQuantity,

    updateNotes,

    removeFromQuote,

    clearQuote,

    getTotalItems,

    getItemCount,

    hasItems,

  } = useQuote();

  const { user, getAuthHeader, primaryBranchId, branches } = useAuth();

  const [additionalNotes, setAdditionalNotes] = useState(quoteExtras?.additionalNotes || '');

  const [search, setSearch] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (quoteExtras?.additionalNotes) setAdditionalNotes(quoteExtras.additionalNotes);
  }, [quoteExtras?.additionalNotes]);



  const totalItems = getTotalItems();

  const lineCount = getItemCount();

  const branch = branches?.find((b) => b.id === primaryBranchId) || branches?.[0];



  const listSubtotal = useMemo(() => sumListSubtotal(quoteItems), [quoteItems]);

  const filteredItems = useMemo(() => {

    const query = search.trim().toLowerCase();

    if (!query) return quoteItems;



    return quoteItems.filter((item) => {

      const haystack = [

        item.name,

        item.sku,

        item.productId,

        item.category,

        item.notes,

      ]

        .filter(Boolean)

        .join(' ')

        .toLowerCase();

      return haystack.includes(query);

    });

  }, [quoteItems, search]);



  if (!hasItems) {

    return <Navigate to="/dashboard/products" replace />;

  }



  const handleSubmit = async () => {

    if (quoteItems.length === 0) {

      toast.error('Add products to your quote first');

      return;

    }



    setSubmitting(true);

    try {

      const payload = {

        facility_name: user.organization?.name || user.facilityName || 'Facility',

        contact_person: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,

        email: user.email,

        phone: user.phone || user.organization?.phone || 'N/A',

        address: user.organization?.addressLine || user.address || undefined,

        additional_notes: additionalNotes || undefined,

        quote_number: quoteReference || undefined,

        ordered_for_branch_id: quoteExtras?.orderedForBranchId || (user.role === 'org_admin' ? (primaryBranchId || branches?.[0]?.id) : undefined),

        delivery_location_id: quoteExtras?.deliveryLocationId || undefined,

        items: quoteItems.map((item) => ({

          product_id: String(item.productId),

          product_name: item.name,

          category: item.category || 'General',

          quantity: item.quantity,

          list_price: item.listPrice ?? item.price ?? 0,

          notes: item.notes?.trim() || undefined,

        })),

      };



      if (!payload.ordered_for_branch_id && user.role === 'org_admin' && (primaryBranchId || branches?.[0]?.id)) {

        payload.ordered_for_branch_id = primaryBranchId || branches[0].id;

      }



      if (draftQuoteId) {

        await axios.post(`${API_URL}/api/quotes/${draftQuoteId}/submit`, payload, { headers: getAuthHeader() });

      } else {

        await axios.post(`${API_URL}/api/quotes`, payload, { headers: getAuthHeader() });

      }

      clearQuote({ silent: true });

      toast.success('Quote submitted successfully');

      navigate('/dashboard/quotes');

    } catch (err) {

      toast.error(formatApiError(err, 'Failed to submit quote'));

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <div>

      <p className="editorial-label mb-2">Quote basket</p>

      <h1 className="app-page-title mb-4">Quote Basket</h1>



      <div className="editorial-panel p-4 sm:p-6 mb-6 space-y-2 text-sm">

        {quoteReference && (

          <p>

            <span className="text-ink-muted">Quote Reference:</span>{' '}

            <span className="font-semibold text-ink">{quoteReference}</span>

          </p>

        )}

        <p>

          <span className="text-ink-muted">Items:</span>{' '}

          <span className="font-medium text-ink">

            {totalItems} unit{totalItems !== 1 ? 's' : ''} across {lineCount} product{lineCount !== 1 ? 's' : ''}

          </span>

        </p>

        {branch && (

          <p>

            <span className="text-ink-muted">Branch:</span>{' '}

            <span className="font-medium text-ink">{branch.name}</span>

          </p>

        )}

        {user?.organization?.name && (

          <p>

            <span className="text-ink-muted">Facility:</span>{' '}

            <span className="font-medium text-ink">{user.organization.name}</span>

          </p>

        )}

        <p className="text-xs text-ink-faint pt-1">
          Catalogue list prices shown below. Final quoted prices will be confirmed by Hampton Scientific.
        </p>

        {draftQuoteId && (
          <p className="text-sm text-copper pt-2">
            {quoteExtras?.sourceOrderNumber
              ? `Reorder from ${quoteExtras.sourceOrderNumber}. `
              : ''}
            Adjust quantities, add products, then submit for review. Hampton will align prices on this quote.
          </p>
        )}

      </div>



      <div className="filter-bar">

        <div className="filter-search relative">

        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />

        <input

          type="text"

          placeholder="Search quote items…"

          value={search}

          onChange={(e) => setSearch(e.target.value)}

          className="w-full bg-white border border-ink/10 rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-copper/40"

        />

        </div>

        <FacilityResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />

      </div>



      {filteredItems.length === 0 ? (

        <div className="editorial-panel p-12 text-center mb-6">

          <ShoppingBag className="w-10 h-10 text-ink-faint mx-auto mb-4" />

          <p className="text-ink-muted">No quote items match your search.</p>

        </div>

      ) : (

        <div className="editorial-panel overflow-hidden mb-6">

          <div className="hidden md:grid md:grid-cols-[1fr_80px_110px_1fr_40px] gap-4 px-4 md:px-6 py-3 border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink-faint font-medium">

            <span>Product</span>

            <span className="text-center">Qty</span>

            <span className="text-right">List Price</span>

            <span>Notes</span>

            <span />

          </div>

          <ul className="divide-y divide-ink/10">

            {filteredItems.map((item) => (

              <li key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_110px_1fr_40px] gap-3 md:gap-4 items-center p-4 md:px-6">

                <div className="min-w-0">

                  <p className="text-[10px] text-ink-faint uppercase tracking-wider">{item.category}</p>

                  <p className="font-semibold text-sm text-ink truncate">{item.name}</p>

                  {item.sku && (

                    <p className="text-[11px] text-ink-faint mt-0.5">Code: {item.sku}</p>

                  )}

                </div>



                <div className="flex items-center justify-start md:justify-center gap-2">

                  <span className="text-xs text-ink-muted md:hidden">Qty:</span>

                  <button

                    type="button"

                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}

                    className="w-8 h-8 rounded-full border border-ink/15 flex items-center justify-center"

                  >

                    <Minus className="w-3.5 h-3.5" />

                  </button>

                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>

                  <button

                    type="button"

                    onClick={() => updateQuantity(item.id, item.quantity + 1)}

                    className="w-8 h-8 rounded-full border border-ink/15 flex items-center justify-center"

                  >

                    <Plus className="w-3.5 h-3.5" />

                  </button>

                </div>



                <p className="text-sm text-ink text-right sm:text-right">

                  <span className="text-xs text-ink-muted md:hidden">List Price: </span>

                  {formatPrice(item.listPrice ?? item.price ?? 0)}

                </p>



                <input

                  type="text"

                  value={item.notes || ''}

                  onChange={(e) => updateNotes(item.id, e.target.value)}

                  placeholder="Add a note (e.g. preferred brand or specification)"

                  className="w-full bg-white border border-ink/10 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-copper/40"

                />



                <button

                  type="button"

                  onClick={() => removeFromQuote(item.id)}

                  className="p-2 text-ink-faint hover:text-red-600 justify-self-end md:justify-self-center"

                  aria-label={`Remove ${item.name}`}

                >

                  <Trash2 className="w-4 h-4" />

                </button>

              </li>

            ))}

          </ul>

        </div>

      )}



      {quoteItems.length > 0 && (
        <div className="editorial-panel p-4 sm:p-6 mb-6 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink-muted">List Price Subtotal</span>
            <span className="font-medium text-ink">{formatPrice(listSubtotal)}</span>
          </div>
          <p className="text-xs text-ink-faint">Indicative catalogue total — not the final quoted amount.</p>
        </div>
      )}



      <EditorialField label="Additional notes / special instructions">

        <Input

          value={additionalNotes}

          onChange={(e) => setAdditionalNotes(e.target.value)}

          placeholder="Delivery notes, urgency, or other instructions for this quote…"

        />

      </EditorialField>



      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-8 pt-6 border-t border-ink/10">

        <Link to="/dashboard/products" className="btn-secondary text-center">

          Continue Browsing

        </Link>

        <button

          type="button"

          onClick={handleSubmit}

          disabled={submitting || quoteItems.length === 0}

          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60"

        >

          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}

          Submit Quote

        </button>

      </div>

    </div>

  );

};

