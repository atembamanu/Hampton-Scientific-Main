import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, Pencil, Plus, Trash2, Upload, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmProvider';
import { FeaturedStarButton } from '../../components/admin/FeaturedStarButton';
import { API_URL, mediaUrl } from '../../config/apiBaseUrl';
import { getAdminHeader, canSeeBuyingPrice, getAdminUser } from '../../utils/adminAuth';
import { formatDate } from '../../lib/utils';
import { formatPrice } from '../../utils/pricing';
import { downloadBlob } from '../../utils/csv';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminFilterInput,
  AdminMultiSelect,
  AdminResetFilters,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminListMeta,
  AdminPager,
  AdminTableShell,
} from '../../components/admin/AdminPageHeader';
import { AdminFormModal } from '../../components/admin/AdminFormModal';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { sanitizeHtml } from '../../utils/richText';

const emptyForm = {
  name: '',
  category_id: '',
  price: '',
  buying_price: '',
  package: '',
  stocking_unit: '',
  description: '',
  in_stock: true,
  is_featured: false,
};

const MAX_PRODUCT_IMAGES = 12;

const galleryFromProduct = (product) => {
  const urls = (Array.isArray(product?.images) && product.images.length
    ? product.images
    : (product?.image_url ? [product.image_url] : [])
  ).filter(Boolean);
  return urls.map((url, index) => ({
    id: `${url}-${index}`,
    url,
    file: null,
    preview: mediaUrl(url),
  }));
};

const newGalleryItem = (file) => ({
  id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
  url: '',
  file,
  preview: URL.createObjectURL(file),
});

