import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import {
  FacilityFilterBar,
  FacilitySearchInput,
  FacilityMultiSelect,
  FacilityResetFilters,
} from '../../components/facility/FacilityListControls';
import { API_URL } from '../../config/apiBaseUrl';
import { EditorialField } from '../../components/template/EditorialSection';
import { Input } from '../../components/ui/input';
import { phoneError, livePhoneError, invalidFieldClass } from '../../utils/validation';

export const DeliveryLocations = () => {
  const { getAuthHeader, branches } = useAuth();
  const [locations, setLocations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', addressLine: '', county: '', branchId: '', contactName: '', phone: '', deliveryInstructions: '' });
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState([]);

  const load = async () => {
    const res = await axios.get(`${API_URL}/api/delivery-locations`, { headers: getAuthHeader() });
    setLocations(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [getAuthHeader]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const invalidPhone = phoneError(form.phone, { required: false });
    if (invalidPhone) { toast.error(invalidPhone); return; }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/delivery-locations`, {
        label: form.label,
        addressLine: form.addressLine,
        county: form.county,
        branchId: form.branchId || null,
        contactName: form.contactName,
        phone: form.phone,
        deliveryInstructions: form.deliveryInstructions,
      }, { headers: getAuthHeader() });
      toast.success('Location added');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-ink-muted text-sm">Loading…</p>;

  const q = search.trim().toLowerCase();
  const filteredLocations = locations.filter((loc) => {
    const matchesSearch = !q || [loc.label, loc.addressLine, loc.county, loc.contactName, loc.phone].some((v) =>
      String(v || '').toLowerCase().includes(q)
    );
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(loc.branchId);
    return matchesSearch && matchesBranch;
  });

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="editorial-label mb-2">Logistics</p>
          <h1 className="app-page-title">Delivery locations</h1>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add location
        </button>
      </div>

      <FacilityFilterBar>
        <FacilitySearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search label, address, contact…"
        />
        {branches.length > 0 && (
          <FacilityMultiSelect
            value={branchFilter}
            onChange={setBranchFilter}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            searchPlaceholder="Search branch…"
          />
        )}
        <FacilityResetFilters
          disabled={!search.trim() && branchFilter.length === 0}
          onReset={() => { setSearch(''); setBranchFilter([]); }}
        />
      </FacilityFilterBar>

      {showForm && (
        <form onSubmit={handleCreate} className="editorial-panel p-6 mb-8 space-y-4 max-w-lg">
          <EditorialField label="Label" required><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></EditorialField>
          <EditorialField label="Address" required><Input value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} required /></EditorialField>
          <EditorialField label="County"><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></EditorialField>
          <EditorialField label="Branch (optional)">
            <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-ink/15 text-sm">
              <option value="">Facility-wide</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </EditorialField>
          <EditorialField label="Contact name"><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></EditorialField>
          <EditorialField label="Phone" error={livePhoneError(form.phone)}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={invalidFieldClass(livePhoneError(form.phone))} />
          </EditorialField>
          <EditorialField label="Delivery instructions"><Input value={form.deliveryInstructions} onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })} /></EditorialField>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No delivery locations yet.</div>
      ) : filteredLocations.length === 0 ? (
        <div className="editorial-panel p-12 text-center text-ink-muted">No locations match these filters.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredLocations.map((loc) => (
            <div key={loc.id} className="editorial-panel p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-ink">{loc.label}</p>
                {loc.isDefault && <span className="text-[10px] text-copper uppercase">Default</span>}
              </div>
              <p className="text-sm text-ink-muted">{loc.addressLine}</p>
              {loc.county && <p className="text-xs text-ink-faint mt-1">{loc.county}</p>}
              {loc.deliveryInstructions && <p className="text-xs text-ink-faint mt-2 italic">{loc.deliveryInstructions}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
