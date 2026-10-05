import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmProvider';
import { FeaturedStarButton } from '../../components/admin/FeaturedStarButton';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { formatDate } from '../../lib/utils';
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
import { NAV_GROUPS, navGroupLabel } from '../../utils/navGroups';

const emptyForm = { name: '', description: '', nav_group: 'other', is_featured: false };

export const AdminCategories = () => {
  const headers = getAdminHeader();
  const confirm = useConfirm();
  const importRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasProducts, setHasProducts] = useState([]);
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [starringId, setStarringId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const appliedSearch = useDebouncedValue(search, 300);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (hasProducts.length === 1 && hasProducts[0] === 'yes') params.has_products = true;
      if (hasProducts.length === 1 && hasProducts[0] === 'no') params.has_products = false;
      if (sort) params.sort = sort;
      const res = await axios.get(`${API_URL}/api/admin/categories`, { headers, params });
      const data = res.data || {};
      setRows(data.items || []);
      setMeta({
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load categories');
    } finally {
      setLoading(false);
    }
  };

  const hasProductsKey = hasProducts.join(',');
  useEffect(() => { load(); }, [page, limit, appliedSearch, hasProductsKey, sort]);
  useEffect(() => { setPage(1); }, [appliedSearch, hasProductsKey, sort]);

  const handleExport = async () => {
    try {
      const params = {};
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (hasProducts.length === 1 && hasProducts[0] === 'yes') params.has_products = true;
      if (hasProducts.length === 1 && hasProducts[0] === 'no') params.has_products = false;
      const res = await axios.get(`${API_URL}/api/admin/categories/export`, {
        headers,
        params,
        responseType: 'blob',
      });
      downloadBlob(res.data, 'categories.csv');
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
      const res = await axios.post(`${API_URL}/api/admin/categories/import`, body, { headers });
      toast.success(`Imported ${res.data.created} new, updated ${res.data.updated}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.category_id);
    setForm({
      name: row.name || '',
      description: row.description || '',
      nav_group: row.nav_group || 'other',
      is_featured: Boolean(row.is_featured),
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description,
      nav_group: form.nav_group || 'other',
      is_featured: Boolean(form.is_featured),
    };
    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/admin/categories/${editingId}`, payload, { headers });
        toast.success('Category updated');
      } else {
        await axios.post(`${API_URL}/api/admin/categories`, payload, { headers });
        toast.success('Category created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (row) => {
    if (starringId) return;
    const next = !row.is_featured;
    setStarringId(row.category_id);
    try {
      await axios.patch(
        `${API_URL}/api/admin/categories/${row.category_id}/featured`,
        { is_featured: next },
        { headers },
      );
      setRows((prev) => prev.map((item) => (
        item.category_id === row.category_id ? { ...item, is_featured: next } : item
      )));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update featured status');
    } finally {
      setStarringId(null);
    }
  };

  const handleDelete = async (row) => {
    const approved = await confirm({
      label: 'Delete category',
      title: `Delete ${row.name}?`,
      description: row.product_count
        ? 'This category still has products. Move or delete those products before the category can be removed.'
        : 'This removes the category from the catalogue. Products are not deleted.',
      confirmLabel: 'Delete category',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.delete(`${API_URL}/api/admin/categories/${row.category_id}`, { headers });
      toast.success('Category deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    const approved = await confirm({
      label: 'Delete all categories',
      title: 'Delete every category?',
      description: 'This permanently removes every category from the catalogue. Delete all products first if any category still has products.',
      confirmLabel: 'Delete all categories',
      tone: 'danger',
    });
    if (!approved) return;
    setDeletingAll(true);
    try {
      const res = await axios.delete(`${API_URL}/api/admin/categories`, { headers });
      const deleted = res.data?.deleted ?? 0;
      toast.success(deleted ? `Deleted ${deleted} categories` : 'No categories to delete');
      if (page !== 1) setPage(1);
      else load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    } finally {
      setDeletingAll(false);
    }
  };

  const filtersActive = Boolean(search.trim() || hasProducts.length);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Categories"
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
              disabled={deletingAll || (!loading && !search.trim() && !hasProducts.length && meta.total === 0)}
              className="h-10 px-3 border border-red-200 text-red-700 rounded-lg text-sm inline-flex items-center gap-2 bg-white hover:bg-red-50 disabled:opacity-40"
            >
              {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete all
            </button>
            <button type="button" onClick={openCreate} className="btn-primary h-10 px-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add category
            </button>
          </>
        )}
      />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="w-full"
        />
        <AdminMultiSelect
          value={hasProducts}
          onChange={setHasProducts}
          placeholder="All categories"
          options={[
            { value: 'yes', label: 'With products' },
            { value: 'no', label: 'Empty' },
          ]}
        />
        <AdminResetFilters
          disabled={!filtersActive}
          onReset={() => {
            setSearch('');
            setHasProducts([]);
            setPage(1);
          }}
        />
      </AdminFilterBar>
      <p className="text-xs text-ink-faint -mt-4 mb-4">
        Import CSV columns: category_id, name, description. Optional nav_group: reagents, equipment, consumables, diagnostics, or other.
      </p>

      <AdminFormModal
        open={showForm}
        onOpenChange={(open) => { if (!open && !saving) setShowForm(false); }}
        title={editingId ? 'Edit category' : 'New category'}
        description={editingId ? 'Update this catalogue category.' : 'Create a new catalogue category. The ID is assigned automatically.'}
      >
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4 pt-2">
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Description</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-10 px-3 border border-ink/15 rounded text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Menu group</span>
            <select
              required
              value={form.nav_group}
              onChange={(e) => setForm({ ...form, nav_group: e.target.value })}
              className="w-full h-10 px-3 border border-ink/15 rounded text-sm bg-white"
            >
              {NAV_GROUPS.map((group) => (
                <option key={group.id} value={group.id}>{group.label}</option>
              ))}
            </select>
            <span className="block text-xs text-ink-faint mt-1">Navbar section for this category. Products in it appear under the same group.</span>
          </label>
          <label className="text-sm sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            Featured in the site carousel
          </label>
          <div className="sm:col-span-2 flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary h-9 px-4 text-sm inline-flex items-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create category'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 text-sm border border-ink/15 rounded">Cancel</button>
          </div>
        </form>
      </AdminFormModal>

      <AdminTableShell loading={loading} hasRows={rows.length > 0} empty="No categories found.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="categories" />
          <AdminDataTable minWidth={1100}>
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
            <AdminTableTh>Category</AdminTableTh>
            <AdminTableTh>Menu group</AdminTableTh>
            <AdminTableTh>Products</AdminTableTh>
            <AdminTableTh>Description</AdminTableTh>
            <AdminTableTh>Created</AdminTableTh>
            <AdminTableTh>Modified</AdminTableTh>
            <AdminTableTh className="text-right">Actions</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {rows.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableTd nowrap className="text-ink-muted">{row.category_id}</AdminTableTd>
                <AdminTableTd>
                  <div className="flex items-center gap-2">
                    <FeaturedStarButton
                      featured={row.is_featured}
                      disabled={starringId === row.category_id}
                      name={row.name}
                      onClick={() => toggleFeatured(row)}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="font-semibold text-brand hover:text-copper hover:underline text-left"
                    >
                      {row.name}
                    </button>
                  </div>
                </AdminTableTd>
                <AdminTableTd nowrap>{navGroupLabel(row.nav_group)}</AdminTableTd>
                <AdminTableTd nowrap>{row.product_count}</AdminTableTd>
                  <AdminTableTd className="text-ink-muted">{row.description || '—'}</AdminTableTd>
                  <AdminTableTd nowrap className="text-ink-muted">{formatDate(row.created_at)}</AdminTableTd>
                  <AdminTableTd nowrap className="text-ink-muted">{formatDate(row.updated_at)}</AdminTableTd>
                <AdminTableTd nowrap className="text-right">
                  <button type="button" onClick={() => openEdit(row)} className="text-xs text-copper hover:underline mr-3 inline-flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(row)} className="text-xs text-ink-muted hover:underline inline-flex items-center gap-1">
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
