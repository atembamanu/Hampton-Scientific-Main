import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmProvider';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
  FacilityListMeta,
  FacilityPager,
} from '../../components/facility/FacilityListControls';
import { API_URL } from '../../config/apiBaseUrl';
import { AdminFormModal } from '../../components/admin/AdminFormModal';
import { EditorialField } from '../../components/template/EditorialSection';
import { PasswordStrength, isPasswordValid } from '../../components/facility/PasswordStrength';
import { emailError, phoneError, liveEmailError, livePhoneError, invalidFieldClass } from '../../utils/validation';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../components/ui/dialog';

export const Users = () => {
  const { getAuthHeader, branches, user: currentUser } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const emptyForm = {
    firstName: '', lastName: '', email: '', phone: '', jobTitle: '',
    role: 'branch_user', branchIds: [], password: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const load = async () => {
    const res = await axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() });
    setUsers(res.data);
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

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      jobTitle: user.jobTitle || '',
      role: user.role === 'branch_admin' ? 'branch_admin' : 'branch_user',
      branchIds: user.branchIds || (user.branches || []).map((b) => b.id),
      password: '',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing && !isPasswordValid(form.password)) {
      toast.error('Set a password that meets all requirements — share it with the user');
      return;
    }
    if (form.branchIds.length === 0) {
      toast.error('Assign at least one branch');
      return;
    }
    const invalidPhone = phoneError(form.phone);
    if (invalidPhone) { toast.error(invalidPhone); return; }
    if (!editing) {
      const invalidEmail = emailError(form.email);
      if (invalidEmail) { toast.error(invalidEmail); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/users/${editing.id}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          jobTitle: form.jobTitle,
          role: form.role,
          branchIds: form.branchIds,
        }, { headers: getAuthHeader() });
        toast.success('User updated');
      } else {
        await axios.post(`${API_URL}/api/users`, form, { headers: getAuthHeader() });
        toast.success('User created — share the login email and password with them');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || (editing ? 'Failed to update user' : 'Failed to create user'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid(resetPassword)) {
      toast.error('Password must meet all requirements');
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/users/${resetUser.id}`,
        { password: resetPassword },
        { headers: getAuthHeader() },
      );
      toast.success(`Password updated for ${resetUser.firstName} — share the new password with them`);
      setResetUser(null);
      setResetPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const userName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

  const deactivateUser = async (user) => {
    const approved = await confirm({
      label: 'Deactivate user',
      title: `Deactivate ${userName(user)}?`,
      description: 'They will be signed out and will not be able to sign in until a facility admin reactivates the account. Their quotes and orders stay on record.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.post(`${API_URL}/api/users/${user.id}/deactivate`, {}, { headers: getAuthHeader() });
      toast.success('User deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const reactivateUser = async (user) => {
    const approved = await confirm({
      label: 'Reactivate user',
      title: `Reactivate ${userName(user)}?`,
      description: 'They will be able to sign in again with their existing password.',
      confirmLabel: 'Reactivate',
    });
    if (!approved) return;
    try {
      await axios.post(`${API_URL}/api/users/${user.id}/activate`, {}, { headers: getAuthHeader() });
      toast.success('User reactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reactivate user');
    }
  };

  const deleteUser = async (user) => {
    const approved = await confirm({
      label: 'Delete user',
      title: `Delete ${userName(user)}?`,
      description: 'This removes their login. Someone with quotes, orders, or invoices cannot be deleted — deactivate them instead.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.delete(`${API_URL}/api/users/${user.id}`, { headers: getAuthHeader() });
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete this user');
    }
  };

  const toggleBranch = (id) => {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id],
    }));
  };

  if (loading) return <p className="text-ink-muted text-sm">Loading users…</p>;

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    const matchesSearch = !q || [u.firstName, u.lastName, u.email].some((v) =>
      String(v || '').toLowerCase().includes(q)
    ) || (u.branches || []).some((b) => String(b.name || '').toLowerCase().includes(q));
    const matchesRole = roleFilter.length === 0 || roleFilter.includes(u.role);
    return matchesSearch && matchesRole;
  });
  const pages = Math.max(1, Math.ceil(filteredUsers.length / limit));
  const currentPage = Math.min(page, pages);
  const visibleUsers = filteredUsers.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <p className="editorial-label mb-2">Team</p>
          <h1 className="app-page-title">Users</h1>
          <p className="text-sm text-ink-muted mt-2 max-w-lg">
            Create branch managers and personnel with a login password you set and share with them.
            Branch personnel cannot change their own profile or password — update those details here.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add user
        </button>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, email, branch…"
        />
        <FacilityMultiSelect
          value={roleFilter}
          onChange={(values) => { setRoleFilter(values); setPage(1); }}
          options={[
            { value: 'org_admin', label: 'Org admin' },
            { value: 'branch_admin', label: 'Branch manager' },
            { value: 'branch_user', label: 'Branch personnel' },
          ]}
          placeholder="All roles"
          searchPlaceholder="Search role…"
        />
        <FacilityResetFilters
          disabled={!search.trim() && roleFilter.length === 0}
          onReset={() => { setSearch(''); setRoleFilter([]); setPage(1); }}
        />
      </FacilityFilterBar>

      {users.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No users yet.</div>
      ) : filteredUsers.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No users match these filters.</div>
      ) : (
      <>
      <FacilityListMeta total={filteredUsers.length} page={currentPage} limit={limit} noun="users" />
      <div className="editorial-panel overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm" style={{ minWidth: '760px' }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Branches</th>
              <th className="px-5 py-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isOrgAdmin = currentUser?.role === 'org_admin';
              const canEdit = !isSelf && (u.role === 'branch_admin' || u.role === 'branch_user');
              return (
              <tr key={u.id} className={`border-b border-ink/5 ${!u.canLogin ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-5 py-3 text-ink-muted">{u.email}</td>
                <td className="px-5 py-3 capitalize text-ink-muted">{u.role?.replace(/_/g, ' ')}</td>
                <td className="px-5 py-3 text-ink-muted text-xs">{u.branches?.map((b) => b.name).join(', ') || '—'}</td>
                <td className="px-5 py-3 text-right">
                  <RowActionsMenu
                    label={`Actions for ${u.firstName || 'user'}`}
                    items={[
                      canEdit ? { label: 'Edit user', onSelect: () => openEdit(u) } : null,
                      !isSelf && u.canLogin ? { label: 'Reset password', onSelect: () => { setResetUser(u); setResetPassword(''); } } : null,
                      isOrgAdmin && !isSelf && u.canLogin ? { label: 'Deactivate user', onSelect: () => deactivateUser(u) } : null,
                      isOrgAdmin && !isSelf && !u.canLogin ? { label: 'Reactivate user', onSelect: () => reactivateUser(u) } : null,
                      isOrgAdmin && !isSelf ? { label: 'Delete user', onSelect: () => deleteUser(u) } : null,
                    ]}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <FacilityPager
          page={currentPage}
          pages={pages}
          total={filteredUsers.length}
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
        wide
        title={editing ? 'Edit user' : 'New user'}
        description={editing
          ? 'Update this person’s profile. Branch personnel cannot change these details themselves.'
          : 'Create a login and share the password with them. It is not emailed automatically.'}
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <EditorialField label="First name" required><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></EditorialField>
            <EditorialField label="Last name" required><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></EditorialField>
          </div>
          <EditorialField label="Login email" required error={editing ? undefined : liveEmailError(form.email)}>
            <Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editing} className={invalidFieldClass(editing ? undefined : liveEmailError(form.email))} />
          </EditorialField>
          <EditorialField label="Phone" required error={livePhoneError(form.phone)}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className={invalidFieldClass(livePhoneError(form.phone))} />
          </EditorialField>
          <EditorialField label="Job title"><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></EditorialField>
          {!editing && (
            <EditorialField label="Initial password" required>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <PasswordStrength password={form.password} />
              <p className="text-[11px] text-ink-faint mt-1">You provide this password to the user — it is not emailed automatically.</p>
            </EditorialField>
          )}
          <EditorialField label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-ink/15 text-sm">
              {currentUser?.role === 'org_admin' && <option value="branch_admin">Branch manager</option>}
              <option value="branch_user">Branch personnel</option>
            </select>
          </EditorialField>
          <EditorialField label="Assign branches" required>
            <div className="flex flex-wrap gap-2">
              {branches.filter((b) => b.status !== 'inactive' || form.branchIds.includes(b.id)).map((b) => (
                <label key={b.id} className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${form.branchIds.includes(b.id) ? 'border-copper bg-copper/10 text-copper' : 'border-ink/15'}`}>
                  <input type="checkbox" className="sr-only" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
          </EditorialField>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Save changes' : 'Create user'}
            </button>
            <button type="button" onClick={closeForm} className="h-10 px-4 text-sm border border-ink/15 rounded">Cancel</button>
          </div>
        </form>
      </AdminFormModal>

      <Dialog open={!!resetUser} onOpenChange={() => { setResetUser(null); setResetPassword(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.firstName} {resetUser?.lastName}. Share it with them directly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <EditorialField label="New password" required>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required />
              <PasswordStrength password={resetPassword} />
            </EditorialField>
            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
