import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityResetFilters,
  FacilityListMeta,
  FacilityPager,
} from '../../components/facility/FacilityListControls';
import { API_URL } from '../../config/apiBaseUrl';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { AdminFormModal } from '../../components/admin/AdminFormModal';
import { EditorialField } from '../../components/template/EditorialSection';
import { Input } from '../../components/ui/input';
import { phoneError, livePhoneError, invalidFieldClass } from '../../utils/validation';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';

export const Branches = () => {
  const { getAuthHeader } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivateId, setDeactivateId] = useState(null);
  const emptyForm = { name: '', branchCode: '', physicalAddress: '', county: '', phone: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const load = async () => {
    const res = await axios.get(`${API_URL}/api/branches`, { headers: getAuthHeader() });
    setBranches(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [getAuthHeader]);

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (branch) => {
    setEditing(branch);
    setForm({
      name: branch.name || '',
      branchCode: branch.branchCode || '',
      physicalAddress: branch.physicalAddress || '',
      county: branch.county || '',
      phone: branch.phone || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const invalidPhone = phoneError(form.phone, { required: false });
    if (invalidPhone) { toast.error(invalidPhone); return; }
    const payload = {
      name: form.name,
      branchCode: form.branchCode,
      physicalAddress: form.physicalAddress,
      deliveryAddress: form.physicalAddress,
      county: form.county,
      phone: form.phone,
    };
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/branches/${editing.id}`, payload, { headers: getAuthHeader() });
        toast.success('Branch updated');
      } else {
        await axios.post(`${API_URL}/api/branches`, payload, { headers: getAuthHeader() });
        toast.success('Branch created');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || (editing ? 'Failed to update branch' : 'Failed to create branch'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id, activate) => {
    try {
      await axios.post(`${API_URL}/api/branches/${id}/${activate ? 'activate' : 'deactivate'}`, {}, { headers: getAuthHeader() });
      toast.success(activate ? 'Branch activated' : 'Branch deactivated');
      setDeactivateId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  };

  if (loading) return <p className="text-ink-muted text-sm">Loading branches…</p>;

  const q = search.trim().toLowerCase();
  const filteredBranches = branches.filter((b) =>
    !q || [b.name, b.branchCode, b.county, b.physicalAddress, b.phone].some((v) =>
      String(v || '').toLowerCase().includes(q)
    )
  );
  const pages = Math.max(1, Math.ceil(filteredBranches.length / limit));
  const currentPage = Math.min(page, pages);
  const visibleBranches = filteredBranches.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <p className="editorial-label mb-2">Facility</p>
          <h1 className="app-page-title">Branches</h1>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add branch
        </button>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, code, county…"
        />
        <FacilityResetFilters disabled={!search.trim()} onReset={() => { setSearch(''); setPage(1); }} />
      </FacilityFilterBar>

      {branches.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No branches yet.</div>
      ) : filteredBranches.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No branches match these filters.</div>
      ) : (
        <>
        <FacilityListMeta total={filteredBranches.length} page={currentPage} limit={limit} noun="branches" />
        <div className="editorial-panel overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">County</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBranches.map((b) => (
                <tr key={b.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">{b.name}{b.isMain && <span className="ml-2 text-[10px] text-copper">MAIN</span>}</td>
                  <td className="px-5 py-3 text-ink-muted">{b.branchCode}</td>
                  <td className="px-5 py-3 text-ink-muted">{b.county || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button type="button" onClick={() => openEdit(b)} className="text-xs text-copper hover:underline">Edit</button>
                    {!b.isMain && (
                      b.status === 'active' ? (
                        <button type="button" onClick={() => setDeactivateId(b.id)} className="text-xs text-red-600 hover:underline">Deactivate</button>
                      ) : (
                        <button type="button" onClick={() => toggleStatus(b.id, true)} className="text-xs text-copper hover:underline">Activate</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <FacilityPager
            page={currentPage}
            pages={pages}
            total={filteredBranches.length}
            limit={limit}
            onPage={setPage}
            onLimit={(next) => { setLimit(next); setPage(1); }}
          />
        </div>
        </>
      )}

      <AdminFormModal
        open={showForm}
        onOpenChange={(open) => { if (!open) closeForm(); }}
        title={editing ? 'Edit branch' : 'New branch'}
        description={editing ? 'Update this branch.' : 'Add a branch for this facility.'}
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <EditorialField label="Branch name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></EditorialField>
          <EditorialField label="Branch code" required><Input value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value.toUpperCase() })} required /></EditorialField>
          <EditorialField label="Address" required><Input value={form.physicalAddress} onChange={(e) => setForm({ ...form, physicalAddress: e.target.value })} required /></EditorialField>
          <EditorialField label="County"><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></EditorialField>
          <EditorialField label="Phone" error={livePhoneError(form.phone)}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={invalidFieldClass(livePhoneError(form.phone))} />
          </EditorialField>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Save changes' : 'Save branch'}
            </button>
            <button type="button" onClick={closeForm} className="h-10 px-4 text-sm border border-ink/15 rounded">Cancel</button>
          </div>
        </form>
      </AdminFormModal>

      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              The branch will be hidden when placing orders and quotes. Existing quotes, orders, and assigned users are kept. You can activate it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleStatus(deactivateId, false)}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
