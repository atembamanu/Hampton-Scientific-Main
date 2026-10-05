import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { EditorialField } from '../../components/template/EditorialSection';
import { Input } from '../../components/ui/input';
import { phoneError, livePhoneError, invalidFieldClass } from '../../utils/validation';

const roleLabel = (role) => {
  if (role === 'branch_admin') return 'Branch Manager';
  if (role === 'branch_user') return 'Branch personnel';
  if (role === 'org_admin') return 'Facility Admin';
  return role?.replace(/_/g, ' ') || '';
};

export const FacilityProfile = () => {
  const { user, updateProfile, branches, primaryBranchId } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const branch = branches?.find((b) => b.id === primaryBranchId);
  const readOnly = user?.role === 'branch_user';

  const handleSave = async (e) => {
    e.preventDefault();
    const invalidPhone = phoneError(form.phone);
    if (invalidPhone) { toast.error(invalidPhone); return; }
    setSaving(true);
    const result = await updateProfile(form);
    setSaving(false);
    if (result.success) toast.success('Profile updated');
    else toast.error(result.error);
  };

  return (
    <div>
      <p className="editorial-label mb-2">Account</p>
      <h1 className="app-page-title mb-8">Profile</h1>

      <div className="editorial-panel p-6 max-w-lg mb-6 space-y-2 text-sm">
        <p><span className="text-ink-muted">Email:</span> {user?.email}</p>
        <p><span className="text-ink-muted">Role:</span> {roleLabel(user?.role)}</p>
        {branch && (
          <p><span className="text-ink-muted">Branch:</span> {branch.name} ({branch.branchCode})</p>
        )}
        {user?.organization?.name && (
          <p><span className="text-ink-muted">Facility:</span> {user.organization.name}</p>
        )}
      </div>

      {readOnly ? (
        <div className="editorial-panel p-6 max-w-lg space-y-2 text-sm">
          <p><span className="text-ink-muted">First name:</span> {user?.firstName || '—'}</p>
          <p><span className="text-ink-muted">Last name:</span> {user?.lastName || '—'}</p>
          <p><span className="text-ink-muted">Phone:</span> {user?.phone || '—'}</p>
          <p className="text-ink-muted pt-2">
            Your profile and password are managed by your facility admin. Contact them if these details need to change.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSave} className="editorial-panel p-6 max-w-lg space-y-4">
            <EditorialField label="First name">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </EditorialField>
            <EditorialField label="Last name">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </EditorialField>
            <EditorialField label="Phone" error={livePhoneError(form.phone)}>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={invalidFieldClass(livePhoneError(form.phone))} />
            </EditorialField>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save changes
            </button>
          </form>

          <p className="text-sm text-ink-muted mt-6">
            <Link to="/forgot-password" className="text-copper hover:underline">Reset your password</Link>
            {' '}via email if needed.
          </p>
        </>
      )}
    </div>
  );
};
