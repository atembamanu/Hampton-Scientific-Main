import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, canSeeBuyingPrice, getAdminUser } from '../../utils/adminAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { SearchableSelect } from './SearchableSelect';
import { RichTextEditor } from './RichTextEditor';
import { sanitizeHtml } from '../../utils/richText';

const emptyItem = () => ({
  product_id: '',
  product_name: '',
  category: '',
  quantity: 1,
  unit_price: 0,
});

const emptyForm = () => ({
  organization_id: '',
  user_id: '',
  facility_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  items: [],
  discount_amount: 0,
  tax_rate: 16,
  include_vat: true,
  validity_days: 7,
  notes: '',
});

const emptyProduct = () => ({
  name: '',
  category_id: '',
  price: '',
  buying_price: '',
  package: '',
  stocking_unit: '',
  description: '',
});

const fieldClass = 'h-10 w-full rounded-none border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-brand';
const labelClass = 'mb-1 block text-xs font-medium text-ink-muted';

const itemFromProduct = (product) => ({
  product_id: product.product_id,
  product_name: product.name || '',
  category: product.category_name || '',
  quantity: 1,
  unit_price: Number(product.price) || 0,
});

export const CreateQuoteModal = ({ open, onOpenChange, initialClient, onCreated }) => {
  const showBuying = canSeeBuyingPrice(getAdminUser());
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed = {
      ...emptyForm(),
      organization_id: initialClient?.organizationId || '',
      user_id: initialClient?.userId || '',
      facility_name: initialClient?.facilityName || '',
      contact_person: initialClient?.contactPerson || '',
      email: initialClient?.email || '',
      phone: initialClient?.phone || '',
      address: initialClient?.address || '',
    };
    setForm(seed);
    setProductFormOpen(false);
    setProductForm(emptyProduct());
    setLoadingOptions(true);
    Promise.all([
      axios.get(`${API_URL}/api/admin/quote-customers`, { headers: getAdminHeader() }),
      axios.get(`${API_URL}/api/products`),
      axios.get(`${API_URL}/api/products/categories`),
    ])
      .then(([customerResponse, productResponse, categoryResponse]) => {
        const loadedCustomers = customerResponse.data?.customers || [];
        setCustomers(loadedCustomers);
        setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
        setCategories(Array.isArray(categoryResponse.data) ? categoryResponse.data : []);
        if (!seed.organization_id) return;
        const customer = loadedCustomers.find((entry) => entry.organizationId === seed.organization_id);
        if (!customer) return;
        setForm((current) => ({
          ...current,
          organization_id: customer.organizationId,
          user_id: current.user_id || customer.userId || '',
          facility_name: current.facility_name || customer.name || '',
          contact_person: current.contact_person || customer.contactPerson || '',
          email: current.email || customer.email || '',
          phone: current.phone || customer.phone || '',
          address: current.address || customer.address || '',
        }));
      })
      .catch(() => toast.error('Could not load facilities or products.'))
      .finally(() => setLoadingOptions(false));
  }, [open]);

  const subtotal = useMemo(
    () => form.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0,
    ),
    [form.items],
  );
  const discounted = Math.max(0, subtotal - (Number(form.discount_amount) || 0));
  const vat = form.include_vat ? discounted * ((Number(form.tax_rate) || 0) / 100) : 0;
  const total = discounted + vat;
  const selectedProductIds = form.items.map((item) => item.product_id).filter(Boolean);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index, values) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...values } : item
      )),
    }));
  };

  const chooseCustomer = (organizationId) => {
    const customer = customers.find((entry) => entry.organizationId === organizationId);
    if (!customer) {
      setForm((current) => ({ ...current, organization_id: '', user_id: '' }));
      return;
    }
    setForm((current) => ({
      ...current,
      organization_id: customer.organizationId,
      user_id: customer.userId || '',
      facility_name: customer.name || '',
      contact_person: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    }));
  };

  const addProducts = (picked) => {
    const incoming = Array.isArray(picked) ? picked : [picked];
    setForm((current) => {
      const existing = new Set(current.items.map((item) => item.product_id).filter(Boolean));
      const nextRows = [];
      incoming.forEach((product) => {
        const id = product.product_id;
        if (!id || existing.has(id)) return;
        existing.add(id);
        nextRows.push(itemFromProduct(product));
      });
      if (nextRows.length === 0) return current;
      return { ...current, items: [...current.items.filter((item) => item.product_id), ...nextRows] };
    });
  };

  const saveNewProduct = async (event) => {
    event.preventDefault();
    if (!productForm.name.trim() || !productForm.category_id) {
      toast.error('Name and category are required');
      return;
    }
    setSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        category_id: productForm.category_id,
        price: Number(productForm.price) || 0,
        package: productForm.package,
        stocking_unit: productForm.stocking_unit,
        description: sanitizeHtml(productForm.description),
        in_stock: true,
      };
      if (showBuying) payload.buying_price = Number(productForm.buying_price) || 0;
      const response = await axios.post(`${API_URL}/api/admin/quotes/products`, payload, { headers: getAdminHeader() });
      const created = response.data?.product;
      if (!created?.product_id) throw new Error('Product was created without an ID');
      setProducts((current) => [created, ...current.filter((row) => row.product_id !== created.product_id)]);
      addProducts(created);
      setProductForm(emptyProduct());
      setProductFormOpen(false);
      toast.success(`${created.name} added to the quote.`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not add this product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const validItems = form.items.filter((item) => item.product_id && Number(item.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one product to the quote.');
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/quotes`,
        { ...form, items: validItems },
        { headers: getAdminHeader() },
      );
      toast.success('Quote created and sent to the client.');
      onOpenChange(false);
      onCreated?.(response.data?.quote_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create this quote.');
    } finally {
      setSaving(false);
    }
  };

  const facilityOptions = [
    { value: '', label: 'Enter client manually' },
    ...customers.map((customer) => ({
      value: customer.organizationId,
      label: customer.name,
      hint: [customer.contactPerson, customer.email].filter(Boolean).join(' · '),
    })),
  ];
  const productOptions = products.map((product) => ({
    value: product.product_id,
    label: product.name,
    hint: [product.product_id, product.category_name].filter(Boolean).join(' · '),
    product,
  }));

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && !savingProduct && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden border-ink/10 bg-white p-0 sm:rounded-lg">
        <DialogHeader className="border-b border-ink/10 px-6 py-5">
          <DialogTitle>Create quote</DialogTitle>
          <DialogDescription>
            Choose a registered facility or enter a client, price the products, then send the quote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="max-h-[calc(92vh-156px)] overflow-y-auto px-6 py-5">
            <div className="grid gap-6 lg:grid-cols-12">
              <section className="space-y-4 lg:col-span-5 lg:border-r lg:border-ink/10 lg:pr-6">
                <div>
                  <h3 className="font-semibold text-ink">Client details</h3>
                  <p className="mt-1 text-xs text-ink-muted">Selecting a facility links the quote to its portal.</p>
                </div>
                <div>
                  <label className={labelClass}>Registered facility (optional)</label>
                  <SearchableSelect
                    value={form.organization_id}
                    disabled={loadingOptions}
                    placeholder="Search facilities…"
                    searchPlaceholder="Search by facility, contact, or email…"
                    options={facilityOptions}
                    onSelect={(option) => chooseCustomer(option.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Facility name *</label>
                    <input className={fieldClass} required value={form.facility_name} onChange={(event) => update('facility_name', event.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Contact person *</label>
                    <input className={fieldClass} required value={form.contact_person} onChange={(event) => update('contact_person', event.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Email *</label>
                    <input className={fieldClass} required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone *</label>
                    <input className={fieldClass} required type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Address</label>
                    <input className={fieldClass} value={form.address} onChange={(event) => update('address', event.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Valid for (days)</label>
                    <input className={fieldClass} type="number" min="1" value={form.validity_days} onChange={(event) => update('validity_days', Number(event.target.value) || 1)} />
                  </div>
                  <div>
                    <label className={labelClass}>Discount (KES)</label>
                    <input className={fieldClass} type="number" min="0" value={form.discount_amount} onChange={(event) => update('discount_amount', Number(event.target.value) || 0)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes or terms</label>
                  <textarea
                    className="min-h-24 w-full rounded-none border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                  />
                </div>
              </section>

              <section className="space-y-4 lg:col-span-7">
                <div>
                  <h3 className="font-semibold text-ink">Products and pricing</h3>
                  <p className="mt-1 text-xs text-ink-muted">Search and click products to add line items. A missing product can be created here without leaving the quote.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SearchableSelect
                    className="min-w-0 flex-1"
                    stayOpen
                    disabled={loadingOptions}
                    placeholder="Search and add products…"
                    searchPlaceholder="Search catalogue…"
                    emptyText="No matching products."
                    selectedValues={selectedProductIds}
                    options={productOptions}
                    onSelect={(option) => {
                      if (selectedProductIds.includes(option.value)) {
                        toast.message(`${option.label} is already on this quote.`);
                        return;
                      }
                      addProducts(option.product);
                    }}
                    footer={(
                      <button
                        type="button"
                        className="form-menu-item flex w-full items-center gap-2 border-t border-ink/10 px-3 py-2.5 text-left text-sm font-medium text-brand hover:bg-cream/70"
                        onClick={() => {
                          setProductForm((current) => ({
                            ...emptyProduct(),
                            category_id: current.category_id || categories[0]?.category_id || '',
                          }));
                          setProductFormOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" /> Add new product
                      </button>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  {form.items.length === 0 ? (
                    <p className="rounded border border-dashed border-ink/15 bg-cream/40 px-3 py-6 text-center text-sm text-ink-muted">
                      No products yet. Search the catalogue or add a new product.
                    </p>
                  ) : form.items.map((item, index) => (
                    <div key={item.product_id || index} className="grid items-end gap-2 rounded border border-ink/10 bg-cream/30 p-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className={labelClass}>Product</label>
                        <p className="flex h-10 items-center truncate rounded-none border border-ink/10 bg-white px-3 text-sm">{item.product_name}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Qty</label>
                        <input className={fieldClass} type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelClass}>Price (KES)</label>
                        <input className={fieldClass} type="number" min="0" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) || 0 })} />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.product_name || 'product'}`}
                        className="flex h-10 items-center justify-center rounded text-red-600 hover:bg-red-50 sm:col-span-1"
                        onClick={() => setForm((current) => ({
                          ...current,
                          items: current.items.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 rounded border border-ink/10 bg-cream/50 p-4 sm:grid-cols-2">
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={form.include_vat} onChange={(event) => update('include_vat', event.target.checked)} />
                    Add VAT to this quote
                  </label>
                  <div>
                    <label className={labelClass}>VAT rate (%)</label>
                    <input className={fieldClass} type="number" min="0" max="100" value={form.tax_rate} onChange={(event) => update('tax_rate', Number(event.target.value) || 0)} />
                  </div>
                  <div className="space-y-1 text-sm sm:col-span-2">
                    <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>KES {subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Discount</span><span>- KES {(Number(form.discount_amount) || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">VAT</span><span>KES {vat.toLocaleString()}</span></div>
                    <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 text-base font-semibold"><span>Total</span><span className="text-brand">KES {total.toLocaleString()}</span></div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink/10 bg-white px-6 py-4">
            <button type="button" className="h-10 rounded px-4 text-sm text-ink-muted hover:bg-cream" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary h-10 px-5 text-sm" disabled={saving || loadingOptions}>
              {saving ? 'Creating…' : 'Create & send quote'}
            </button>
          </div>
        </form>

        {productFormOpen && (
          <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onClick={() => !savingProduct && setProductFormOpen(false)}>
            <form
              onSubmit={saveNewProduct}
              className="w-full max-w-lg rounded-lg border border-ink/10 bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-ink">Add new product</h3>
              <p className="mt-1 text-sm text-ink-muted">This product is saved to the catalogue and added to the quote automatically.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs text-ink-muted">Name *</span>
                  <input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className={fieldClass} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-ink-muted">Category *</span>
                  <select required value={productForm.category_id} onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value })} className={fieldClass}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-ink-muted">List price (KES)</span>
                  <input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} className={fieldClass} />
                </label>
                {showBuying && (
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-ink-muted">Buying price (KES)</span>
                    <input type="number" min="0" step="0.01" value={productForm.buying_price} onChange={(event) => setProductForm({ ...productForm, buying_price: event.target.value })} className={fieldClass} />
                  </label>
                )}
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-ink-muted">Package</span>
                  <input value={productForm.package} onChange={(event) => setProductForm({ ...productForm, package: event.target.value })} className={fieldClass} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-ink-muted">Stocking unit</span>
                  <input value={productForm.stocking_unit} onChange={(event) => setProductForm({ ...productForm, stocking_unit: event.target.value })} className={fieldClass} />
                </label>
                <div className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs text-ink-muted">Description</span>
                  <RichTextEditor
                    value={productForm.description}
                    onChange={(description) => setProductForm({ ...productForm, description })}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="h-10 rounded px-4 text-sm text-ink-muted hover:bg-cream" onClick={() => setProductFormOpen(false)} disabled={savingProduct}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-60" disabled={savingProduct}>
                  {savingProduct && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save and add to quote
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