export const AdminProducts = () => {
  const headers = getAdminHeader();
  const confirm = useConfirm();
  const showBuying = canSeeBuyingPrice(getAdminUser());
  const importRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [stockValues, setStockValues] = useState([]);
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState([]);
  const [saving, setSaving] = useState(false);
  const [starringId, setStarringId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const appliedSearch = useDebouncedValue(search, 300);

  const loadCategories = async () => {
    const res = await axios.get(`${API_URL}/api/admin/categories`, {
      headers,
      params: { for_select: true },
    });
    setCategories(Array.isArray(res.data) ? res.data : (res.data.items || []));
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (categoryIds.length) params.category_id = categoryIds.join(',');
      if (stockValues.includes('in') && !stockValues.includes('out')) params.in_stock = true;
      if (stockValues.includes('out') && !stockValues.includes('in')) params.in_stock = false;
      if (sort) params.sort = sort;
      const res = await axios.get(`${API_URL}/api/admin/products`, { headers, params });
      const data = res.data || {};
      setProducts(data.items || []);
      setMeta({
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories().catch(() => {}); }, []);
  const categoryKey = categoryIds.join(',');
  const stockKey = stockValues.join(',');
  useEffect(() => { load(); }, [page, limit, appliedSearch, categoryKey, stockKey, sort]);
  useEffect(() => { setPage(1); }, [appliedSearch, categoryKey, stockKey, sort]);

  const exportFilterParams = () => {
    const params = {};
    if (appliedSearch.trim()) params.search = appliedSearch.trim();
    if (categoryIds.length) params.category_id = categoryIds.join(',');
    if (stockValues.includes('in') && !stockValues.includes('out')) params.in_stock = true;
    if (stockValues.includes('out') && !stockValues.includes('in')) params.in_stock = false;
    return params;
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/products/export`, {
        headers,
        params: exportFilterParams(),
        responseType: 'blob',
      });
      downloadBlob(res.data, 'products.csv');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/api/admin/products/import`, body, { headers });
      const extra = res.data.errors?.length ? ` ${res.data.errors.length} row error(s).` : '';
      toast.success(`Imported ${res.data.created} new, updated ${res.data.updated}.${extra}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, category_id: categories[0]?.category_id || '' });
    setGallery([]);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditingId(product.product_id);
    setForm({
      name: product.name || '',
      category_id: product.category_id || '',
      price: product.price ?? '',
      buying_price: product.buying_price ?? '',
      package: product.package || '',
      stocking_unit: product.stocking_unit || '',
      description: product.description || '',
      in_stock: Boolean(product.in_stock),
      is_featured: Boolean(product.is_featured),
    });
    setGallery(galleryFromProduct(product));
    setShowForm(true);
  };

  const uploadImage = async (file) => {
    const body = new FormData();
    body.append('file', file);
    const res = await axios.post(`${API_URL}/api/admin/products/upload-image`, body, { headers });
    return res.data.image_url;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category_id) {
      toast.error('Name and category are required');
      return;
    }
    setSaving(true);
    try {
      const images = [];
      for (const item of gallery) {
        if (item.file) images.push(await uploadImage(item.file));
        else if (item.url) images.push(item.url);
      }
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id,
        price: Number(form.price) || 0,
        package: form.package,
        stocking_unit: form.stocking_unit,
        description: sanitizeHtml(form.description),
        in_stock: form.in_stock,
        is_featured: Boolean(form.is_featured),
        images,
        image_url: images[0] || '',
      };
      if (showBuying) payload.buying_price = Number(form.buying_price) || 0;
      if (editingId) {
        await axios.put(`${API_URL}/api/admin/products/${editingId}`, payload, { headers });
        toast.success('Product updated');
      } else {
        await axios.post(`${API_URL}/api/admin/products`, payload, { headers });
        toast.success('Product created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (product) => {
    if (starringId) return;
    const next = !product.is_featured;
    setStarringId(product.product_id);
    try {
      await axios.patch(
        `${API_URL}/api/admin/products/${product.product_id}/featured`,
        { is_featured: next },
        { headers },
      );
      setProducts((prev) => prev.map((row) => (
        row.product_id === product.product_id ? { ...row, is_featured: next } : row
      )));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update featured status');
    } finally {
      setStarringId(null);
    }
  };

  const handleDelete = async (product) => {
    const approved = await confirm({
      label: 'Delete product',
      title: `Delete ${product.name}?`,
      description: 'This removes the product from the catalogue. Quotes that already include it are not changed.',
      confirmLabel: 'Delete product',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.delete(`${API_URL}/api/admin/products/${product.product_id}`, { headers });
      toast.success('Product deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    const approved = await confirm({
      label: 'Delete all products',
      title: 'Delete every product?',
      description: 'This permanently removes every product from the catalogue, including products hidden by the current filters. Quotes that already include them are not changed.',
      confirmLabel: 'Delete all products',
      tone: 'danger',
    });
    if (!approved) return;
    setDeletingAll(true);
    try {
      const res = await axios.delete(`${API_URL}/api/admin/products`, { headers });
      const deleted = res.data?.deleted ?? 0;
      toast.success(deleted ? `Deleted ${deleted} products` : 'No products to delete');
      if (page !== 1) setPage(1);
      else load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    } finally {
      setDeletingAll(false);
    }
  };

  const filtersActive = Boolean(search.trim() || categoryIds.length || stockValues.length);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Products"
        label="Catalogue"
        actions={(
          <>
            <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
            <button type="button" onClick={() => importRef.current?.click()} className="h-10 px-3 border border-ink/15 rounded-lg text-sm inline-flex items-center gap-2 bg-white">
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button type="button" onClick={handleExport} className="h-10 px-3 border border-ink/15 rounded-lg text-sm inline-flex items-center gap-2 bg-white">
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={deletingAll || (!loading && !search.trim() && !categoryIds.length && !stockValues.length && meta.total === 0)}
              className="h-10 px-3 border border-red-200 text-red-700 rounded-lg text-sm inline-flex items-center gap-2 bg-white hover:bg-red-50 disabled:opacity-40"
            >
              {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete all
            </button>
            <button type="button" onClick={openCreate} className="btn-primary h-10 px-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add product
            </button>
          </>
        )}
      />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, package…"
          className="w-full"
        />
        <AdminMultiSelect
          value={categoryIds}
          onChange={setCategoryIds}
          placeholder="All categories"
          options={categories.map((c) => ({ value: String(c.category_id), label: c.name }))}
        />
        <AdminMultiSelect
          value={stockValues}
          onChange={setStockValues}
          placeholder="All stock"
          options={[
            { value: 'in', label: 'In stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
        <AdminResetFilters
          disabled={!filtersActive}
          onReset={() => {
            setSearch('');
            setCategoryIds([]);
            setStockValues([]);
            setPage(1);
          }}
        />
      </AdminFilterBar>
      <p className="text-xs text-ink-faint -mt-4 mb-4">
        Import CSV columns: product_id, name, category_id, price, package, stocking_unit, in_stock
        {showBuying ? ', buying_price' : ''}.
      </p>

      <AdminFormModal
        open={showForm}
        onOpenChange={(open) => { if (!open && !saving) setShowForm(false); }}
        wide
        title={editingId ? 'Edit product' : 'New product'}
        description={editingId ? 'Update this catalogue product.' : 'Create a new product. The product ID is assigned automatically.'}
      >
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4 pt-2">
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Category</span>
            <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm">
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">List price</span>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          {showBuying && (
            <label className="text-sm">
              <span className="block text-xs text-ink-muted mb-1">Buying price</span>
              <input type="number" min="0" step="0.01" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
            </label>
          )}
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Package</span>
            <input value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Stocking unit</span>
            <input value={form.stocking_unit} onChange={(e) => setForm({ ...form, stocking_unit: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Description</span>
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
            />
          </div>
          <div className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Images</span>
            <p className="text-xs text-ink-faint mb-3">
              Add up to {MAX_PRODUCT_IMAGES} images. The first image is shown in the products table and catalogue cards.
            </p>
            <div className="flex flex-wrap gap-3 mb-3">
              {gallery.map((item, index) => (
                <div key={item.id} className="relative w-24">
                  <img
                    src={item.preview}
                    alt=""
                    className="w-24 h-24 object-cover border border-ink/10 rounded"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 text-[10px] font-medium bg-ink text-white px-1.5 py-0.5 rounded">
                      First
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-1 gap-1">
                    <button
                      type="button"
                      className="form-field h-7 w-7 inline-flex items-center justify-center border border-ink/15 bg-white disabled:opacity-30"
                      aria-label="Move image left"
                      disabled={index === 0}
                      onClick={() => setGallery((prev) => {
                        const next = [...prev];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="form-field h-7 w-7 inline-flex items-center justify-center border border-ink/15 bg-white disabled:opacity-30"
                      aria-label="Move image right"
                      disabled={index === gallery.length - 1}
                      onClick={() => setGallery((prev) => {
                        const next = [...prev];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        return next;
                      })}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="form-field h-7 w-7 inline-flex items-center justify-center border border-ink/15 bg-white text-ink-muted"
                      aria-label="Remove image"
                      onClick={() => setGallery((prev) => {
                        const target = prev[index];
                        if (target?.preview?.startsWith('blob:')) URL.revokeObjectURL(target.preview);
                        return prev.filter((_, i) => i !== index);
                      })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {index !== 0 && (
                    <button
                      type="button"
                      className="form-field mt-1 w-full h-7 text-[11px] border border-ink/15 bg-white inline-flex items-center justify-center gap-1"
                      onClick={() => setGallery((prev) => {
                        const next = [...prev];
                        const [picked] = next.splice(index, 1);
                        next.unshift(picked);
                        return next;
                      })}
                    >
                      <Star className="w-3 h-3" /> Make first
                    </button>
                  )}
                </div>
              ))}
              {gallery.length === 0 && (
                <div className="w-24 h-24 border border-dashed border-ink/20 rounded bg-cream/60" />
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                if (!files.length) return;
                setGallery((prev) => {
                  const room = MAX_PRODUCT_IMAGES - prev.length;
                  if (room <= 0) {
                    toast.error(`You can add up to ${MAX_PRODUCT_IMAGES} images`);
                    return prev;
                  }
                  return [...prev, ...files.slice(0, room).map(newGalleryItem)];
                });
              }}
              className="text-sm"
            />
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.in_stock} onChange={(e) => setForm({ ...form, in_stock: e.target.checked })} />
            In stock
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            Featured on the homepage
          </label>
          <div className="sm:col-span-2 flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary h-9 px-4 text-sm inline-flex items-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create product'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 text-sm border border-ink/15 rounded">Cancel</button>
          </div>
        </form>
      </AdminFormModal>

      <AdminTableShell loading={loading} hasRows={products.length > 0} empty="No products found.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="products" />
        <AdminDataTable minWidth={1280}>
          <AdminTableHead>
            <AdminTableTh>
              <button
                type="button"
                onClick={() => setSort((current) => (current === 'id_asc' ? 'id_desc' : 'id_asc'))}
                className="inline-flex items-center gap-1"
                aria-label={sort === 'id_desc' ? 'Sorting by ID, high to low' : 'Sort by ID'}
              >
                ID
                {sort === 'id_desc' ? <ArrowDown className="w-3 h-3" /> : sort === 'id_asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-40" />}
              </button>
            </AdminTableTh>
            <AdminTableTh>Product</AdminTableTh>
            <AdminTableTh>Category</AdminTableTh>
            <AdminTableTh>List price</AdminTableTh>
            {showBuying && <AdminTableTh>Buying</AdminTableTh>}
            <AdminTableTh>Package</AdminTableTh>
            <AdminTableTh>Stock</AdminTableTh>
            <AdminTableTh>Created</AdminTableTh>
            <AdminTableTh>Modified</AdminTableTh>
            <AdminTableTh className="text-right">Actions</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {products.map((p) => (
              <AdminTableRow key={p.id}>
                <AdminTableTd nowrap className="text-ink-muted">{p.product_id}</AdminTableTd>
                <AdminTableTd>
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image_url || (p.images && p.images[0]) ? (
                      <div className="relative shrink-0">
                        <img src={mediaUrl(p.image_url || p.images[0])} alt="" className="w-10 h-10 object-cover border border-ink/10 rounded" />
                        {Array.isArray(p.images) && p.images.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 text-[9px] leading-4 text-center bg-ink text-white rounded-full">
                            {p.images.length}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 border border-dashed border-ink/15 rounded bg-cream/60 shrink-0" />
                    )}
                    <FeaturedStarButton
                      featured={p.is_featured}
                      disabled={starringId === p.product_id}
                      name={p.name}
                      onClick={() => toggleFeatured(p)}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="font-semibold text-brand hover:text-copper hover:underline text-left truncate"
                    >
                      {p.name}
                    </button>
                  </div>
                </AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{p.category_name}</AdminTableTd>
                <AdminTableTd nowrap>{formatPrice(p.price)}</AdminTableTd>
                {showBuying && <AdminTableTd nowrap>{formatPrice(p.buying_price)}</AdminTableTd>}
                <AdminTableTd nowrap className="text-ink-muted">{p.package || '—'}</AdminTableTd>
                <AdminTableTd nowrap>
                  <span className={p.in_stock ? 'text-emerald-700' : 'text-red-600'}>{p.in_stock ? 'In stock' : 'Out of stock'}</span>
                </AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{formatDate(p.created_at)}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{formatDate(p.updated_at)}</AdminTableTd>
                <AdminTableTd nowrap className="text-right">
                  <button type="button" onClick={() => openEdit(p)} className="text-xs text-copper hover:underline mr-3 inline-flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(p)} className="text-xs text-ink-muted hover:underline inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
        <AdminPager
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          limit={meta.limit}
          onPage={setPage}
          onLimit={(next) => { setLimit(next); setPage(1); }}
        />
      </AdminTableShell>
    </div>
  );
};
