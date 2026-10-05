import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiBaseUrl';
import { EditorialField } from '../../components/template/EditorialSection';
import { Input } from '../../components/ui/input';
import { emailError, phoneError, liveEmailError, livePhoneError, invalidFieldClass } from '../../utils/validation';

export const OrganizationSettings = () => {
  const { getAuthHeader, organization } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [branchUsersCanOrder, setBranchUsersCanOrder] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await axios.get(`${API_URL}/api/organizations/me`, { headers: getAuthHeader() });
      setForm({
        name: res.data.name,
        phone: res.data.phone,
        email: res.data.email,
        addressLine: res.data.addressLine,
        county: res.data.county,
        website: res.data.website || '',
        registrationNumber: res.data.registrationNumber || '',
        taxNumber: res.data.taxNumber || '',
      });
      setBranchUsersCanOrder(res.data.settings?.branch_users_can_order_directly !== false);
    };
    if (organization) load();
  }, [getAuthHeader, organization]);

  const handleSave = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(form.email);
    const invalidPhone = phoneError(form.phone);
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/organizations/me`, {
        ...form,
        branchUsersCanOrderDirectly: branchUsersCanOrder,
      }, { headers: getAuthHeader() });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <p className="text-ink-muted text-sm">Loading…</p>;

  return (
    <div>
      <p className="editorial-label mb-2">Facility</p>
      <h1 className="app-page-title mb-8">Settings</h1>

      <form onSubmit={handleSave} className="editorial-panel p-6 max-w-xl space-y-4">
        <EditorialField label="Facility name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </EditorialField>
        <EditorialField label="Phone" error={livePhoneError(form.phone)}>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={invalidFieldClass(livePhoneError(form.phone))} />
        </EditorialField>
        <EditorialField label="Email" error={liveEmailError(form.email)}>
          <Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={invalidFieldClass(liveEmailError(form.email))} />
        </EditorialField>
        <EditorialField label="Address"><Input value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} /></EditorialField>
        <EditorialField label="County"><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></EditorialField>
        <EditorialField label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></EditorialField>
        <EditorialField label="Registration number"><Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></EditorialField>
        <EditorialField label="Tax / KRA PIN"><Input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} /></EditorialField>

        <div className="pt-4 border-t border-ink/10">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={branchUsersCanOrder} onChange={(e) => setBranchUsersCanOrder(e.target.checked)} className="mt-1 rounded border-ink/20" />
            <div>
              <p className="text-sm font-medium text-ink">Branch users can order directly</p>
              <p className="text-xs text-ink-muted mt-0.5">When off, only facility and branch admins can place orders.</p>
            </div>
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
        </button>
      </form>
    </div>
  );
};
