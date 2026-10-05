import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmProvider';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { PasswordStrength, isPasswordValid } from '../../components/facility/PasswordStrength';
import { emailError, phoneError, liveEmailError, livePhoneError } from '../../utils/validation';
import { formatPrice } from '../../utils/pricing';
import { AdminFormModal } from '../../components/admin/AdminFormModal';
import { RowActionsMenu } from '../../components/RowActionsMenu';
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
  AdminEmptyState,
  AdminLoadingState,
  AdminListMeta,
  AdminPager,
} from '../../components/admin/AdminPageHeader';

const ROLE_LABELS = { sales: 'Sales', operations: 'Operations', admin: 'Global Admin' };

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'sales',
  password: '',
  monthlyTarget: '',
  commissionRate: '1.5',
  counties: [],
};

const fieldClass = 'w-full h-10 px-3 border border-ink/15 rounded-lg text-sm bg-white';

export const AdminCompanyStaff = () => {
  const headers = getAdminHeader();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [countyOptions, setCountyOptions] = useState([]);
  const [countySearch, setCountySearch] = useState('');
  const editToken = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/company-staff`, { headers });
      setUsers(res.data.users || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load company staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/field/counties`, { headers })
      .then((res) => setCountyOptions(res.data.counties || []))
      .catch(() => setCountyOptions([]));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setCountySearch('');
    setFormOpen(true);
  };

  const openEdit = async (member) => {
    const token = ++editToken.current;
    setEditing(member);
    setCountySearch('');
    setForm({
      ...emptyForm,
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'sales',
      counties: member.counties || [],
      monthlyTarget: member.monthlyTarget ? String(member.monthlyTarget) : '',
      commissionRate: member.commissionRate != null ? String(member.commissionRate) : '1.5',
    });
    setFormOpen(true);
    if (member.role === 'sales') {
      try {
        const current = await axios.get(`${API_URL}/api/admin/field/agents/${member.id}/target`, { headers });
        if (token !== editToken.current) return;
        setForm((prev) => ({
          ...prev,
          monthlyTarget: current.data.monthlyTarget ? String(current.data.monthlyTarget) : '',
          commissionRate: current.data.commissionRate != null ? String(current.data.commissionRate) : '1.5',
          counties: member.counties || [],
        }));
      } catch {
        /* the list already has the target amount and band */
      }
    }
  };

  const toggleCounty = (county) => {
    setForm((current) => ({
      ...current,
      counties: current.counties.includes(county)
        ? current.counties.filter((item) => item !== county)
        : [...current.counties, county],
    }));
  };

  const saveSalesProfile = async (userId) => {
    await axios.put(
      `${API_URL}/api/admin/field/agents/${userId}/target`,
      { monthlyTarget: Number(form.monthlyTarget || 0), commissionRate: Number(form.commissionRate || 1.5) },
      { headers },
    );
    await axios.put(
      `${API_URL}/api/admin/field/agents/${userId}/counties`,
      { counties: form.counties },
      { headers },
    );
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const invalidEmail = emailError(form.email);
    const invalidPhone = phoneError(form.phone, { required: false });
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    if (!editing && !isPasswordValid(form.password)) {
      toast.error('Set a password that meets all requirements');
      return;
    }
    if (editing && form.password && !isPasswordValid(form.password)) {
      toast.error('Set a password that meets all requirements');
      return;
    }
    if (form.role === 'sales') {
      const rate = Number(form.commissionRate);
      if (Number.isNaN(rate) || rate < 0 || rate > 100) {
        toast.error('Commission must be a number between 0 and 100');
        return;
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const payload = {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await axios.put(`${API_URL}/api/admin/company-staff/${editing.id}`, payload, { headers });
        if (form.role === 'sales') await saveSalesProfile(editing.id);
        toast.success('Staff member updated');
      } else {
        const res = await axios.post(`${API_URL}/api/admin/company-staff`, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
        }, { headers });
        if (form.role === 'sales') await saveSalesProfile(res.data.user.id);
        toast.success('Staff member created — share the login details with them');
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save this staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    if (!isPasswordValid(resetPassword)) {
      toast.error('Password must meet all requirements');
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/admin/company-staff/${resetUser.id}`,
        { password: resetPassword },
        { headers },
      );
      toast.success(`Password updated for ${resetUser.firstName}`);
      setResetUser(null);
      setResetPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    const next = !user.can_login;
    const name = `${user.firstName} ${user.lastName}`.trim();
    const approved = await confirm(next
      ? {
        label: 'Reactivate staff',
        title: `Reactivate ${name}?`,
        description: 'They will be able to sign in to the operations portal again with their existing password.',
        confirmLabel: 'Reactivate',
      }
      : {
        label: 'Deactivate staff',
        title: `Deactivate ${name}?`,
        description: 'They will be signed out of the operations portal and will not be able to sign in until you reactivate them.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
    if (!approved) return;
    try {
      if (next) {
        await axios.put(`${API_URL}/api/admin/company-staff/${user.id}`, { can_login: true }, { headers });
      } else {
        await axios.post(`${API_URL}/api/admin/company-staff/${user.id}/deactivate`, {}, { headers });
      }
      toast.success(next ? 'Staff reactivated' : 'Staff deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  };

  const removeUser = async (user) => {
    const name = `${user.firstName} ${user.lastName}`.trim();
    const approved = await confirm({
      label: 'Delete staff',
      title: `Delete ${name}?`,
      description: 'This removes their login. Someone with field visits or registered facilities cannot be deleted — deactivate them instead.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.delete(`${API_URL}/api/admin/company-staff/${user.id}`, { headers });
      toast.success('Staff member deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete this staff member');
    }
  };

  const q = search.trim().toLowerCase();
  const filteredStaff = users.filter((u) => {
    const matchesSearch = !q || [u.firstName, u.lastName, u.email, u.phone, ...(u.counties || [])].some((v) =>
      String(v || '').toLowerCase().includes(q)
    );
    const matchesRole = !roleFilter.length || roleFilter.includes(u.role);
    return matchesSearch && matchesRole;
  });
  const pages = Math.max(1, Math.ceil(filteredStaff.length / limit));
  const currentPage = Math.min(page, pages);
  const visibleStaff = filteredStaff.slice((currentPage - 1) * limit, currentPage * limit);
  const visibleCounties = countyOptions.filter((county) => county.toLowerCase().includes(countySearch.trim().toLowerCase()));

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Company users"
        label="Administration"
        description="Add Sales, Operations, and Global Admin staff for the Hampton company portal."
        actions={(
          <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm">
            <Plus className="w-4 h-4" /> Add staff
          </button>
        )}
      />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, email, phone…"
          className="w-full"
        />
        <AdminMultiSelect
          value={roleFilter}
          onChange={(values) => { setRoleFilter(values); setPage(1); }}
          placeholder="All roles"
          options={[
            { value: 'sales', label: 'Sales' },
            { value: 'operations', label: 'Operations' },
            { value: 'admin', label: 'Global Admin' },
          ]}
        />
        <AdminResetFilters
          disabled={!search.trim() && !roleFilter.length}
          onReset={() => { setSearch(''); setRoleFilter([]); setPage(1); }}
        />
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState />
      ) : users.length === 0 ? (
        <AdminEmptyState>No company staff yet.</AdminEmptyState>
      ) : filteredStaff.length === 0 ? (
        <AdminEmptyState>No staff match these filters.</AdminEmptyState>
      ) : (
        <>
        <AdminListMeta total={filteredStaff.length} page={currentPage} limit={limit} noun="users" />
        <AdminDataTable minWidth={1100}>
          <AdminTableHead>
            <AdminTableTh>Name</AdminTableTh>
            <AdminTableTh>Email</AdminTableTh>
            <AdminTableTh>Role</AdminTableTh>
            <AdminTableTh>Status</AdminTableTh>
            <AdminTableTh>Target</AdminTableTh>
            <AdminTableTh>% Commission</AdminTableTh>
            <AdminTableTh>Region</AdminTableTh>
            <AdminTableTh className="text-right"> </AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {visibleStaff.map((u) => (
              <AdminTableRow key={u.id}>
                <AdminTableTd>
                  <button type="button" onClick={() => openEdit(u)} className="font-medium text-left hover:text-copper hover:underline">
                    {u.firstName} {u.lastName}
                  </button>
                </AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{u.email}</AdminTableTd>
                <AdminTableTd nowrap>{ROLE_LABELS[u.role] || u.role}</AdminTableTd>
                <AdminTableTd nowrap>
                  <span className={`text-xs font-medium ${u.can_login ? 'text-emerald-700' : 'text-red-600'}`}>
                    {u.can_login ? 'Active' : 'Inactive'}
                  </span>
                </AdminTableTd>
                <AdminTableTd nowrap className="tabular-nums">
                  {u.role === 'sales' && u.monthlyTarget ? formatPrice(u.monthlyTarget) : '—'}
                </AdminTableTd>
                <AdminTableTd nowrap>
                  {u.role === 'sales' && u.commissionRate != null ? `${u.commissionRate}%` : '—'}
                </AdminTableTd>
                <AdminTableTd className="max-w-[220px]">
                  <span className="line-clamp-2">{u.role === 'sales' && u.counties?.length ? u.counties.join(', ') : '—'}</span>
                </AdminTableTd>
                <AdminTableTd nowrap className="text-right">
                  <RowActionsMenu
                    label={`Actions for ${u.firstName}`}
                    items={[
                      { label: 'Reset password', onSelect: () => { setResetUser(u); setResetPassword(''); } },
                      { label: u.can_login ? 'Deactivate user' : 'Reactivate user', onSelect: () => toggleActive(u) },
                      { label: 'Delete user', onSelect: () => removeUser(u) },
                    ]}
                  />
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
        <AdminPager
          page={currentPage}
          pages={pages}
          total={filteredStaff.length}
          limit={limit}
          onPage={setPage}
          onLimit={(next) => { setLimit(next); setPage(1); }}
        />
        </>
      )}

      <AdminFormModal
        open={formOpen}
        onOpenChange={(open) => { if (!open) { editToken.current += 1; setFormOpen(false); } }}
        title={editing ? 'Edit staff' : 'Add staff'}
        description={editing ? 'Update this person’s details. Sales agents can also have a target, commission, and regions.' : 'They will sign in at the operations portal with the email and password you set.'}
        wide
      >
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4 mt-4">
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">First name</span>
            <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Last name</span>
            <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">Email</span>
            <input required type="email" disabled={Boolean(editing)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${fieldClass} ${liveEmailError(form.email) ? 'border-red-400' : ''}`} />
            {liveEmailError(form.email) && <p className="text-xs text-red-600 mt-1">{liveEmailError(form.email)}</p>}
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Phone</span>
            <input value={form.phone} type="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${fieldClass} ${livePhoneError(form.phone) ? 'border-red-400' : ''}`} />
            {livePhoneError(form.phone) && <p className="text-xs text-red-600 mt-1">{livePhoneError(form.phone)}</p>}
          </label>
          <label className="text-sm">
            <span className="block text-xs text-ink-muted mb-1">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fieldClass}>
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
              <option value="admin">Global Admin</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs text-ink-muted mb-1">{editing ? 'New password (leave blank to keep the current one)' : 'Initial password'}</span>
            <input type="password" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={fieldClass} />
            {form.password ? <PasswordStrength password={form.password} /> : null}
          </label>
          {form.role === 'sales' && (
            <>
              <label className="text-sm">
                <span className="block text-xs text-ink-muted mb-1">Monthly target (KES)</span>
                <input type="number" min="0" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} className={fieldClass} />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-ink-muted mb-1">Commission %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <div className="sm:col-span-2">
                <span className="block text-xs text-ink-muted mb-1">Regions</span>
                <input value={countySearch} onChange={(e) => setCountySearch(e.target.value)} placeholder="Search counties" className={`${fieldClass} mb-2`} />
                <div className="max-h-40 overflow-y-auto border border-ink/10 rounded-lg p-2 grid sm:grid-cols-2 gap-1">
                  {visibleCounties.map((county) => (
                    <label key={county} className="flex items-center gap-2 text-sm px-2 py-1">
                      <input type="checkbox" checked={form.counties.includes(county)} onChange={() => toggleCounty(county)} />
                      {county}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-muted mt-1">{form.counties.length} selected</p>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save staff' : 'Create staff member'}
            </button>
          </div>
        </form>
      </AdminFormModal>

      <AdminFormModal
        open={Boolean(resetUser)}
        onOpenChange={(open) => { if (!open) { setResetUser(null); setResetPassword(''); } }}
        title={`Reset password for ${resetUser?.firstName || ''} ${resetUser?.lastName || ''}`.trim()}
      >
        <form onSubmit={handleReset} className="space-y-3 mt-4">
          <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className={fieldClass} />
          <PasswordStrength password={resetPassword} />
          <button type="submit" disabled={saving} className="btn-primary h-9 px-4 text-sm disabled:opacity-60">Save password</button>
        </form>
      </AdminFormModal>
    </div>
  );
};
