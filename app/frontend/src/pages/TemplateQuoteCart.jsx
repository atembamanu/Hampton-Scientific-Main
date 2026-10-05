import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, Loader2 } from 'lucide-react';

import { useQuote } from '../context/QuoteContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/apiBaseUrl';
import { EditorialField } from '../components/template/EditorialSection';
import { Input } from '../components/ui/input';
import { emailError, phoneError, isValidEmail, isValidPhone, liveEmailError, livePhoneError, invalidFieldClass } from '../utils/validation';
import { SheetTabs } from '../components/ui/SheetTabs';

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'medical_centre', label: 'Medical Centre' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
];

const CHECKOUT_TABS = [
  { id: 'items', label: 'Quoted items' },
  { id: 'facility', label: 'Facility details' },
  { id: 'contact', label: 'Contact details' },
];

const emptyGuest = {
  facilityName: '',
  facilityType: 'hospital',
  branchName: '',
  address: '',
  county: '',
  contactPerson: '',
  email: '',
  phone: '',
};

const QuoteItemsList = ({ quoteItems, updateQuantity, removeFromQuote }) => (
  <ul className="space-y-4">
    {quoteItems.map((item) => (
      <li key={item.id} className="flex items-center gap-4 p-4 bg-white/60 border border-ink/10 rounded-2xl">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-ink-faint uppercase tracking-wider mb-0.5">{item.category}</p>
          <p className="font-semibold text-ink text-sm truncate">{item.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
            className="w-8 h-8 rounded-full border border-ink/15 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-ink">{item.quantity}</span>
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="w-8 h-8 rounded-full border border-ink/15 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => removeFromQuote(item.id)}
          className="p-2 text-ink-faint hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </li>
    ))}
  </ul>
);

export const TemplateQuoteCart = () => {
  const navigate = useNavigate();
  const { quoteItems, updateQuantity, removeFromQuote, getItemCount, clearQuote } = useQuote();
  const { isAuthenticated, isFacilityUser, user, getAuthHeader, branches, primaryBranchId } = useAuth();
  const count = getItemCount();

  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('items');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [orderedForBranchId, setOrderedForBranchId] = useState(primaryBranchId || '');
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('saved');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [newAddress, setNewAddress] = useState({ label: '', addressLine: '', county: '' });
  const [notes, setNotes] = useState('');
  const [guest, setGuest] = useState(emptyGuest);

  const canFacilityCheckout = isAuthenticated && isFacilityUser;
  const isGuestSubmit = !canFacilityCheckout;
  const activeBranches = (branches || []).filter((b) => b.status === 'active');
  const isOrgAdmin = user?.role === 'org_admin';
  const lockedBranch = !isOrgAdmin && activeBranches.length === 1;

  useEffect(() => {
    if (primaryBranchId) setOrderedForBranchId(primaryBranchId);
    else if (activeBranches.length === 1) setOrderedForBranchId(activeBranches[0].id);
  }, [primaryBranchId, activeBranches]);

  useEffect(() => {
    if (!canFacilityCheckout) return;
    axios.get(`${API_URL}/api/delivery-locations`, {
      headers: getAuthHeader(),
      params: orderedForBranchId ? { branch_id: orderedForBranchId } : {},
    }).then((res) => {
      setDeliveryLocations(res.data);
      const def = res.data.find((l) => l.isDefault);
      if (def) setDeliveryLocationId(def.id);
    }).catch(() => {});
  }, [canFacilityCheckout, orderedForBranchId, getAuthHeader]);

  const buildDeliverySnapshot = () => {
    if (deliveryMode === 'new') {
      return {
        label: newAddress.label || 'Custom address',
        address_line: newAddress.addressLine,
        county: newAddress.county,
        delivery_instructions: deliveryInstructions,
      };
    }
    const loc = deliveryLocations.find((l) => l.id === deliveryLocationId);
    if (loc) {
      return {
        label: loc.label,
        address_line: loc.addressLine,
        county: loc.county,
        contact_name: loc.contactName,
        phone: loc.phone,
        delivery_instructions: deliveryInstructions || loc.deliveryInstructions,
      };
    }
    const branch = activeBranches.find((b) => b.id === orderedForBranchId);
    if (branch) {
      return {
        label: branch.name,
        address_line: branch.deliveryAddress || branch.physicalAddress,
        county: branch.county,
        delivery_instructions: deliveryInstructions,
      };
    }
    return { delivery_instructions: deliveryInstructions };
  };

  const cartItems = quoteItems.map((item) => ({
    product_id: item.id,
    product_name: item.name,
    category: item.category || 'General',
    quantity: item.quantity,
  }));

  const facilityReady = canFacilityCheckout
    ? Boolean(orderedForBranchId)
    : Boolean(guest.facilityName.trim() && guest.branchName.trim() && guest.address.trim());

  const contactReady = canFacilityCheckout
    ? true
    : Boolean(guest.contactPerson.trim() && isValidEmail(guest.email) && isValidPhone(guest.phone));

  const startCheckout = () => {
    setShowCheckout(true);
    setCheckoutStep('facility');
  };

  const goToStep = (step) => {
    if (step === 'contact' && !facilityReady) {
      toast.error('Complete facility details first');
      setCheckoutStep('facility');
      return;
    }
    setCheckoutStep(step);
  };

  const handleFacilitySubmit = async () => {
    if (!orderedForBranchId) {
      toast.error('Select a branch');
      setCheckoutStep('facility');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/quotes`, {
        facility_name: user.organization?.name || user.facilityName,
        contact_person: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        address: user.organization?.addressLine || user.address,
        additional_notes: notes,
        ordered_for_branch_id: orderedForBranchId,
        delivery_location_id: deliveryMode === 'saved' ? deliveryLocationId || null : null,
        delivery_snapshot: buildDeliverySnapshot(),
        items: cartItems,
      }, { headers: getAuthHeader() });
      clearQuote();
      toast.success('Quote submitted successfully');
      navigate('/dashboard/quotes');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestSubmit = async () => {
    if (!facilityReady) {
      toast.error('Please complete facility details');
      setCheckoutStep('facility');
      return;
    }
    if (!contactReady) {
      toast.error(emailError(guest.email) || phoneError(guest.phone) || 'Please complete contact details');
      setCheckoutStep('contact');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/quotes`, {
        facility_name: guest.facilityName.trim(),
        facility_type: guest.facilityType,
        branch_name: guest.branchName.trim(),
        address: guest.address.trim(),
        county: guest.county.trim(),
        contact_person: guest.contactPerson.trim(),
        email: guest.email.trim(),
        phone: guest.phone.trim(),
        additional_notes: notes,
        items: cartItems,
      });
      clearQuote();
      setSubmitted(true);
      toast.success('Quote request received. We will respond shortly.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quote request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (canFacilityCheckout) return handleFacilitySubmit();
    return handleGuestSubmit();
  };

  const setGuestField = (key) => (e) => setGuest((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to store
        </Link>

        <p className="editorial-label mb-3">Quote request</p>
        <h1 className="editorial-headline mb-2">
          Your <span className="text-copper">quote</span>
        </h1>
        <p className="text-ink-muted text-sm mb-10">
          {submitted
            ? 'Your request has been sent to Hampton Scientific.'
            : count === 0
              ? 'Add products from the catalog to build your quote request.'
              : `${count} item${count === 1 ? '' : 's'} selected — review and submit when ready.`}
        </p>

        {submitted ? (
          <div className="editorial-panel p-8 space-y-5">
            <h2 className="font-semibold text-ink text-lg">Quote request submitted</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Our sales team will review your request and follow up using the contact details you provided.
              Guest requests cannot be tracked in the portal. Create a facility account for smoother quote
              and order processing, including status updates, messages, and document downloads.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="btn-primary text-center">Create a facility account</Link>
              <Link to="/products" className="btn-secondary text-center">Continue browsing</Link>
            </div>
          </div>
        ) : quoteItems.length === 0 ? (
          <div className="text-center py-16 section-divider">
            <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 text-ink-faint" />
            </div>
            <p className="text-ink-muted mb-6">Your quote cart is empty.</p>
            <Link to="/products" className="btn-primary">Browse products</Link>
          </div>
        ) : (
          <>
            <div className="sticky top-[88px] md:top-[112px] z-30 -mx-6 px-6 py-4 mb-2 bg-cream/95 backdrop-blur-md border-b border-ink/10">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                <Link to="/products" className="btn-secondary text-center w-full sm:w-44">
                  Add more products
                </Link>
                {!showCheckout && (
                  <button type="button" onClick={startCheckout} className="btn-primary w-full sm:w-44">
                    Submit quote
                  </button>
                )}
              </div>
            </div>

            {showCheckout && (
              <div className="mb-8 pt-4">
                <SheetTabs
                  tabs={CHECKOUT_TABS.map((t, i) => ({
                    id: t.id,
                    label: `${String(i + 1).padStart(2, '0')} ${t.label}`,
                  }))}
                  value={checkoutStep}
                  onChange={goToStep}
                />
              </div>
            )}

            {(!showCheckout || checkoutStep === 'items') && (
              <div className={showCheckout ? 'pt-0' : 'pt-6'}>
                <QuoteItemsList
                  quoteItems={quoteItems}
                  updateQuantity={updateQuantity}
                  removeFromQuote={removeFromQuote}
                />
                {showCheckout && (
                  <div className="flex justify-end mt-6">
                    <button type="button" onClick={() => goToStep('facility')} className="btn-primary">
                      Continue to facility details
                    </button>
                  </div>
                )}
              </div>
            )}

            {showCheckout && checkoutStep === 'facility' && (
              <div className="editorial-panel p-6 space-y-5">
                {isGuestSubmit && (
                  <div className="rounded-2xl border border-copper/20 bg-copper/5 p-4">
                    <p className="text-sm text-ink leading-relaxed">
                      Create a facility account with us for smoother quote and order processing.
                      Guest requests cannot be tracked online after submission.
                    </p>
                    <Link to="/register" className="btn-primary inline-flex mt-3 h-9 px-4 text-sm">
                      Register your facility
                    </Link>
                  </div>
                )}

                {isGuestSubmit ? (
                  <>
                    <EditorialField label="Facility name" required>
                      <Input value={guest.facilityName} onChange={setGuestField('facilityName')} placeholder="Hospital or clinic name" />
                    </EditorialField>
                    <EditorialField label="Facility type" required>
                      <select
                        value={guest.facilityType}
                        onChange={setGuestField('facilityType')}
                        className="w-full h-10 px-3 rounded-xl border border-ink/15 text-sm bg-white/80"
                      >
                        {FACILITY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </EditorialField>
                    <EditorialField label="Branch" required>
                      <Input value={guest.branchName} onChange={setGuestField('branchName')} placeholder="e.g. Main, Karen, or HQ" />
                    </EditorialField>
                    <EditorialField label="Address" required>
                      <Input value={guest.address} onChange={setGuestField('address')} />
                    </EditorialField>
                    <EditorialField label="County">
                      <Input value={guest.county} onChange={setGuestField('county')} />
                    </EditorialField>
                  </>
                ) : (
                  <>
                    <EditorialField label="Ordered for (branch)" required>
                      {lockedBranch ? (
                        <p className="text-sm text-ink">{activeBranches[0]?.name}</p>
                      ) : (
                        <select
                          value={orderedForBranchId}
                          onChange={(e) => setOrderedForBranchId(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-ink/15 text-sm bg-white/80"
                        >
                          {activeBranches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name} ({b.branchCode})</option>
                          ))}
                        </select>
                      )}
                    </EditorialField>
                    <EditorialField label="Deliver to">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[
                          { id: 'saved', label: 'Saved location' },
                          { id: 'branch', label: 'Branch address' },
                          { id: 'new', label: 'New address' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setDeliveryMode(m.id)}
                            className={`px-3 py-1.5 rounded-full text-xs border ${deliveryMode === m.id ? 'border-copper bg-copper/10 text-copper' : 'border-ink/15'}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {deliveryMode === 'saved' && (
                        <select
                          value={deliveryLocationId}
                          onChange={(e) => setDeliveryLocationId(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-ink/15 text-sm bg-white/80"
                        >
                          {deliveryLocations.map((l) => (
                            <option key={l.id} value={l.id}>{l.label} — {l.addressLine}</option>
                          ))}
                        </select>
                      )}
                      {deliveryMode === 'new' && (
                        <div className="space-y-3">
                          <Input placeholder="Label (e.g. Karen Wing)" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
                          <Input placeholder="Address" value={newAddress.addressLine} onChange={(e) => setNewAddress({ ...newAddress, addressLine: e.target.value })} />
                          <Input placeholder="County" value={newAddress.county} onChange={(e) => setNewAddress({ ...newAddress, county: e.target.value })} />
                        </div>
                      )}
                    </EditorialField>
                    <EditorialField label="Delivery instructions">
                      <Input value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="Gate code, receiving hours, etc." />
                    </EditorialField>
                  </>
                )}

                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2">
                  <button type="button" onClick={() => goToStep('items')} className="btn-secondary">
                    Back to quoted items
                  </button>
                  <button type="button" onClick={() => goToStep('contact')} className="btn-primary">
                    Continue to contact details
                  </button>
                </div>
              </div>
            )}

            {showCheckout && checkoutStep === 'contact' && (
              <div className="editorial-panel p-6 space-y-5">
                {isGuestSubmit ? (
                  <>
                    <EditorialField label="Contact person" required>
                      <Input value={guest.contactPerson} onChange={setGuestField('contactPerson')} />
                    </EditorialField>
                    <EditorialField label="Email" required error={liveEmailError(guest.email)}>
                      <Input type="email" autoComplete="email" value={guest.email} onChange={setGuestField('email')} className={invalidFieldClass(liveEmailError(guest.email))} />
                    </EditorialField>
                    <EditorialField label="Phone" required error={livePhoneError(guest.phone)}>
                      <Input type="tel" inputMode="tel" autoComplete="tel" value={guest.phone} onChange={setGuestField('phone')} className={invalidFieldClass(livePhoneError(guest.phone))} />
                    </EditorialField>
                  </>
                ) : (
                  <div className="text-sm space-y-1">
                    <p><span className="text-ink-muted">Contact:</span> <span className="font-medium">{user.firstName} {user.lastName}</span></p>
                    <p><span className="text-ink-muted">Email:</span> {user.email}</p>
                    <p><span className="text-ink-muted">Phone:</span> {user.phone}</p>
                  </div>
                )}
                <EditorialField label="Additional notes">
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </EditorialField>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2">
                  <button type="button" onClick={() => goToStep('facility')} className="btn-secondary">
                    Back to facility details
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center justify-center gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit quote request
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
